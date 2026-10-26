import { BarChart3, Box, Check, ChevronDown, CircleDollarSign, Edit3, Loader2, PackageSearch, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { ProductArtwork } from '../components/ProductArtwork';
import { ProductAnalyticsPanel } from '../components/ProductAnalyticsPanel';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import type { Category, Product } from '../types';

const money = (value: number) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const categories: Category[] = ['Аудіо', 'Гаджети', 'Дім', 'Подорожі'];

type ProductDraft = Pick<Product, 'id' | 'name' | 'sku' | 'category' | 'price' | 'stock' | 'shortDescription'>;

const emptyDraft: ProductDraft = {
  id: '',
  name: '',
  sku: '',
  category: 'Гаджети',
  price: 0,
  stock: 0,
  shortDescription: '',
};

export function AdminPage() {
  const { adminProducts: products, adminOrders: orders, user, saveProduct, deleteProduct, changeStatus } = useStore();
  const [tab, setTab] = useState<'products' | 'orders' | 'analytics'>(user?.role === 'order_manager' ? 'orders' : 'products');
  const [operationError, setOperationError] = useState('');
  const [statusNote, setStatusNote] = useState<Record<string,string>>({});
  const [workingOrder, setWorkingOrder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductDraft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase('uk-UA').trim();
    return products.filter((product) => !normalized || `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase('uk-UA').includes(normalized));
  }, [products, query]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setDraft({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      stock: product.stock,
      shortDescription: product.shortDescription,
    });
    setErrors({});
    setModalOpen(true);
  };

  const openAnalyticsProduct = async (id: string) => {
    try {
      const latest = await api.adminProducts();
      const product = latest.find((item) => item.id === id);
      if (!product) throw new Error('Товар більше не існує. Оновіть аналітику.');
      setOperationError('');
      openEdit(product);
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : 'Не вдалося отримати актуальні дані товару.');
    }
  };

  const updateDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (draft.name.trim().length < 3) nextErrors.name = 'Назва має містити щонайменше 3 символи.';
    if (!draft.sku.trim()) nextErrors.sku = 'Вкажіть унікальний артикул.';
    if (draft.price <= 0) nextErrors.price = 'Ціна повинна бути більшою за нуль.';
    if (draft.stock < 0 || !Number.isInteger(draft.stock)) nextErrors.stock = 'Залишок має бути цілим невід’ємним числом.';
    if (draft.shortDescription.trim().length < 10) nextErrors.shortDescription = 'Додайте короткий опис (від 10 символів).';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const original = products.find((item) => item.id === draft.id);
    const product: Product = {
      id: draft.id,
      name: draft.name.trim(),
      sku: draft.sku.trim().toUpperCase(),
      category: draft.category,
      price: draft.price,
      stock: draft.stock,
      shortDescription: draft.shortDescription.trim(),
      description: original?.description ?? draft.shortDescription.trim(),
      features: original?.features ?? ['Офіційна гарантія', 'Перевірка перед відправленням'],
      art: original?.art ?? 'powerbank',
      color: original?.color ?? '#d5e6ff',
      accent: original?.accent ?? '#3f7ad7',
      rating: original?.rating ?? 5,
      reviews: original?.reviews ?? 0,
      popularity: original?.popularity ?? 0,
      soldCount: original?.soldCount ?? 0,
      salesRank: original?.salesRank ?? null,
      popularityScore: original?.popularityScore ?? 0,
      createdAt: original?.createdAt ?? new Date().toISOString().slice(0, 10),
      badge: original?.badge,
      oldPrice: original?.oldPrice,
    };
    setSaving(true);
    try {
      await saveProduct(product);
      setModalOpen(false);
      setOperationError('');
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : 'Не вдалося зберегти товар.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteProduct(deleteTarget.id); setDeleteTarget(null); setOperationError(''); }
    catch (cause) { setOperationError(cause instanceof Error ? cause.message : 'Не вдалося приховати товар.'); }
  };
  const restoreProduct = async (product: Product) => {
    try { await saveProduct({ ...product, active: true }); setOperationError(''); }
    catch (cause) { setOperationError(cause instanceof Error ? cause.message : 'Не вдалося відновити товар.'); }
  };

  const completedRevenue = orders.filter((order) => order.status === 'Виконане').reduce((sum, order) => sum + order.total, 0);
  const advance = async (id: string, status: string) => {
    setWorkingOrder(id); setOperationError('');
    try { await changeStatus(id,status,statusNote[id] ?? ''); }
    catch (cause) { setOperationError(cause instanceof Error ? cause.message : 'Не вдалося змінити статус.'); }
    finally { setWorkingOrder(null); }
  };

  return (
    <main className="admin-page">
      <div className="container admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-title"><span className="brand-mark">F</span><div><strong>FORMA</strong><small>Керування</small></div></div>
          <nav aria-label="Адміністративна навігація">
            {(user?.role === 'admin' || user?.role === 'catalog_manager') && <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><Box size={18} />Товари<span>{products.length}</span></button>}
            {(user?.role === 'admin' || user?.role === 'order_manager') && <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ShoppingCart size={18} />Замовлення<span>{orders.length}</span></button>}
            <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}><BarChart3 size={18} />Аналітика</button>
          </nav>
          <div className="admin-user"><div>{user?.firstName[0]}{user?.lastName[0]}</div><span><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.role}</small></span><ChevronDown size={16} /></div>
        </aside>

        <section className="admin-content">
          <div className="admin-header"><div><span className="section-kicker">Адміністрування</span><h1>{tab === 'products' ? 'Керування товарами' : tab === 'analytics' ? 'Аналітика товарів' : 'Опрацювання замовлень'}</h1><p>{tab === 'products' ? 'Актуалізуйте каталог, ціни та залишки.' : tab === 'analytics' ? 'Дізнавайтеся, що купують, і плануйте запаси за реальними продажами.' : 'Перевіряйте склад і змінюйте статус за дозволеним маршрутом.'}</p></div>{tab === 'products' && <button className="button primary" onClick={openCreate}><Plus size={18} />Додати товар</button>}</div>
          {operationError && <div className="server-error" role="alert">{operationError}</div>}

          {tab !== 'analytics' && <div className="admin-stats">
            <div><span className="stat-icon purple"><Box size={21} /></span><span><small>Активних товарів</small><strong>{products.filter((item) => item.active).length}</strong><em>Каталог</em></span></div>
            <div><span className="stat-icon green"><PackageSearch size={21} /></span><span><small>Закінчуються</small><strong>{products.filter((item) => item.stock <= 8).length}</strong><em>Потрібна увага</em></span></div>
            <div><span className="stat-icon blue"><ShoppingCart size={21} /></span><span><small>Замовлень</small><strong>{orders.length}</strong><em>У базі даних</em></span></div>
            <div><span className="stat-icon coral"><CircleDollarSign size={21} /></span><span><small>Виконані продажі</small><strong>{money(completedRevenue)}</strong><em>За весь період</em></span></div>
          </div>}

          {tab === 'analytics' ? <ProductAnalyticsPanel onEditProduct={openAnalyticsProduct} /> : tab === 'products' ? <div className="admin-panel">
            <div className="admin-panel-heading"><div><h2>Каталог товарів</h2><p>Знайдено {filtered.length} позицій</p></div><label className="admin-search"><Search size={17} /><span className="sr-only">Пошук товарів</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Назва або артикул" /></label></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Товар</th><th>Категорія</th><th>Ціна</th><th>Залишок</th><th>Статус</th><th><span className="sr-only">Дії</span></th></tr></thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id}>
                      <td data-label="Товар"><div className="table-product"><ProductArtwork product={product} /><span><strong>{product.name}</strong><small>{product.sku}</small></span></div></td>
                      <td data-label="Категорія">{product.category}</td>
                      <td data-label="Ціна"><strong>{money(product.price)}</strong></td>
                      <td data-label="Залишок"><span className={product.stock <= 8 ? 'low-stock' : ''}>{product.stock} шт.</span></td>
                      <td data-label="Статус"><span className={`status-chip ${product.active ? 'done' : 'new'}`}><Check size={13} />{product.active ? 'Активний' : 'Прихований'}</span></td>
                      <td data-label="Дії"><div className="table-actions">{product.active ? <><button onClick={() => openEdit(product)} aria-label={`Редагувати ${product.name}`}><Edit3 size={17} /></button><button className="danger" onClick={() => setDeleteTarget(product)} aria-label={`Приховати ${product.name}`}><Trash2 size={17} /></button></> : <button onClick={() => restoreProduct(product)} aria-label={`Відновити ${product.name}`}>Відновити</button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div> : <div className="admin-panel"><div className="admin-panel-heading"><div><h2>Замовлення</h2><p>{orders.length} записів</p></div></div><div className="admin-orders-list">{orders.map((order) => {
            const next = ({ 'Нове':'Підтверджене','Підтверджене':'Комплектується','Комплектується':'Відправлене','Відправлене':'Виконане' } as Record<string,string>)[order.status];
            return <article className="admin-order" key={order.id}><div><strong>{order.number}</strong><span>{order.customer.firstName} {order.customer.lastName} · {order.customer.phone}</span><small>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</small><small>{order.delivery}, {order.city}, {order.branch} · {money(order.total)}</small></div><div><span className="status-chip shipped">{order.status}</span>{next && <button className="button primary compact-button" disabled={workingOrder === order.id} onClick={() => advance(order.id,next)}>{next}</button>}{!['Скасоване','Виконане'].includes(order.status) && <><input aria-label={`Причина скасування ${order.number}`} placeholder="Причина скасування" value={statusNote[order.id] ?? ''} onChange={(event) => setStatusNote((current) => ({ ...current,[order.id]:event.target.value }))} /><button className="button ghost compact-button" disabled={workingOrder === order.id || (statusNote[order.id] ?? '').trim().length < 3} onClick={() => advance(order.id,'Скасоване')}>Скасувати</button></>}</div></article>;
          })}{!orders.length && <p className="admin-empty">Замовлень ще немає.</p>}</div></div>}
        </section>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModalOpen(false)}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className="modal-header"><div><span className="section-kicker">Каталог</span><h2 id="product-modal-title">{draft.id ? 'Редагувати товар' : 'Новий товар'}</h2></div><button onClick={() => setModalOpen(false)} aria-label="Закрити"><X size={20} /></button></div>
            <form onSubmit={submitProduct} noValidate>
              <div className="form-grid two-cols">
                <label className="span-two">Назва товару<input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="Наприклад, Підставка Desk Pro" aria-invalid={!!errors.name} />{errors.name && <small className="field-error">{errors.name}</small>}</label>
                <label>Артикул<input value={draft.sku} onChange={(event) => updateDraft('sku', event.target.value)} placeholder="FRM-DP-001" aria-invalid={!!errors.sku} />{errors.sku && <small className="field-error">{errors.sku}</small>}</label>
                <label>Категорія<select value={draft.category} onChange={(event) => updateDraft('category', event.target.value as Category)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Ціна, ₴<input type="number" min="1" value={draft.price || ''} onChange={(event) => updateDraft('price', Number(event.target.value))} aria-invalid={!!errors.price} />{errors.price && <small className="field-error">{errors.price}</small>}</label>
                <label>Залишок, шт.<input type="number" min="0" step="1" value={draft.stock} onChange={(event) => updateDraft('stock', Number(event.target.value))} aria-invalid={!!errors.stock} />{errors.stock && <small className="field-error">{errors.stock}</small>}</label>
                <label className="span-two">Короткий опис<textarea rows={3} value={draft.shortDescription} onChange={(event) => updateDraft('shortDescription', event.target.value)} placeholder="Коротко опишіть головну користь товару" aria-invalid={!!errors.shortDescription} />{errors.shortDescription && <small className="field-error">{errors.shortDescription}</small>}</label>
              </div>
              {operationError && <div className="server-error" role="alert">{operationError}</div>}
              <div className="modal-actions"><button type="button" className="button ghost" onClick={() => setModalOpen(false)}>Скасувати</button><button className="button primary" disabled={saving}>{saving ? <><Loader2 size={17} className="spin" />Збереження…</> : <><Check size={17} />Зберегти товар</>}</button></div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop">
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="confirm-icon"><Trash2 size={23} /></div><h2 id="delete-title">Приховати товар?</h2><p>«{deleteTarget.name}» зникне з публічного каталогу. Історія замовлень збережеться.</p>
            <div><button className="button ghost" onClick={() => setDeleteTarget(null)}>Залишити</button><button className="button danger-button" onClick={confirmDelete}>Приховати</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
