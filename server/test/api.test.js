import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { getProductAnalytics } from '../src/analytics.js';

const db = new PGlite();
pool.query = (...args) => db.query(...args);
pool.connect = async () => ({ query: (...args) => db.query(...args), release: () => {} });
const request = supertest(app);
const item = { productId: 'aura-fit', quantity: 2 };
const checkout = { items: [item], customer: { firstName:'Іван',lastName:'Коваль',phone:'+380671234567',email:'ivan@example.com' }, city:'Івано-Франківськ',branch:'Відділення № 2',delivery:'Нова пошта',payment:'Післяплата',comment:'' };

await db.exec(await readFile(new URL('../sql/001_schema.sql',import.meta.url),'utf8'));
for (const [code,name] of [['customer','Покупець'],['catalog_manager','Контент-менеджер'],['order_manager','Менеджер замовлень'],['admin','Адміністратор']]) await db.query('INSERT INTO roles(code,name) VALUES ($1,$2)',[code,name]);
for (const name of ['Аудіо','Гаджети','Дім','Подорожі']) await db.query('INSERT INTO categories(name) VALUES ($1)',[name]);
for (const [code,name,price] of [['nova','Нова пошта',120],['courier','Кур’єр',160]]) await db.query('INSERT INTO delivery_methods(code,name,base_price) VALUES ($1,$2,$3)',[code,name,price]);
for (const [code,name] of [['card','Оплата карткою'],['cod','Післяплата']]) await db.query('INSERT INTO payment_methods(code,name) VALUES ($1,$2)',[code,name]);
const seed = JSON.parse(await readFile(new URL('../sql/seed-products.json',import.meta.url),'utf8'));
for (const p of seed) await db.query('INSERT INTO products (id,sku,category_id,name,price,stock,short_description,description,features,art,color,accent) VALUES ($1,$2,(SELECT id FROM categories WHERE name=$3),$4,$5,$6,$7,$8,$9,$10,$11,$12)',[p.id,p.sku,p.category,p.name,p.price,p.stock,p.shortDescription,p.description,JSON.stringify(p.features),p.art,p.color,p.accent]);
const adminHash = await hashPassword('strong-admin-password');
const admin = await db.query("INSERT INTO users (email,first_name,last_name,password_hash) VALUES ('admin@example.com','Павло','М.', $1) RETURNING id",[adminHash]);
await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='admin'",[admin.rows[0].id]);

let orderId;
let customerCookie;
let adminCookie;

test('public catalog and validation', async () => {
  const catalog = await request.get('/api/products?limit=10&category=Гаджети');
  assert.equal(catalog.status,200);
  assert.equal(catalog.body.meta.total,3);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.stock,14);
  assert.equal((await request.get('/api/products/missing')).status,404);
  assert.equal((await request.get('/api/products?page=0')).status,400);
  assert.equal((await request.post('/api/orders').send({ items:[] })).status,400);
});

test('registration, session, role denial, invalid password', async () => {
  const registered = await request.post('/api/auth/register').send({ email:'ivan@example.com',password:'correct-horse-123',firstName:'Іван',lastName:'Коваль' });
  assert.equal(registered.status,201);
  customerCookie = registered.headers['set-cookie'];
  assert.ok(customerCookie[0].includes('HttpOnly'));
  assert.equal((await request.get('/api/auth/me').set('Cookie',customerCookie)).body.data.firstName,'Іван');
  assert.equal((await request.get('/api/admin/products').set('Cookie',customerCookie)).status,403);
  assert.equal((await request.get('/api/me/orders')).status,401);
  assert.equal((await request.post('/api/auth/login').send({email:'ivan@example.com',password:'wrong'})).status,401);
});

test('checkout computes amount, reserves stock and is idempotent', async () => {
  const key = 'customer-order-key-1001';
  const created = await request.post('/api/orders').set('Cookie',customerCookie).set('Idempotency-Key',key).send(checkout);
  assert.equal(created.status,201,JSON.stringify(created.body));
  orderId = created.body.data.id;
  assert.equal(created.body.data.subtotal,6998);
  assert.equal(created.body.data.deliveryFee,0);
  assert.equal(created.body.data.total,6998);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.stock,12);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.soldCount,0);
  const list = await request.get('/api/products?sort=price-asc&limit=100');
  assert.ok(list.body.data.findIndex((product) => product.id === 'aura-fit') > 0);
  assert.equal(list.body.data.find((product) => product.id === 'aura-fit').stock,12);
  assert.ok(list.body.data.every((product) => !('reserved' in product)));
  assert.equal((await db.query("SELECT count(*)::int AS count FROM inventory_movements WHERE movement_type='RESERVE'")).rows[0].count,1);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM notification_outbox WHERE template_code='ORDER_CREATED'")).rows[0].count,1);
  const retry = await request.post('/api/orders').set('Cookie',customerCookie).set('Idempotency-Key',key).send(checkout);
  assert.equal(retry.status,200);
  assert.equal(retry.body.data.id,orderId);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.stock,12);
  assert.equal((await request.post('/api/orders').set('Idempotency-Key',key).send({...checkout,comment:'changed'})).status,409);
  assert.equal((await request.get('/api/me/orders').set('Cookie',customerCookie)).body.data.length,1);
  assert.equal((await request.get(`/api/me/orders/${orderId}`)).status,401);
});

test('admin CRUD is protected and historical line item survives archival', async () => {
  const login = await request.post('/api/auth/login').send({ email:'admin@example.com',password:'strong-admin-password' });
  adminCookie = login.headers['set-cookie'];
  const newProduct = { name:'Лампа Desk Pro',sku:'FRM-DP-001',category:'Дім',price:499,stock:4,shortDescription:'Настільна лампа для роботи і навчання.' };
  const added = await request.post('/api/admin/products').set('Cookie',adminCookie).send(newProduct);
  assert.equal(added.status,201,JSON.stringify(added.body));
  const id = added.body.data.id;
  assert.equal((await request.patch(`/api/admin/products/${id}`).set('Cookie',adminCookie).send({ price:599 })).body.data.price,599);
  assert.equal((await request.delete(`/api/admin/products/${id}`).set('Cookie',adminCookie)).status,204);
  assert.equal((await request.get(`/api/products/${id}`)).status,404);
  assert.equal((await request.patch('/api/admin/products/aura-fit').set('Cookie',adminCookie).send({stock:1})).status,409);
  assert.equal((await request.get(`/api/me/orders/${orderId}`).set('Cookie',customerCookie)).body.data.items[0].price,3499);
});

test('status transitions, cancellation and authorization', async () => {
  assert.equal((await request.post(`/api/admin/orders/${orderId}/status`).set('Cookie',customerCookie).send({status:'Підтверджене'})).status,403);
  assert.equal((await request.post(`/api/admin/orders/${orderId}/status`).set('Cookie',adminCookie).send({status:'Виконане'})).status,409);
  assert.equal((await request.post(`/api/admin/orders/${orderId}/status`).set('Cookie',adminCookie).send({status:'Підтверджене'})).status,200);
  assert.equal((await request.post(`/api/admin/orders/${orderId}/status`).set('Cookie',adminCookie).send({status:'Скасоване',note:'Покупець відмовився'})).status,200);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.stock,14);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.soldCount,0);
  assert.equal((await request.post(`/api/admin/orders/${orderId}/status`).set('Cookie',adminCookie).send({status:'Підтверджене'})).status,409);
  assert.equal((await request.get(`/api/me/orders/${orderId}`).set('Cookie',customerCookie)).body.data.status,'Скасоване');
});

test('insufficient stock rolls back; courier fee and completed inventory are correct', async () => {
  const shortage = await request.post('/api/orders').send({ ...checkout,items:[{productId:'aura-fit',quantity:1},{productId:'north-22',quantity:100}] });
  assert.equal(shortage.status,409);
  assert.equal((await request.get('/api/products/aura-fit')).body.data.stock,14);
  const guest = await request.post('/api/orders').send({ ...checkout,items:[{productId:'nomad-mug',quantity:1}],delivery:'Кур’єр' });
  assert.equal(guest.status,201);
  assert.equal(guest.body.data.subtotal,849);
  assert.equal(guest.body.data.deliveryFee,160);
  assert.equal(guest.body.data.total,1009);
  assert.equal((await request.get('/api/products/nomad-mug')).body.data.stock,31);
  assert.equal((await request.get('/api/products/nomad-mug')).body.data.soldCount,0);
  for (const status of ['Підтверджене','Комплектується','Відправлене','Виконане']) {
    const changed = await request.post(`/api/admin/orders/${guest.body.data.id}/status`).set('Cookie',adminCookie).send({status});
    assert.equal(changed.status,200);
  }
  assert.equal((await request.get('/api/products/nomad-mug')).body.data.stock,31);
  const popular = (await request.get('/api/products/nomad-mug')).body.data;
  assert.equal(popular.soldCount,1);
  assert.equal(popular.salesRank,1);
  assert.equal(popular.popularityScore,5);
  assert.equal((await request.post(`/api/admin/orders/${guest.body.data.id}/status`).set('Cookie',adminCookie).send({status:'Виконане'})).status,409);
  assert.equal((await request.get('/api/products/nomad-mug')).body.data.soldCount,1);
  assert.equal((await request.get('/api/me/orders').set('Cookie',customerCookie)).body.data.length,1);
  assert.equal((await request.get(`/api/me/orders/${guest.body.data.id}`).set('Cookie',customerCookie)).status,404);
});

test('analytics uses completed purchases only, protects access and validates periods', async () => {
  assert.equal((await request.get('/api/admin/analytics')).status,401);
  assert.equal((await request.get('/api/admin/analytics').set('Cookie',customerCookie)).status,403);
  assert.equal((await request.get('/api/admin/analytics?days=0').set('Cookie',adminCookie)).status,400);
  assert.equal((await request.get('/api/admin/analytics?days=7&unknown=1').set('Cookie',adminCookie)).status,400);
  const result = await request.get('/api/admin/analytics?days=7').set('Cookie',adminCookie);
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(result.headers['cache-control'],'no-store');
  assert.equal(result.body.data.summary.units,1);
  assert.equal(result.body.data.summary.orders,1);
  assert.equal(result.body.data.summary.revenue,849); // excludes delivery and the cancelled Aura purchase
  assert.equal(result.body.data.products[0].productId,'nomad-mug');
  assert.equal(result.body.data.products[0].recommendation.code,'promote');
  assert.equal(result.body.data.products.find((p) => p.productId === 'aura-fit').units,0);
});

test('catalog and order managers can view demand, with CRUD permissions still separated', async () => {
  for (const role of ['catalog_manager','order_manager']) {
    const user = await db.query('INSERT INTO users(email,first_name,last_name,password_hash) VALUES ($1,$2,$3,$4) RETURNING id',[`${role}@example.com`,'Менеджер','FORMA',adminHash]);
    await db.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2',[user.rows[0].id,role]);
    const login = await request.post('/api/auth/login').send({email:`${role}@example.com`,password:'strong-admin-password'});
    const cookie = login.headers['set-cookie'];
    assert.equal((await request.get('/api/admin/analytics').set('Cookie',cookie)).status,200);
    assert.equal((await request.get('/api/admin/products').set('Cookie',cookie)).status,role === 'catalog_manager' ? 200 : 403);
    assert.equal((await request.get('/api/admin/orders').set('Cookie',cookie)).status,role === 'order_manager' ? 200 : 403);
  }
});

test('analytics respects completion dates, period boundaries, sale prices and reserved stock', async () => {
  const now = new Date('2025-06-30T12:00:00.000Z');
  const ago = (days) => new Date(now.getTime()-days*86400000).toISOString();
  await db.query('BEGIN');
  try {
    // The product now costs 9999; analytical revenue must still use the sale price of 100.
    await db.query("UPDATE products SET price=9999,stock=3,reserved=2 WHERE id='aura-fit'");
    const fixture = async (number, status, created, completed, quantity, productId = 'aura-fit', price = 100) => {
      const result = await db.query(`INSERT INTO orders(number,status,first_name,last_name,phone,email,city,branch,delivery,payment,delivery_method_id,payment_method_id,subtotal,delivery_fee,total,created_at)
        VALUES ($1,$2,'Гість','Тест','+380671234567','guest@test.com','Київ','1','Нова пошта','Післяплата',1,1,$3::numeric,120,$3::numeric+120,$4) RETURNING id`,[number,status,quantity*price,created]);
      const id = result.rows[0].id;
      await db.query('INSERT INTO order_items(order_id,product_id,name,sku,quantity,price) VALUES ($1,$2,$3,$4,$5,$6)',[id,productId,productId ? 'Aura snapshot' : 'Видалена модель',productId ? 'AURA-SNAPSHOT' : 'REMOVED-SKU',quantity,price]);
      if (completed) await db.query("INSERT INTO order_status_history(order_id,status,created_at) VALUES ($1,'Виконане',$2)",[id,completed]);
    };
    await fixture('AN-current-old-created','Виконане',ago(60),ago(1),4);
    await fixture('AN-boundary','Виконане',ago(8),ago(7),3);
    await fixture('AN-previous-boundary','Виконане',ago(15),ago(14),2);
    await fixture('AN-outside','Виконане',ago(16),ago(14+1/86400),20);
    await fixture('AN-pending','Нове',ago(1),null,30);
    await fixture('AN-cancelled','Скасоване',ago(1),null,40);
    await fixture('AN-future','Виконане',ago(1),ago(-1),50);
    await fixture('AN-deleted','Виконане',ago(1),ago(1),2,null,50);
    await fixture('AN-legacy','Виконане',ago(1),null,1);
    const data = await getProductAnalytics(db,7,now);
    assert.equal(data.summary.orders,4);
    assert.equal(data.summary.units,10);
    assert.equal(data.summary.revenue,900);
    assert.equal(data.summary.previousUnits,2);
    assert.equal(data.summary.growthPercent,400);
    const aura = data.products.find((p) => p.productId === 'aura-fit');
    assert.equal(aura.units,8);
    assert.equal(aura.revenue,800);
    assert.equal(aura.availableStock,1);
    assert.equal(aura.stockDays,0.88);
    assert.equal(aura.suggestedRestock,15);
    assert.equal(aura.growthPercent,300);
    assert.equal(aura.recommendation.code,'restock');
    assert.equal(aura.demand,'high');
    assert.equal(data.products.find((p) => p.key === 'deleted:REMOVED-SKU').units,2);
    assert.equal(data.categories.reduce((sum,c) => sum+c.units,0),10);
    const month = await getProductAnalytics(db,30,now);
    assert.equal(month.summary.units,32);
    assert.equal(month.summary.previousUnits,0);
    assert.equal(month.summary.growthPercent,null);
    await db.query("UPDATE products SET active=false WHERE id='aura-fit'");
    const archived = await getProductAnalytics(db,7,now);
    assert.equal(archived.products.find((p) => p.productId === 'aura-fit').recommendation.code,'inactive');
    assert.equal(archived.products.find((p) => p.productId === 'aura-fit').suggestedRestock,0);
    const empty = await getProductAnalytics(db,7,new Date('2020-01-01'));
    assert.equal(empty.summary.units,0);
    assert.equal(empty.summary.revenue,0);
    assert.equal(empty.summary.growthPercent,null);
    assert.deepEqual(empty.categories,[]);
    assert.ok(empty.products.every((p) => p.stockDays === null));
  } finally { await db.query('ROLLBACK'); }
});

test('public sales ranking sums units, handles ties, ignores seed values and stays global with pagination', async () => {
  await db.query('BEGIN');
  try {
    const fixture = async (number, productId, quantity, status = 'Виконане') => {
      const order = await db.query(`INSERT INTO orders(number,status,first_name,last_name,phone,email,city,branch,delivery,payment,delivery_method_id,payment_method_id,subtotal,delivery_fee,total)
        VALUES ($1,$2,'Гість','Тест','+380671234567','guest@test.com','Київ','1','Нова пошта','Післяплата',1,1,$3,0,$3) RETURNING id`, [number,status,quantity*100]);
      await db.query('INSERT INTO order_items(order_id,product_id,name,sku,quantity,price) VALUES ($1,$2,$2,$2,$3,100)', [order.rows[0].id,productId,quantity]);
      // Duplicate history rows must not duplicate the counted units.
      await db.query("INSERT INTO order_status_history(order_id,status) VALUES ($1,$2),($1,$2)", [order.rows[0].id,status]);
    };
    await db.query("UPDATE products SET popularity=999 WHERE id='nomad-mug'");
    await fixture('RANK-A1','aura-fit',4);
    await fixture('RANK-A2','aura-fit',6);
    await fixture('RANK-TIE1','north-22',5);
    await fixture('RANK-TIE2','sonora-air',5);
    await fixture('RANK-CANCEL','aura-fit',100,'Скасоване');
    await fixture('RANK-PENDING','sonora-air',200,'Нове');
    await fixture('RANK-SHIPPED','sonora-air',300,'Відправлене');
    await fixture('RANK-HIDDEN','halo-lamp',50);
    await db.query("UPDATE products SET active=false WHERE id='halo-lamp'");
    const result = await request.get('/api/products?sort=popular&limit=100');
    assert.equal(result.status,200,JSON.stringify(result.body));
    const data = result.body.data;
    assert.equal(data[0].id,'aura-fit');
    assert.equal(data[0].soldCount,10);
    assert.equal(data[0].popularity,10);
    assert.equal(data[0].salesRank,1);
    assert.equal(data[0].popularityScore,5);
    for (const id of ['north-22','sonora-air']) {
      const p = data.find((x) => x.id === id);
      assert.equal(p.soldCount,5);
      assert.equal(p.salesRank,2);
      assert.equal(p.popularityScore,2.5);
    }
    const mug = data.find((p) => p.id === 'nomad-mug');
    assert.equal(mug.salesRank,3);
    assert.equal(mug.popularityScore,0.5);
    assert.equal(data.some((p) => p.id === 'halo-lamp'),false);
    assert.ok(data.filter((p) => !p.soldCount).every((p) => p.salesRank === null && p.popularityScore === 0));
    for (const url of ['/api/products?category=Подорожі&limit=1','/api/products?search=north&limit=1','/api/products?limit=1&page=2']) {
      const page = await request.get(url);
      assert.equal(page.status,200,JSON.stringify(page.body));
      assert.equal(page.body.data[0].salesRank,2);
      assert.equal(page.body.data[0].popularityScore,2.5);
    }
    assert.deepEqual((await request.get('/api/products/aura-fit')).body.data,data[0]);
    const inventory = await request.get('/api/admin/products').set('Cookie',adminCookie);
    assert.equal(inventory.body.data.find((p) => p.id === 'halo-lamp').soldCount,50);
    assert.equal(inventory.body.data.find((p) => p.id === 'halo-lamp').salesRank,null);
    // Sold-out items retain their sales rank and are only hidden by inStock=true.
    await db.query("UPDATE products SET stock=0,reserved=0 WHERE id='aura-fit'");
    assert.equal((await request.get('/api/products/aura-fit')).body.data.salesRank,1);
    const available = await request.get('/api/products?inStock=true');
    assert.equal(available.body.data[0].salesRank,2);
    assert.equal(available.body.data[0].popularityScore,2.5);
    // No completed orders => zeros, never synthetic popularity or division by zero.
    await db.query("UPDATE orders SET status='Нове'");
    const empty = await request.get('/api/products');
    assert.equal(empty.status,200);
    assert.ok(empty.body.data.every((p) => p.soldCount === 0 && p.salesRank === null && p.popularityScore === 0 && p.popularity === 0));
  } finally { await db.query('ROLLBACK'); }
});

test.after(async () => { await db.close(); });
