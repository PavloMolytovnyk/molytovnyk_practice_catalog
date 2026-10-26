import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { HttpError } from './errors.js';
import { requireRole } from './auth.js';
import { productSalesSelect } from './popularity.js';

const categories = ['Аудіо', 'Гаджети', 'Дім', 'Подорожі'];
const productSchema = z.object({
  name: z.string().trim().min(3).max(160), sku: z.string().trim().regex(/^[A-Z0-9-]{4,40}$/),
  category: z.enum(categories), price: z.number().positive().max(1000000), stock: z.number().int().min(0).max(1000000),
  shortDescription: z.string().trim().min(10).max(500),
  description: z.string().trim().max(4000).optional(), features: z.array(z.string().max(200)).max(20).optional(),
  art: z.enum(['watch','headphones','lamp','backpack','keyboard','speaker','mug','powerbank']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
});
const select = productSalesSelect;

export function mapProduct(row, admin = false) {
  return {
    id: row.id, name: row.name, sku: row.sku, category: row.category,
    price: Number(row.price), oldPrice: row.old_price == null ? undefined : Number(row.old_price),
    stock: admin ? Number(row.stock) : Number(row.stock) - Number(row.reserved),
    ...(admin ? { reserved: Number(row.reserved) } : {}), rating: Number(row.rating), reviews: row.reviews,
    badge: row.badge ?? undefined, shortDescription: row.short_description, description: row.description,
    features: row.features, art: row.art, color: row.color, accent: row.accent,
    popularity: Number(row.sold_count ?? 0), soldCount: Number(row.sold_count ?? 0),
    salesRank: row.sales_rank == null ? null : Number(row.sales_rank),
    popularityScore: Number(row.popularity_score ?? 0),
    createdAt: row.created_at.toISOString(), active: row.active,
  };
}

export const productRouter = Router();
productRouter.get('/categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT name FROM categories ORDER BY id');
  res.json({ data: rows.map((row) => row.name) });
});

productRouter.get('/products', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(24), category: z.enum(categories).optional(), search: z.string().max(100).optional(), minPrice: z.coerce.number().min(0).optional(), maxPrice: z.coerce.number().min(0).optional(), inStock: z.enum(['true','false']).optional(), sort: z.enum(['popular','rating','new','price-asc','price-desc']).default('popular') }).parse(req.query);
  const where = ['p.active=true']; const params = [];
  if (query.category) { params.push(query.category); where.push(`c.name=$${params.length}`); }
  if (query.search) { params.push(`%${query.search.trim()}%`); where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.short_description ILIKE $${params.length})`); }
  if (query.minPrice !== undefined) { params.push(query.minPrice); where.push(`p.price >= $${params.length}`); }
  if (query.maxPrice !== undefined) { params.push(query.maxPrice); where.push(`p.price <= $${params.length}`); }
  if (query.inStock === 'true') where.push('p.stock > p.reserved');
  const condition = where.join(' AND ');
  const count = await pool.query(`SELECT count(*)::int AS count FROM products p JOIN categories c ON c.id=p.category_id WHERE ${condition}`, params);
  const order = { popular: 'COALESCE(s.sold_count,0) DESC', rating: 'p.rating DESC', new: 'p.created_at DESC', 'price-asc': 'p.price ASC', 'price-desc': 'p.price DESC' }[query.sort];
  const result = await pool.query(`${select} WHERE ${condition} ORDER BY ${order}, p.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, query.limit, (query.page - 1) * query.limit]);
  res.json({ data: result.rows.map((row) => mapProduct(row)), meta: { page: query.page, limit: query.limit, total: count.rows[0].count } });
});

productRouter.get('/products/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { rows } = await pool.query(`${select} WHERE p.id=$1 AND p.active=true`, [req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'Товар не знайдено.', 'NOT_FOUND');
  res.json({ data: mapProduct(rows[0]) });
});

export const adminProductRouter = Router();
adminProductRouter.use('/products', requireRole('admin','catalog_manager'));
adminProductRouter.get('/products', async (_req, res) => {
  const { rows } = await pool.query(`${select} ORDER BY p.created_at DESC`);
  res.json({ data: rows.map((row) => mapProduct(row, true)) });
});

adminProductRouter.post('/products', async (req, res) => {
  const data = productSchema.parse(req.body);
  const id = randomUUID();
  const result = await transaction(async (client) => {
    const { rows } = await client.query(`INSERT INTO products (id,sku,category_id,name,price,stock,short_description,description,features,art,color,accent,active) VALUES ($1,$2,(SELECT id FROM categories WHERE name=$3),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [id,data.sku,data.category,data.name,data.price,data.stock,data.shortDescription,data.description || data.shortDescription,JSON.stringify(data.features || []),data.art || 'lamp',data.color || '#d9d4ff',data.accent || '#6558e8',data.active ?? true]);
    await client.query('INSERT INTO audit_log (actor_id,action,entity_id) VALUES ($1,$2,$3)', [req.user.id,'product.create',id]);
    return rows[0];
  });
  const { rows } = await pool.query(`${select} WHERE p.id=$1`, [result.id]);
  res.status(201).json({ data: mapProduct(rows[0], true) });
});

adminProductRouter.patch('/products/:id', async (req, res) => {
  const data = productSchema.partial().strict().parse(req.body);
  if (!Object.keys(data).length) throw new HttpError(400, 'Немає полів для оновлення.', 'VALIDATION_ERROR');
  await transaction(async (client) => {
    const { rows } = await client.query('SELECT stock,reserved FROM products WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'Товар не знайдено.', 'NOT_FOUND');
    if (data.stock !== undefined && data.stock < rows[0].reserved) throw new HttpError(409, 'Новий залишок менший за зарезервовану кількість.', 'STOCK_CONFLICT');
    const columns = { name:'name',sku:'sku',price:'price',stock:'stock',shortDescription:'short_description',description:'description',features:'features',art:'art',color:'color',accent:'accent',active:'active' };
    const changes = []; const values = [];
    for (const [key, column] of Object.entries(columns)) if (data[key] !== undefined) { values.push(key === 'features' ? JSON.stringify(data[key]) : data[key]); changes.push(`${column}=$${values.length}`); }
    if (data.category) { values.push(data.category); changes.push(`category_id=(SELECT id FROM categories WHERE name=$${values.length})`); }
    if (!changes.length) throw new HttpError(400, 'Немає полів для оновлення.', 'VALIDATION_ERROR');
    values.push(req.params.id);
    await client.query(`UPDATE products SET ${changes.join(',')},updated_at=now() WHERE id=$${values.length}`, values);
    await client.query('INSERT INTO audit_log (actor_id,action,entity_id) VALUES ($1,$2,$3)', [req.user.id,'product.update',req.params.id]);
  });
  const { rows } = await pool.query(`${select} WHERE p.id=$1`, [req.params.id]);
  res.json({ data: mapProduct(rows[0], true) });
});

adminProductRouter.delete('/products/:id', async (req, res) => {
  await transaction(async (client) => {
    const result = await client.query('UPDATE products SET active=false,updated_at=now() WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) throw new HttpError(404, 'Товар не знайдено.', 'NOT_FOUND');
    await client.query('INSERT INTO audit_log (actor_id,action,entity_id) VALUES ($1,$2,$3)', [req.user.id,'product.archive',req.params.id]);
  });
  res.status(204).end();
});
