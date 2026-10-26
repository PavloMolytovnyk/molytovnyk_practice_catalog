import { Instagram, Mail, MapPin } from 'lucide-react';

export function Footer({ navigate }: { navigate: (path: string) => void }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <div className="brand brand-static"><span className="brand-mark">F</span><span>FORMA</span></div>
          <p>Добірні речі для роботи, дому й подорожей. Чесні характеристики та зрозумілий сервіс.</p>
        </div>
        <div>
          <h3>Магазин</h3>
          <button onClick={() => navigate('/catalog')}>Каталог</button>
          <button onClick={() => navigate('/cart')}>Кошик</button>
          <button onClick={() => navigate('/account')}>Мої замовлення</button>
        </div>
        <div>
          <h3>Підтримка</h3>
          <a href="mailto:hello@forma.store"><Mail size={16} />hello@forma.store</a>
          <span><MapPin size={16} />Івано-Франківськ</span>
          <a href="#instagram"><Instagram size={16} />@forma.store</a>
        </div>
        <div className="newsletter">
          <h3>Новини без шуму</h3>
          <p>Новинки й корисні добірки раз на два тижні.</p>
          <form onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="newsletter-email">Електронна адреса</label>
            <input id="newsletter-email" type="email" placeholder="you@example.com" />
            <button type="submit" aria-label="Підписатися">→</button>
          </form>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 FORMA</span>
        <span>Навчальний frontend-проєкт</span>
      </div>
    </footer>
  );
}
