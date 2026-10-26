import { ArrowLeft, ArrowRight, Check, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { ProductArtwork } from '../components/ProductArtwork';
import { QuantityControl } from '../components/QuantityControl';
import { useStore } from '../context/StoreContext';

const money = (value: number) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;

export function CartPage({ navigate }: { navigate: (path: string) => void }) {
  const { cartDetails, cartTotal, updateQuantity, removeFromCart } = useStore();
  const delivery = cartTotal >= 2500 ? 0 : 120;
  const unavailable = cartDetails.some(({ product,quantity }) => quantity > product.stock || product.stock === 0);

  if (!cartDetails.length) {
    return (
      <main className="page-main">
        <div className="container cart-empty empty-state">
          <div className="empty-icon large"><ShoppingBag size={36} /></div>
          <span className="section-kicker">Ваш кошик</span>
          <h1>Тут поки що порожньо</h1>
          <p>Додайте товари з каталогу — вони збережуться навіть після оновлення сторінки.</p>
          <button className="button primary" onClick={() => navigate('/catalog')}>Перейти до каталогу<ArrowRight size={18} /></button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main cart-page">
      <div className="container">
        <button className="back-link" onClick={() => navigate('/catalog')}><ArrowLeft size={17} />Продовжити покупки</button>
        <div className="page-header"><span className="section-kicker">Ваш вибір</span><h1>Кошик <small>{cartDetails.reduce((sum, item) => sum + item.quantity, 0)} товари</small></h1></div>
        <div className="cart-layout">
          <section className="cart-list" aria-label="Товари в кошику">
            {cartDetails.map(({ product, quantity }) => (
              <article className="cart-item" key={product.id}>
                <button className="cart-item-art" onClick={() => navigate(`/product/${product.id}`)}><ProductArtwork product={product} /></button>
                <div className="cart-item-info">
                  <span>{product.category}</span>
                  <button onClick={() => navigate(`/product/${product.id}`)}>{product.name}</button>
                  <small>{product.sku}</small>
                  <div className="cart-mobile-price">{money(product.price)}</div>
                </div>
                {product.stock > 0 ? <QuantityControl value={quantity} max={product.stock} onChange={(value) => updateQuantity(product.id, value)} label={`Кількість ${product.name}`} /> : <span className="field-error">Немає в наявності</span>}
                <div className="cart-item-price"><strong>{money(product.price * quantity)}</strong>{quantity > 1 && <small>{money(product.price)} / шт.</small>}</div>
                <button className="remove-button" onClick={() => removeFromCart(product.id)} aria-label={`Видалити ${product.name}`}><Trash2 size={18} /></button>
              </article>
            ))}
            <div className="shipping-progress">
              <div><Truck size={19} /><span>{cartTotal >= 2500 ? 'Вам доступна безкоштовна доставка' : `Додайте товарів ще на ${money(2500 - cartTotal)} для безкоштовної доставки`}</span></div>
              <div className="progress-track"><span style={{ width: `${Math.min(100, (cartTotal / 2500) * 100)}%` }} /></div>
            </div>
          </section>

          <aside className="order-summary">
            <h2>Ваше замовлення</h2>
            <dl>
              <div><dt>Товари</dt><dd>{money(cartTotal)}</dd></div>
              <div><dt>Нова пошта</dt><dd className={delivery === 0 ? 'free' : ''}>{delivery === 0 ? 'Безкоштовно' : money(delivery)}</dd></div>
              <div className="summary-total"><dt>Орієнтовно</dt><dd>{money(cartTotal + delivery)}</dd></div>
            </dl>
            {unavailable && <p className="field-error">Оновіть кількість або видаліть недоступний товар.</p>}
            <button className="button primary full" disabled={unavailable} onClick={() => navigate('/checkout')}>Оформити замовлення<ArrowRight size={18} /></button>
            <p className="secure-note"><Check size={15} />Остаточна сума перевіряється перед створенням замовлення</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
