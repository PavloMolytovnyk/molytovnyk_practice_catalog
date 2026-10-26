import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { requireRole } from './auth.js';
import { HttpError } from './errors.js';
import { deliveryPriceCalculator } from './patterns/delivery-strategies.js';
import { OrderWorkflow } from './patterns/order-states.js';

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(100) })).min(1).max(30),
  customer: z.object({ firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80), phone: z.string().regex(/^\+?380\d{9}$/), email: z.email().max(254) }),
  city: z.string().trim().min(2).max(120), branch: z.string().trim().min(2).max(240),
  delivery: z.enum(['Нова пошта','Кур’єр']), payment: z.enum(['Оплата карткою','Післяплата']), comment: z.string().max(1000).default(''),
}).strict();
const statusSchema = z.object({ status: z.enum(['Підтверджене','Комплектується','Відправлене','Виконане','Скасоване']), note: z.string().max(500).default('') });

async function fetchOrder(client, id) {
  const { rows } = await client.query('SELECT * FROM orders WHERE id=$1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Замовлення не знайдено.', 'NOT_FOUND');
  const items = await client.query('SELECT product_id,name,sku,quantity,price FROM order_items WHERE order_id=$1 ORDER BY id', [id]);
  const row = rows[0];
  return {
    id: row.id, number: row.number, createdAt: row.created_at.toISOString(), status: row.status,
    subtotal: Number(row.subtotal), deliveryFee: Number(row.delivery_fee), total: Number(row.total),
    items: items.rows.map((item) => ({ productId: item.product_id, name: item.name, sku: item.sku, quantity: item.quantity, price: Number(item.price) })),
    customer: { firstName: row.first_name, lastName: row.last_name, phone: row.phone, email: row.email },
    city: row.city, branch: row.branch, delivery: row.delivery, payment: row.payment, paymentStatus: row.payment_status,
  };
}

async function listOrders(client, condition, values) {
  const { rows } = await client.query(`SELECT id FROM orders WHERE ${condition} ORDER BY created_at DESC`, values);
  return Promise.all(rows.map(({ id }) => fetchOrder(client, id)));
}

export const orderRouter = Router();
orderRouter.post('/orders', async (req, res) => {
  const data = orderSchema.parse(req.body);
  const ids = data.items.map(({ productId }) => productId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Товар повторюється в кошику.', 'DUPLICATE_ITEM');
  const key = req.get('Idempotency-Key');
  if (key && !/^[\w-]{16,100}$/.test(key)) throw new HttpError(400, 'Некоректний ключ запиту.', 'VALIDATION_ERROR');
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const result = await transaction(async (client) => {
    if (key) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      const previous = await client.query('SELECT id,request_hash FROM orders WHERE idempotency_key=$1', [key]);
      if (previous.rows[0]) {
        if (previous.rows[0].request_hash !== hash) throw new HttpError(409, 'Ключ запиту вже використано для інших даних.', 'IDEMPOTENCY_CONFLICT');
        return { order: await fetchOrder(client, previous.rows[0].id), reused: true };
      }
    }
    const sorted = [...data.items].sort((a,b) => a.productId.localeCompare(b.productId));
    const stock = await client.query('SELECT id,name,sku,price,stock,reserved,active FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE', [sorted.map((item) => item.productId)]);
    if (stock.rows.length !== sorted.length) throw new HttpError(409, 'Деякі товари більше не доступні.', 'PRODUCT_UNAVAILABLE');
    let subtotalCents = 0;
    for (const item of sorted) {
      const product = stock.rows.find((row) => row.id === item.productId);
      if (!product.active || product.stock - product.reserved < item.quantity) throw new HttpError(409, `Недостатній залишок товару «${product.name}».`, 'STOCK_CONFLICT');
      subtotalCents += Math.round(Number(product.price) * 100) * item.quantity;
    }
    const subtotal = subtotalCents / 100;
    const method = await client.query('SELECT id,base_price FROM delivery_methods WHERE name=$1 AND active', [data.delivery]);
    const paymentMethod = await client.query('SELECT id FROM payment_methods WHERE name=$1 AND active', [data.payment]);
    if (!method.rows[0] || !paymentMethod.rows[0]) throw new HttpError(409,'Обраний спосіб доставки або оплати недоступний.','METHOD_UNAVAILABLE');
    const deliveryFee = deliveryPriceCalculator.calculateCents(data.delivery, {
      subtotalCents, basePriceCents: Math.round(Number(method.rows[0].base_price) * 100),
    }) / 100;
    const sequence = await client.query("SELECT nextval('order_number_seq') AS value");
    const number = `FR-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(sequence.rows[0].value).padStart(6,'0')}`;
    const { rows } = await client.query(`INSERT INTO orders (number,user_id,first_name,last_name,phone,email,city,branch,delivery,payment,delivery_method_id,payment_method_id,comment,subtotal,delivery_fee,total,idempotency_key,request_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`, [number,req.user?.id ?? null,data.customer.firstName,data.customer.lastName,data.customer.phone,data.customer.email.toLowerCase(),data.city,data.branch,data.delivery,data.payment,method.rows[0].id,paymentMethod.rows[0].id,data.comment,subtotal,deliveryFee,subtotal+deliveryFee,key || null,hash]);
    const orderId = rows[0].id;
    for (const item of sorted) {
      const product = stock.rows.find((row) => row.id === item.productId);
      await client.query('INSERT INTO order_items (order_id,product_id,name,sku,quantity,price) VALUES ($1,$2,$3,$4,$5,$6)', [orderId,product.id,product.name,product.sku,item.quantity,product.price]);
      await client.query('UPDATE products SET reserved=reserved+$1 WHERE id=$2', [item.quantity,product.id]);
      await client.query("INSERT INTO inventory_movements (product_id,order_id,actor_id,movement_type,reserved_delta,reason) VALUES ($1,$2,$3,'RESERVE',$4,'Створення замовлення')", [product.id,orderId,req.user?.id ?? null,item.quantity]);
    }
    await client.query('INSERT INTO order_status_history (order_id,status,actor_id) VALUES ($1,$2,$3)', [orderId,'Нове',req.user?.id ?? null]);
    await client.query("INSERT INTO payments (order_id,amount,status) VALUES ($1,$2,'PENDING')",[orderId,subtotal+deliveryFee]);
    await client.query("INSERT INTO notification_outbox (order_id,recipient,template_code,payload) VALUES ($1,$2,'ORDER_CREATED',$3)",[orderId,data.customer.email.toLowerCase(),JSON.stringify({ number,total:subtotal+deliveryFee })]);
    return { order: await fetchOrder(client, orderId), reused: false };
  });
  res.status(result.reused ? 200 : 201).json({ data: result.order });
});

orderRouter.get('/me/orders', requireRole('customer','admin','catalog_manager','order_manager'), async (req,res) => {
  res.json({ data: await listOrders(pool,'user_id=$1',[req.user.id]) });
});
orderRouter.get('/me/orders/:id', requireRole('customer','admin','catalog_manager','order_manager'), async (req,res) => {
  const { rows } = await pool.query('SELECT id FROM orders WHERE id=$1 AND user_id=$2', [req.params.id,req.user.id]);
  if (!rows[0]) throw new HttpError(404,'Замовлення не знайдено.','NOT_FOUND');
  res.json({ data: await fetchOrder(pool,rows[0].id) });
});

export const adminOrderRouter = Router();
adminOrderRouter.use('/orders', requireRole('admin','order_manager'));
adminOrderRouter.get('/orders', async (_req,res) => res.json({ data: await listOrders(pool,'true',[]) }));
adminOrderRouter.post('/orders/:id/status', async (req,res) => {
  const data = statusSchema.parse(req.body);
  if (data.status === 'Скасоване' && data.note.trim().length < 3) throw new HttpError(400,'Вкажіть причину скасування.','VALIDATION_ERROR');
  const order = await transaction(async (client) => {
    const { rows } = await client.query('SELECT id,status FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw new HttpError(404,'Замовлення не знайдено.','NOT_FOUND');
    const nextState = new OrderWorkflow(rows[0].status).transitionTo(data.status);
    const movement = nextState.inventoryMovement;
    if (movement) {
      const items = await client.query('SELECT product_id,quantity FROM order_items WHERE order_id=$1 ORDER BY product_id', [req.params.id]);
      for (const item of items.rows) if (item.product_id) {
        if (movement === 'RELEASE') await client.query('UPDATE products SET reserved=reserved-$1 WHERE id=$2', [item.quantity,item.product_id]);
        else await client.query('UPDATE products SET stock=stock-$1,reserved=reserved-$1 WHERE id=$2', [item.quantity,item.product_id]);
        await client.query('INSERT INTO inventory_movements (product_id,order_id,actor_id,movement_type,stock_delta,reserved_delta,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',[item.product_id,req.params.id,req.user.id,movement,movement === 'RELEASE' ? 0 : -item.quantity,-item.quantity,data.note || nextState.status]);
      }
    }
    await client.query('UPDATE orders SET status=$1 WHERE id=$2', [nextState.status,req.params.id]);
    await client.query('INSERT INTO order_status_history (order_id,status,actor_id,note) VALUES ($1,$2,$3,$4)', [req.params.id,data.status,req.user.id,data.note]);
    await client.query('INSERT INTO audit_log (actor_id,action,entity_id) VALUES ($1,$2,$3)', [req.user.id,'order.status',req.params.id]);
    const recipient = await client.query('SELECT email,number FROM orders WHERE id=$1',[req.params.id]);
    await client.query("INSERT INTO notification_outbox (order_id,recipient,template_code,payload) VALUES ($1,$2,'STATUS_CHANGED',$3)",[req.params.id,recipient.rows[0].email,JSON.stringify({ number:recipient.rows[0].number,status:data.status })]);
    return fetchOrder(client,req.params.id);
  });
  res.json({ data: order });
});
