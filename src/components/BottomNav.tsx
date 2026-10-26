import { Home, LayoutGrid, Package, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function BottomNav({ route, navigate }: { route: string; navigate: (path: string) => void }) {
  const { cartCount } = useStore();
  const items = [
    { path: '/', label: 'Головна', icon: Home },
    { path: '/catalog', label: 'Каталог', icon: LayoutGrid },
    { path: '/cart', label: 'Кошик', icon: ShoppingBag },
    { path: '/account', label: 'Замовлення', icon: Package },
  ];
  return (
    <nav className="bottom-nav" aria-label="Мобільна панель">
      {items.map(({ path, label, icon: Icon }) => (
        <button key={path} className={route === path ? 'active' : ''} onClick={() => navigate(path)}>
          <span className="bottom-icon-wrap">
            <Icon size={20} />
            {path === '/cart' && cartCount > 0 && <span>{cartCount}</span>}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
