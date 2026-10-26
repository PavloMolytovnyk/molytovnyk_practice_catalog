import { readFile } from 'node:fs/promises';
import { hashPassword } from './auth.js';

const roles = [['customer','Покупець'],['catalog_manager','Контент-менеджер'],['order_manager','Менеджер замовлень'],['admin','Адміністратор']];
const categories = ['Аудіо','Гаджети','Дім','Подорожі'];
const deliveryMethods = [['nova','Нова пошта',120],['courier','Кур’єр',160]];
const paymentMethods = [['card','Оплата карткою'],['cod','Післяплата']];

export async function setupDatabase(database, env = process.env, setStage = () => {}) {
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 10) {
    throw new Error('ADMIN_PASSWORD must contain at least 10 characters');
  }

  setStage('створення схеми й таблиць');
  const schema = await readFile(new URL('../sql/001_schema.sql', import.meta.url), 'utf8');
  await database.query(schema);

  setStage('додавання довідникових даних');
  for (const [code, name] of roles) await database.query('INSERT INTO roles (code,name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING', [code, name]);
  for (const name of categories) await database.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  for (const [code, name, price] of deliveryMethods) await database.query('INSERT INTO delivery_methods(code,name,base_price) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING', [code, name, price]);
  for (const [code, name] of paymentMethods) await database.query('INSERT INTO payment_methods(code,name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING', [code, name]);

  setStage('додавання демонстраційних товарів');
  const products = JSON.parse(await readFile(new URL('../sql/seed-products.json', import.meta.url), 'utf8'));
  for (const product of products) {
    await database.query(`INSERT INTO products (id,sku,category_id,name,price,old_price,stock,rating,reviews,badge,short_description,description,features,art,color,accent,popularity,created_at) VALUES ($1,$2,(SELECT id FROM categories WHERE name=$3),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`, [product.id, product.sku, product.category, product.name, product.price, product.oldPrice ?? null, product.stock, product.rating, product.reviews, product.badge ?? null, product.shortDescription, product.description, JSON.stringify(product.features), product.art, product.color, product.accent, product.popularity, product.createdAt]);
    for (const [index, feature] of product.features.entries()) await database.query('INSERT INTO product_characteristics (product_id,name,value) VALUES ($1,$2,$3) ON CONFLICT (product_id,name) DO NOTHING', [product.id, `Особливість ${index + 1}`, feature]);
  }

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    setStage('створення адміністратора');
    const hash = await hashPassword(env.ADMIN_PASSWORD);
    const { rows } = await database.query("INSERT INTO users (email,first_name,last_name,password_hash) VALUES ($1,'Адміністратор','FORMA',$2) ON CONFLICT DO NOTHING RETURNING id", [env.ADMIN_EMAIL.toLowerCase(), hash]);
    if (rows[0]) await database.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='admin' ON CONFLICT DO NOTHING", [rows[0].id]);
  }
}
