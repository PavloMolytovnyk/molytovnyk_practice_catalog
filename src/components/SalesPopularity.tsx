import { TrendingUp } from 'lucide-react';
import type { Product } from '../types';

export function SalesPopularity({ product }: { product: Product }) {
  return (
    <div className="sales-popularity">
      <div className="sales-popularity-heading">
        <span><TrendingUp size={14} />{product.salesRank ? `№${product.salesRank} за продажами` : 'Ще немає продажів'}</span>
        <strong aria-label={`Популярність ${product.popularityScore} з 5`}>{product.popularityScore.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}/5</strong>
      </div>
      <div className="sales-score-bar" aria-hidden="true"><span style={{ width: `${product.popularityScore / 5 * 100}%` }} /></div>
      <small>Куплено {product.soldCount.toLocaleString('uk-UA')} шт. · за весь час</small>
    </div>
  );
}
