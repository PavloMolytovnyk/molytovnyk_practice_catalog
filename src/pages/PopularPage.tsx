import { ArrowRight, RefreshCw, Trophy } from 'lucide-react';
import { ProductArtwork } from '../components/ProductArtwork';
import { SalesPopularity } from '../components/SalesPopularity';
import { useStore } from '../context/StoreContext';

export function PopularPage({ navigate }: { navigate: (path: string) => void }) {
  const { products, reload } = useStore();
  const ranked = products.filter((p) => p.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount || a.id.localeCompare(b.id));
  return (
    <main className="page-main sales-ranking-page">
      <div className="container">
        <div className="page-header split-page-header">
          <div><span className="section-kicker">Вибір покупців</span><h1>Рейтинг продажів</h1><p>Товари з найбільшою кількістю куплених одиниць за весь час.</p></div>
          <button className="button ghost" onClick={reload}><RefreshCw size={17} />Оновити</button>
        </div>
        <div className="sales-ranking-note"><Trophy size={24} /><div><strong>Лідер отримує 5/5</strong><p>Бал = кількість куплених одиниць ÷ продажі лідера × 5. Однакова кількість дає однакове місце. Це показник популярності, а оцінки за відгуками показані окремо в каталозі.</p><small>Враховуємо виконані замовлення всіх покупців, включно з гостями. Скасовані й незавершені замовлення не впливають на рейтинг.</small></div></div>
        {ranked.length ? (
          <ol className="sales-ranking-list" aria-label="Товари за кількістю продажів">
            {ranked.map((product) => (
              <li className="sales-ranking-item" key={product.id}>
                <span className={`sales-rank ${product.salesRank === 1 ? 'leader' : ''}`} aria-label={`Місце ${product.salesRank}`}>№{product.salesRank}</span>
                <button className="sales-ranking-art" onClick={() => navigate(`/product/${product.id}`)} aria-label={`Відкрити ${product.name}`}><ProductArtwork product={product} /></button>
                <div className="sales-ranking-description"><span>{product.category}</span><button onClick={() => navigate(`/product/${product.id}`)}>{product.name}<ArrowRight size={16} /></button><small>{product.stock > 0 ? 'У наявності' : 'Немає в наявності'}</small></div>
                <SalesPopularity product={product} />
                <button className="button ghost compact-button" onClick={() => navigate(`/product/${product.id}`)}>Переглянути</button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state"><Trophy size={36} /><h2>Поки що немає продажів</h2><p>Після виконання першого замовлення тут з’явиться рейтинг. Товари без продажів мають 0/5 і не отримують місця в топі.</p><button className="button primary" onClick={() => navigate('/catalog')}>Переглянути каталог</button></div>
        )}
      </div>
    </main>
  );
}
