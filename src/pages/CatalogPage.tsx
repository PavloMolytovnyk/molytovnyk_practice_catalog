import { ChevronDown, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { useStore } from '../context/StoreContext';
import type { Category } from '../types';

const categories: Array<'Усі' | Category> = ['Усі', 'Аудіо', 'Гаджети', 'Дім', 'Подорожі'];

function paramsFromHash() {
  if (typeof window === 'undefined') return new URLSearchParams();
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

export function CatalogPage({ navigate }: { navigate: (path: string) => void }) {
  const { products, favorites, loading } = useStore();
  const params = paramsFromHash();
  const initialCategory = params.get('category');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'Усі' | Category>(categories.includes(initialCategory as Category) ? (initialCategory as Category) : 'Усі');
  const [sort, setSort] = useState('popular');
  const [inStock, setInStock] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(params.get('favorites') === '1');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get('focus') === 'search') window.setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('uk-UA');
    return products
      .filter((product) => category === 'Усі' || product.category === category)
      .filter((product) => !inStock || product.stock > 0)
      .filter((product) => !favoritesOnly || favorites.includes(product.id))
      .filter((product) =>
        !normalized || `${product.name} ${product.sku} ${product.shortDescription}`.toLocaleLowerCase('uk-UA').includes(normalized),
      )
      .sort((a, b) => {
        if (sort === 'price-asc') return a.price - b.price;
        if (sort === 'price-desc') return b.price - a.price;
        if (sort === 'new') return b.createdAt.localeCompare(a.createdAt);
        if (sort === 'rating') return b.rating - a.rating;
        return b.soldCount - a.soldCount || a.id.localeCompare(b.id);
      });
  }, [products, category, inStock, favoritesOnly, favorites, search, sort]);

  const clearFilters = () => {
    setSearch('');
    setCategory('Усі');
    setSort('popular');
    setInStock(true);
    setFavoritesOnly(false);
  };

  return (
    <main className="page-main catalog-page">
      <div className="container">
        <div className="page-header split-page-header">
          <div><span className="section-kicker">Каталог FORMA</span><h1>Знайдіть свою річ</h1><p>Пошук, фільтри й актуальна наявність в одному місці.</p></div>
          <div className="catalog-count"><strong>{filtered.length}</strong><span>товарів<br />знайдено</span></div>
        </div>

        <section className="catalog-toolbar" aria-label="Пошук і сортування">
          <label className="search-field">
            <Search size={19} />
            <span className="sr-only">Пошук товарів</span>
            <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пошук за назвою або артикулом" />
            {search && <button onClick={() => setSearch('')} aria-label="Очистити пошук"><X size={17} /></button>}
          </label>
          <label className="select-field">
            <SlidersHorizontal size={18} />
            <span className="sr-only">Сортування</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="popular">Найбільше купують</option>
              <option value="rating">За оцінкою відгуків</option>
              <option value="new">Спочатку нові</option>
              <option value="price-asc">Ціна: від меншої</option>
              <option value="price-desc">Ціна: від більшої</option>
            </select>
            <ChevronDown size={17} />
          </label>
        </section>

        <div className="filter-row">
          <div className="category-pills" role="group" aria-label="Категорії">
            {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="inline-toggles">
            <label className="switch-label"><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /><span className="switch" />У наявності</label>
            <button className={`favorite-filter ${favoritesOnly ? 'active' : ''}`} onClick={() => setFavoritesOnly((value) => !value)}><Heart size={17} fill={favoritesOnly ? 'currentColor' : 'none'} />Обрані</button>
          </div>
        </div>

        {loading ? (
          <div className="product-grid catalog-grid">{Array.from({ length: 8 }).map((_, index) => <div className="product-card skeleton-card" key={index} />)}</div>
        ) : filtered.length ? (
          <div className="product-grid catalog-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} navigate={navigate} />)}</div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Search size={30} /></div>
            <h2>Нічого не знайдено</h2>
            <p>Спробуйте змінити запит або скинути активні фільтри.</p>
            <button className="button primary" onClick={clearFilters}>Скинути фільтри</button>
          </div>
        )}
      </div>
    </main>
  );
}
