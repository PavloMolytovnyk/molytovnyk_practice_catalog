import { ArrowLeft, Check, ChevronRight, Heart, PackageCheck, ShieldCheck, ShoppingBag, Star, Truck } from 'lucide-react';
import { useState } from 'react';
import { ProductArtwork } from '../components/ProductArtwork';
import { QuantityControl } from '../components/QuantityControl';
import { SalesPopularity } from '../components/SalesPopularity';
import { useStore } from '../context/StoreContext';

const formatPrice = (value: number) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;

export function ProductPage({ productId, navigate }: { productId: string; navigate: (path: string) => void }) {
  const { products, loading, addToCart, favorites, toggleFavorite } = useStore();
  const [quantity, setQuantity] = useState(1);
  const product = products.find((item) => item.id === productId);

  if (loading) return <main className="page-main"><div className="container product-detail-skeleton" /></main>;
  if (!product) {
    return <main className="page-main"><div className="container empty-state"><h1>Товар не знайдено</h1><button className="button primary" onClick={() => navigate('/catalog')}>Повернутися до каталогу</button></div></main>;
  }
  const isFavorite = favorites.includes(product.id);

  return (
    <main className="page-main product-page">
      <div className="container">
        <div className="breadcrumbs"><button onClick={() => navigate('/')}>Головна</button><ChevronRight size={14} /><button onClick={() => navigate('/catalog')}>Каталог</button><ChevronRight size={14} /><span>{product.name}</span></div>
        <button className="back-link mobile-only" onClick={() => navigate('/catalog')}><ArrowLeft size={17} />Назад до каталогу</button>
        <div className="product-detail-grid">
          <div className="product-gallery">
            <div className="product-main-art"><ProductArtwork product={product} /></div>
          </div>
          <div className="product-info">
            <div className="product-info-topline"><span>{product.category}</span><span>Артикул {product.sku}</span></div>
            <h1>{product.name}</h1>
            <div className="detail-rating"><span><Star size={16} fill="currentColor" />{product.rating}</span><span>{product.reviews} відгуків</span></div>
            <SalesPopularity product={product} />
            <p className="detail-description">{product.description}</p>
            <ul className="feature-list">{product.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>
            <div className="detail-purchase-card">
              <div className="detail-price"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div>
              <span className="stock-status"><span />{product.stock ? `В наявності: ${product.stock} шт.` : 'Немає в наявності'}</span>
              <div className="detail-controls">
                <QuantityControl value={quantity} max={product.stock} onChange={setQuantity} />
                <button className="button primary grow" disabled={product.stock < 1} onClick={() => addToCart(product.id, quantity)}><ShoppingBag size={18} />Додати до кошика</button>
                <button className={`icon-button detail-favorite ${isFavorite ? 'active' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label="Додати в обране"><Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} /></button>
              </div>
            </div>
            <div className="service-list">
              <div><Truck size={21} /><span><strong>Доставка 1–3 дні</strong><small>Нова пошта або кур’єр</small></span></div>
              <div><ShieldCheck size={21} /><span><strong>12 місяців гарантії</strong><small>Офіційний сервіс</small></span></div>
              <div><PackageCheck size={21} /><span><strong>Перевірка при отриманні</strong><small>Оплачуйте після огляду</small></span></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
