import { ArrowRight, Headphones, RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductArtwork } from '../components/ProductArtwork';
import { ProductCard } from '../components/ProductCard';

export function HomePage({ navigate }: { navigate: (path: string) => void }) {
  const { products, loading } = useStore();
  const featured = products[0];
  const popular = [...products].filter((p) => p.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount || a.id.localeCompare(b.id)).slice(0, 4);

  return (
    <>
      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><Sparkles size={15} />Колекція 2026</div>
              <h1>Речі, які роблять щодень <span>простішим.</span></h1>
              <p>Техніка, аксесуари й товари для дому з продуманим дизайном та чесними характеристиками.</p>
              <div className="hero-actions">
                <button className="button primary" onClick={() => navigate('/catalog')}>До каталогу<ArrowRight size={18} /></button>
                <button className="button ghost" onClick={() => navigate('/product/aura-fit')}>Товар тижня</button>
              </div>
              <div className="hero-proof">
                <span><strong>4,9</strong> середня оцінка</span>
                <span><strong>14 днів</strong> на повернення</span>
                <span><strong>1–2 дні</strong> на відправлення</span>
              </div>
            </div>
            <div className="hero-visual">
              <span className="hero-note note-top">Новинка сезону</span>
              {featured ? <ProductArtwork product={featured} className="hero-art" /> : <div className="hero-art skeleton" />}
              <div className="hero-product-caption">
                <div><span>Товар тижня</span><strong>Aura Fit</strong></div>
                <button onClick={() => navigate('/product/aura-fit')} aria-label="Переглянути Aura Fit"><ArrowRight size={18} /></button>
              </div>
              <span className="hero-note note-bottom">AMOLED · 10 днів</span>
            </div>
          </div>
        </section>

        <section className="category-section container section-block">
          <div className="section-heading compact">
            <div><span className="section-kicker">Оберіть настрій</span><h2>Категорії</h2></div>
            <button className="text-link" onClick={() => navigate('/catalog')}>Усі товари<ArrowRight size={17} /></button>
          </div>
          <div className="category-grid">
            <button className="category-card category-audio" onClick={() => navigate('/catalog?category=Аудіо')}>
              <span className="category-icon"><Headphones size={26} /></span>
              <span><strong>Аудіо</strong><small>Звук у вашому ритмі</small></span>
              <ArrowRight size={18} />
            </button>
            <button className="category-card category-gadgets" onClick={() => navigate('/catalog?category=Гаджети')}>
              <span className="category-icon"><Sparkles size={26} /></span>
              <span><strong>Гаджети</strong><small>Розумні помічники</small></span>
              <ArrowRight size={18} />
            </button>
            <button className="category-card category-home" onClick={() => navigate('/catalog?category=Дім')}>
              <span className="category-icon"><ShieldCheck size={26} /></span>
              <span><strong>Для дому</strong><small>Теплі деталі простору</small></span>
              <ArrowRight size={18} />
            </button>
            <button className="category-card category-travel" onClick={() => navigate('/catalog?category=Подорожі')}>
              <span className="category-icon"><Truck size={26} /></span>
              <span><strong>Подорожі</strong><small>Комфорт у дорозі</small></span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        <section className="container section-block popular-section">
          <div className="section-heading">
            <div><span className="section-kicker">Обирають найчастіше</span><h2>Популярні товари</h2></div>
            <button className="text-link" onClick={() => navigate('/popular')}>Рейтинг продажів<ArrowRight size={17} /></button>
          </div>
          <p className="sales-explanation">Найбільше куплених одиниць за весь час. Бал популярності — до 5; враховуємо лише виконані замовлення.</p>
          {loading ? (
            <div className="product-grid">{Array.from({ length: 4 }).map((_, index) => <div className="product-card skeleton-card" key={index} />)}</div>
          ) : popular.length ? (
            <div className="product-grid">{popular.map((product) => <ProductCard key={product.id} product={product} navigate={navigate} />)}</div>
          ) : (
            <div className="sales-empty"><h3>Рейтинг з’явиться після перших покупок</h3><p>Поки немає виконаних замовлень, популярні товари ще не визначені.</p><button className="button ghost" onClick={() => navigate('/catalog')}>До каталогу</button></div>
          )}
        </section>

        <section className="container story-section section-block">
          <div className="story-copy">
            <span className="section-kicker light">Наш підхід</span>
            <h2>Менше випадкових речей.<br />Більше вдалих виборів.</h2>
            <p>Ми залишаємо в каталозі тільки товари з корисними функціями, зрозуміло пояснюємо характеристики та показуємо реальну наявність.</p>
            <button className="button light" onClick={() => navigate('/catalog')}>Переглянути добірку<ArrowRight size={18} /></button>
          </div>
          <div className="story-stats">
            <div><strong>120+</strong><span>перевірених позицій</span></div>
            <div><strong>24/7</strong><span>статус замовлення онлайн</span></div>
            <div><strong>98%</strong><span>відправлень без затримок</span></div>
          </div>
        </section>

        <section className="container benefits-strip">
          <div><Truck size={23} /><span><strong>Швидка доставка</strong><small>По Україні 1–3 дні</small></span></div>
          <div><ShieldCheck size={23} /><span><strong>Безпечна оплата</strong><small>Захищене з’єднання</small></span></div>
          <div><RotateCcw size={23} /><span><strong>Легке повернення</strong><small>14 днів на рішення</small></span></div>
          <div><Headphones size={23} /><span><strong>Людська підтримка</strong><small>Щодня 09:00–20:00</small></span></div>
        </section>
      </main>
    </>
  );
}
