// Count units from completed orders once, regardless of status-history entries.
// Rank and score use the whole active catalog before search or pagination.
export const productSalesSelect = `WITH completed_sales AS (
  SELECT i.product_id, sum(i.quantity)::bigint AS sold_count
  FROM order_items i JOIN orders o ON o.id=i.order_id
  WHERE o.status='Виконане' AND i.product_id IS NOT NULL
  GROUP BY i.product_id
), sales_ranking AS (
  SELECT p.id, s.sold_count,
    dense_rank() OVER (ORDER BY s.sold_count DESC) AS sales_rank,
    round(5.0*s.sold_count/max(s.sold_count) OVER (),2) AS popularity_score
  FROM products p JOIN completed_sales s ON s.product_id=p.id
  WHERE p.active=true AND s.sold_count>0
)
SELECT p.*, c.name AS category, COALESCE(s.sold_count,0) AS sold_count,
  r.sales_rank, COALESCE(r.popularity_score,0) AS popularity_score
FROM products p JOIN categories c ON c.id=p.category_id
LEFT JOIN completed_sales s ON s.product_id=p.id
LEFT JOIN sales_ranking r ON r.id=p.id`;
