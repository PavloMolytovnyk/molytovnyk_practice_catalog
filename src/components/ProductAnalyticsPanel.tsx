import { BarChart3, Box, CircleDollarSign, Loader2, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import type { AnalyticsPeriod, ProductAnalytics } from '../types';

const money = (value: number) => `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)} ₴`;
const trend = (current: number, previous: number, percent: number | null) => percent === null
  ? current > 0 ? 'Раніше 0 шт.' : 'Немає продажів'
  : `${percent > 0 ? '+' : ''}${percent}% · раніше ${previous} шт.`;
const demandLabels = { high: 'Високий', medium: 'Є продажі', none: 'Немає продажів' };

export function ProductAnalyticsPanel({ onEditProduct }: { onEditProduct: (id: string) => void }) {
  const { user, adminProducts, adminOrders } = useStore();
  const [days, setDays] = useState<AnalyticsPeriod>(30);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'units' | 'revenue' | 'restock'>('units');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError(''); setData(null);
    api.analytics(days, controller.signal).then((result) => {
      if (active) setData(result);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Не вдалося завантажити аналітику.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [days, refresh, user?.id, adminProducts, adminOrders]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('uk-UA');
    const rows = (data?.products ?? []).filter((p) => !term || `${p.name} ${p.sku} ${p.category}`.toLocaleLowerCase('uk-UA').includes(term));
    return rows.sort((a, b) => (sort === 'restock' ? b.suggestedRestock-a.suggestedRestock : b[sort]-a[sort]) || b.units-a.units || a.name.localeCompare(b.name, 'uk'));
  }, [data, query, sort]);
  const bestsellers = (data?.products ?? []).filter((p) => p.units > 0).slice(0, 5);
  const canEdit = user?.role === 'admin' || user?.role === 'catalog_manager';
  const recommendations = (data?.products ?? []).filter((p) => p.units > 0 && p.active)
    .sort((a, b) => b.suggestedRestock-a.suggestedRestock || b.units-a.units).slice(0, 3);

  return <section className="analytics" aria-label="Аналітика товарів" aria-busy={loading}>
    <div className="analytics-toolbar">
      <div className="analytics-period" role="group" aria-label="Період аналітики">
        {([7, 30, 90] as const).map((value) => <button key={value} aria-pressed={days === value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>{value} днів</button>)}
      </div>
      <button className="button ghost compact-button" disabled={loading} onClick={() => setRefresh((value) => value+1)}><RefreshCw size={16} />Оновити дані</button>
    </div>
    <p className="analytics-note">Враховано лише виконані замовлення за датою виконання. Виручка — вартість товарів під час покупки, без доставки. Запаси — вільні одиниці після резервування.</p>
    {loading && <div className="analytics-state" role="status"><Loader2 size={24} className="spin" /><p>Обчислюємо попит за покупками…</p></div>}
    {error && <div className="analytics-state"><p className="server-error" role="alert">{error}</p><button className="button primary" onClick={() => setRefresh((value) => value+1)}>Спробувати ще раз</button></div>}
    {data && <>
      <div className="admin-stats analytics-stats">
        <div><span className="stat-icon purple"><Box size={21} /></span><span><small>Продано одиниць</small><strong>{data.summary.units}</strong><em>{trend(data.summary.units, data.summary.previousUnits, data.summary.growthPercent)}</em></span></div>
        <div><span className="stat-icon coral"><CircleDollarSign size={21} /></span><span><small>Виручка від товарів</small><strong>{money(data.summary.revenue)}</strong><em>Раніше {money(data.summary.previousRevenue)}</em></span></div>
        <div><span className="stat-icon blue"><ShoppingCart size={21} /></span><span><small>Виконано замовлень</small><strong>{data.summary.orders}</strong><em>Раніше {data.summary.previousOrders}</em></span></div>
        <div><span className="stat-icon green"><TrendingUp size={21} /></span><span><small>Потрібно поповнити</small><strong>{data.summary.restockProducts}</strong><em>{data.summary.productsSold} позицій із продажами</em></span></div>
      </div>
      {!data.summary.units ? <div className="admin-panel analytics-state"><BarChart3 size={30} /><h2>Ще немає виконаних продажів</h2><p>За обрані {days} днів немає покупок для визначення популярних товарів. Після переведення замовлення у статус «Виконане» статистика оновиться. Можна також обрати довший період.</p></div> : <div className="analytics-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Найпопулярніші товари</h2><p>Рейтинг за кількістю проданих одиниць</p></div><BarChart3 size={20} /></div>
          <ol className="analytics-ranking">{bestsellers.map((p, index) => <li key={p.key}>
            <div className="analytics-rank-heading"><span><b>{index+1}.</b> {p.name}{!p.active && <small> · прихований</small>}</span><strong>{p.units} шт.</strong></div>
            <div className="analytics-bar" aria-hidden="true"><span style={{ width: `${p.units / bestsellers[0].units * 100}%` }} /></div>
            <small>{p.sharePercent}% продажів · {money(p.revenue)}</small>
          </li>)}</ol>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Рекомендовані дії</h2><p>За продажами й актуальним залишком</p></div><TrendingUp size={20} /></div>
          <div className="analytics-recommendations">{recommendations.map((p) => <article key={p.key}>
            <span className={`analytics-action ${p.recommendation.code}`}>{p.recommendation.title}</span><h3>{p.name}</h3><p>{p.recommendation.reason}</p>
            {canEdit && p.productId && <button className="analytics-edit" onClick={() => onEditProduct(p.productId!)}>Переглянути товар →</button>}
          </article>)}{!recommendations.length && <p className="admin-empty">Продані позиції приховані або видалені. Перевірте їх у таблиці нижче.</p>}</div>
        </section>
        <section className="admin-panel analytics-categories">
          <div className="admin-panel-heading"><div><h2>Попит за категоріями</h2><p>Частка від усіх проданих одиниць</p></div></div>
          <div className="analytics-category-list">{data.categories.map((category) => <div key={category.name}><span>{category.name}</span><div className="analytics-bar" aria-hidden="true"><span style={{ width: `${category.sharePercent}%` }} /></div><strong>{category.sharePercent}%</strong><small>{category.units} шт.</small></div>)}</div>
        </section>
      </div>}
      <section className="admin-panel analytics-details">
        <div className="admin-panel-heading"><div><h2>Попит і залишки</h2><p>Високий попит: від 20% проданих одиниць за період</p></div></div>
        <div className="analytics-table-controls">
          <label>Пошук товару<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Назва, артикул, категорія" /></label>
          <label>Сортування<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="units">За кількістю продажів</option><option value="revenue">За виручкою</option><option value="restock">За потребою поповнення</option></select></label>
        </div>
        <div className="admin-table-wrap"><table className="admin-table analytics-table">
          <thead><tr><th>Товар</th><th>Продано / виручка</th><th>Попит / зміна</th><th>Вільний запас</th><th>Рекомендація</th></tr></thead>
          <tbody>{filtered.map((p) => <tr key={p.key}>
            <td data-label="Товар"><strong>{p.name}</strong><small>{p.sku} · {p.category}{!p.active ? ' · прихований / видалений' : ''}</small></td>
            <td data-label="Продажі"><div><strong>{p.units} шт.</strong><small>{money(p.revenue)} · {p.orders} зам.</small></div></td>
            <td data-label="Попит"><div><span className={`analytics-demand ${p.demand}`}>{demandLabels[p.demand]}</span><small>{trend(p.units, p.previousUnits, p.growthPercent)}</small></div></td>
            <td data-label="Вільний запас"><div><strong className={p.suggestedRestock ? 'low-stock' : ''}>{p.availableStock} шт.</strong><small>{p.stockDays === null ? 'Темп ще невідомий' : `≈ ${p.stockDays} дн. за поточного темпу`}</small></div></td>
            <td data-label="Рекомендація"><div><span className={`analytics-action ${p.recommendation.code}`}>{p.recommendation.title}</span><p>{p.recommendation.reason}</p>{canEdit && p.productId && <button className="analytics-edit" onClick={() => onEditProduct(p.productId!)}>Редагувати товар →</button>}</div></td>
          </tr>)}</tbody>
        </table>{!filtered.length && <p className="admin-empty">За цим пошуком товарів немає.</p>}</div>
      </section>
      <p className="analytics-note">Дані станом на {new Date(data.period.to).toLocaleString('uk-UA')}. Порівняння — з попередніми {days} днями. Поповнення = запас на 14 днів за середнім темпом продажів мінус вільний залишок. Це орієнтир, а не гарантія майбутнього попиту.</p>
    </>}
  </section>;
}
