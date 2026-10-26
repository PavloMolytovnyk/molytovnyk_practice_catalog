import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';

interface HeaderProps {
  route: string;
  navigate: (path: string) => void;
}

export function Header({ route, navigate }: HeaderProps) {
  const { cartCount, favorites, user } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route]);

  const navItems = [
    { label: 'Головна', path: '/' },
    { label: 'Каталог', path: '/catalog' },
    { label: 'Рейтинг продажів', path: '/popular' },
    { label: 'Мої замовлення', path: '/account' },
    ...(user && user.role !== 'customer' ? [{ label: 'Адмінпанель', path: '/admin' }] : []),
  ];

  return (
    <>
      <div className="announcement">
        <div className="container announcement-inner">
          <span>Безкоштовна доставка від 2 500 ₴</span>
          <span className="announcement-secondary">Повернення протягом 14 днів</span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <button className="brand" onClick={() => navigate('/')} aria-label="FORMA — на головну">
            <span className="brand-mark">F</span>
            <span>FORMA</span>
          </button>

          <nav className="desktop-nav" aria-label="Основна навігація">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={route === item.path || (item.path === '/catalog' && route.startsWith('/product/')) ? 'active' : ''}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button className="icon-button hide-mobile" onClick={() => navigate('/catalog?focus=search')} aria-label="Пошук">
              <Search size={19} />
            </button>
            <button className="icon-button hide-mobile" onClick={() => navigate('/catalog?favorites=1')} aria-label="Обрані товари">
              <Heart size={19} />
              {favorites.length > 0 && <span className="action-count subtle">{favorites.length}</span>}
            </button>
            <button className="icon-button hide-mobile" onClick={() => navigate('/account')} aria-label="Особистий кабінет">
              <UserRound size={19} />
            </button>
            <button className="cart-button" onClick={() => navigate('/cart')} aria-label={`Кошик, товарів: ${cartCount}`}>
              <ShoppingBag size={19} />
              <span className="cart-button-label">Кошик</span>
              <span className="action-count">{cartCount}</span>
            </button>
            <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Відкрити меню" aria-expanded={menuOpen}>
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mobile-menu container" aria-label="Мобільна навігація">
            {navItems.map((item) => (
              <button key={item.path} onClick={() => navigate(item.path)}>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
