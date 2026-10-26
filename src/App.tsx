import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { CartPage } from './pages/CartPage';
import { CatalogPage } from './pages/CatalogPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { PopularPage } from './pages/PopularPage';
import { useStore } from './context/StoreContext';

function normalizeHash() {
  const value = window.location.hash.replace(/^#/, '') || '/';
  return value.startsWith('/') ? value : `/${value}`;
}

export default function App() {
  const { user, loading, error, catalogError, reload } = useStore();
  const [location, setLocation] = useState(normalizeHash);
  const path = location.split('?')[0];

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/');
    const handleHash = () => {
      setLocation(normalizeHash());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (nextPath: string) => {
    const nextHash = `#${nextPath}`;
    if (window.location.hash === nextHash) {
      setLocation(nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.hash = nextPath;
    }
  };

  const renderPage = () => {
    if (loading) return <main className="page-main"><div className="container empty-state" role="status" aria-live="polite"><h1>Завантаження…</h1><p>Отримуємо дані магазину.</p></div></main>;
    if (catalogError && path !== '/account') return <main className="page-main"><div className="container empty-state" role="alert"><h1>Не вдалося завантажити дані</h1><p>{catalogError}</p><button className="button primary" onClick={reload}>Повторити завантаження</button></div></main>;
    if (path === '/') return <HomePage navigate={navigate} />;
    if (path === '/catalog') return <CatalogPage key={location} navigate={navigate} />;
    if (path === '/popular') return <PopularPage navigate={navigate} />;
    if (path.startsWith('/product/')) return <ProductPage productId={path.split('/')[2] ?? ''} navigate={navigate} />;
    if (path === '/cart') return <CartPage navigate={navigate} />;
    if (path === '/checkout') return <CheckoutPage navigate={navigate} />;
    if (path === '/account') return <AccountPage navigate={navigate} />;
    if (path === '/admin') return loading ? <main className="page-main" /> : user && user.role !== 'customer' ? <AdminPage /> : <AccountPage navigate={navigate} />;
    return <HomePage navigate={navigate} />;
  };

  return (
    <div className="app-shell">
      <button className="skip-link" onClick={() => document.getElementById('main-content')?.focus()}>Перейти до вмісту</button>
      <Header route={path} navigate={navigate} />
      {(error || (catalogError && path === '/account')) && <div className="server-error global-error" role="alert"><span>{catalogError || error}</span><button className="button ghost compact-button" disabled={loading} onClick={reload}>Повторити</button></div>}
      <div id="main-content" tabIndex={-1}>{renderPage()}</div>
      {path !== '/admin' && <Footer navigate={navigate} />}
      <BottomNav route={path} navigate={navigate} />
      <Toast />
    </div>
  );
}
