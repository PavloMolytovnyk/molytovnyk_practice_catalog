import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js';
import { requireRole } from './auth.js';

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const change = (current, previous) => previous > 0 ? round((current - previous) / previous * 100) : null;

// One statement gives the totals, historical sale prices and current inventory
// a consistent database snapshot. Completion time, not order creation time,
// determines the period; legacy completed orders fall back to created_at.
export async function getProductAnalytics(database, days, now = new Date()) {
  const { rows } = await database.query(`
    WITH bounds AS (
      SELECT $1::timestamptz AS as_of, $2::int * interval '1 day' AS duration
    ), completed AS (
      SELECT o.id, COALESCE(h.finished_at, o.created_at) AS sold_at
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT max(created_at) AS finished_at FROM order_status_history
        WHERE order_id=o.id AND status='Виконане'
      ) h ON true
      WHERE o.status='Виконане'
    ), period_orders AS (
      SELECT o.id, o.sold_at >= b.as_of-b.duration AS current_period
      FROM completed o CROSS JOIN bounds b
      WHERE o.sold_at >= b.as_of-2*b.duration AND o.sold_at <= b.as_of
    ), sales AS (
      SELECT i.product_id, max(i.name) AS name, max(i.sku) AS sku,
        COALESCE(sum(i.quantity) FILTER (WHERE o.current_period),0) AS units,
        COALESCE(sum(i.quantity*i.price) FILTER (WHERE o.current_period),0) AS revenue,
        count(DISTINCT o.id) FILTER (WHERE o.current_period) AS orders,
        COALESCE(sum(i.quantity) FILTER (WHERE NOT o.current_period),0) AS previous_units,
        COALESCE(sum(i.quantity*i.price) FILTER (WHERE NOT o.current_period),0) AS previous_revenue
      FROM order_items i JOIN period_orders o ON o.id=i.order_id
      GROUP BY i.product_id, CASE WHEN i.product_id IS NULL THEN i.sku ELSE '' END
    ), catalog AS (
      SELECT COALESCE(p.id,'deleted:' || s.sku) AS key, p.id AS product_id,
        COALESCE(p.name,s.name) AS name, COALESCE(p.sku,s.sku) AS sku,
        COALESCE(c.name,'Видалені товари') AS category,
        COALESCE(p.active,false) AS active,
        COALESCE(p.stock-p.reserved,0) AS available_stock,
        COALESCE(s.units,0) AS units, COALESCE(s.revenue,0) AS revenue,
        COALESCE(s.orders,0) AS orders, COALESCE(s.previous_units,0) AS previous_units,
        COALESCE(s.previous_revenue,0) AS previous_revenue
      FROM products p FULL OUTER JOIN sales s ON p.id=s.product_id
      LEFT JOIN categories c ON c.id=p.category_id
    )
    SELECT jsonb_build_object(
      'orders', (SELECT count(*) FROM period_orders WHERE current_period),
      'previousOrders', (SELECT count(*) FROM period_orders WHERE NOT current_period),
      'products', COALESCE((SELECT jsonb_agg(to_jsonb(catalog) ORDER BY units DESC, revenue DESC, key) FROM catalog),'[]'::jsonb)
    ) AS result
  `, [now.toISOString(), days]);
  const result = rows[0].result;
  const units = result.products.reduce((sum, p) => sum + Number(p.units), 0);
  const revenue = round(result.products.reduce((sum, p) => sum + Number(p.revenue), 0));
  const previousUnits = result.products.reduce((sum, p) => sum + Number(p.previous_units), 0);
  const previousRevenue = round(result.products.reduce((sum, p) => sum + Number(p.previous_revenue), 0));
  const products = result.products.map((p) => {
    const sold = Number(p.units);
    const previous = Number(p.previous_units);
    const availableStock = Number(p.available_stock);
    const share = units ? round(sold / units * 100) : 0;
    const growth = change(sold, previous);
    const stockDays = sold ? round(availableStock * days / sold) : null;
    const suggestedRestock = p.active && sold ? Math.max(0, Math.ceil(sold * 14 / days) - availableStock) : 0;
    let recommendation;
    if (!p.active) recommendation = { code: 'inactive', title: 'Позиція прихована', reason: sold ? 'Товар продавався. Перевірте можливість повернення в каталог.' : 'Продажі збережено в історії; товар недоступний у каталозі.' };
    else if (suggestedRestock > 0) recommendation = { code: 'restock', title: `Поповнити на ${suggestedRestock} шт.`, reason: `Вільний запас: ${availableStock} шт. За темпу ${sold} шт. за ${days} днів цього замало на наступні 14 днів.` };
    else if (growth !== null && growth >= 25) recommendation = { code: 'growing', title: 'Попит зростає', reason: `Продано на ${growth}% більше, ніж за попередні ${days} днів. Підтримуйте запас і видимість товару.` };
    else if (share >= 20) recommendation = { code: 'promote', title: 'Товар у попиті', reason: `${share}% усіх проданих одиниць. Рекомендуйте покупцям і підтримуйте наявність.` };
    else if (sold > 0) recommendation = { code: 'observe', title: 'Підтримувати асортимент', reason: `Товар купили у ${p.orders} виконаних замовленнях. Продовжуйте стежити за продажами.` };
    else recommendation = { code: 'no_sales', title: 'Перевірити пропозицію', reason: `За ${days} днів немає виконаних продажів. Перевірте ціну, опис і наявність; це ще не доводить відсутність попиту.` };
    return {
      key: p.key, productId: p.product_id, name: p.name, sku: p.sku, category: p.category, active: p.active,
      units: sold, revenue: Number(p.revenue), orders: Number(p.orders), previousUnits: previous,
      growthPercent: growth, sharePercent: share, availableStock, stockDays, suggestedRestock,
      demand: share >= 20 ? 'high' : sold > 0 ? 'medium' : 'none', recommendation,
    };
  });
  const categories = [];
  for (const p of products.filter((item) => item.units > 0)) {
    let category = categories.find((item) => item.name === p.category);
    if (!category) { category = { name: p.category, units: 0, revenue: 0, sharePercent: 0 }; categories.push(category); }
    category.units += p.units; category.revenue = round(category.revenue + p.revenue);
  }
  categories.forEach((c) => { c.sharePercent = units ? round(c.units / units * 100) : 0; });
  categories.sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, 'uk'));
  return {
    period: { days, from: new Date(now.getTime()-days*86400000).toISOString(), to: now.toISOString() },
    summary: {
      orders: Number(result.orders), units, revenue, productsSold: products.filter((p) => p.units > 0).length,
      previousOrders: Number(result.previousOrders), previousUnits, previousRevenue,
      growthPercent: change(units, previousUnits), restockProducts: products.filter((p) => p.suggestedRestock > 0).length,
    },
    products, categories,
  };
}

export const analyticsRouter = Router();
analyticsRouter.get('/analytics', requireRole('admin', 'catalog_manager', 'order_manager'), async (req, res) => {
  const { days } = z.object({ days: z.enum(['7','30','90']).default('30') }).strict().parse(req.query);
  res.set('Cache-Control', 'no-store');
  res.json({ data: await getProductAnalytics(pool, Number(days)) });
});
