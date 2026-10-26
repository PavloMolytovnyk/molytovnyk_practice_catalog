import { ArrowUpRight, Heart, ShoppingBag, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { Product } from '../types';
import { ProductArtwork } from './ProductArtwork';
import { SalesPopularity } from './SalesPopularity';

const formatPrice = (value: number) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;

export function ProductCard({ product, navigate }: { product: Product; navigate: (path: string) => void }) {
  const { addToCart, favorites, toggleFavorite } = useStore();
  const isFavorite = favorites.includes(product.id);
  return (
    <article className="product-card">
      <div className="product-card-media">
        <button className={`favorite-button ${isFavorite ? 'active' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label={isFavorite ? 'Видалити з обраного' : 'Додати до обраного'}>
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button className="art-button" onClick={() => navigate(`/product/${product.id}`)} aria-label={`Відкрити ${product.name}`}>
          <ProductArtwork product={product} />
        </button>
      </div>
      <div className="product-card-body">
        <div className="product-meta-row">
          <span>{product.category}</span>
          <span className="rating" title="Оцінка за відгуками" aria-label={`Оцінка за відгуками: ${product.rating}`}><Star size={14} fill="currentColor" />{product.rating}</span>
        </div>
        <button className="product-name" onClick={() => navigate(`/product/${product.id}`)}>
          {product.name}<ArrowUpRight size={16} />
        </button>
        <p>{product.shortDescription}</p>
        <SalesPopularity product={product} />
        <div className="product-card-footer">
          <div className="price-wrap">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
          </div>
          <button className="add-icon-button" onClick={() => addToCart(product.id)} aria-label={`Додати ${product.name} до кошика`} disabled={product.stock === 0}>
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
