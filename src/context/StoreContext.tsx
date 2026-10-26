import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, loadInitialState } from '../services/api';
import type { CartItem, CheckoutData, Order, Product, User } from '../types';

type ToastState = { message: string; tone: 'success' | 'info' };
interface StoreContextValue {
  products: Product[]; adminProducts: Product[]; orders: Order[]; adminOrders: Order[]; user: User | null;
  cart: CartItem[]; favorites: string[]; loading: boolean; error: string; catalogError: string; reload: () => void; toast: ToastState | null;
  cartCount: number; cartTotal: number; cartDetails: Array<{ product: Product; quantity: number }>;
  addToCart: (id: string, quantity?: number) => void; updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void; clearCart: () => void; toggleFavorite: (id: string) => void;
  saveProduct: (product: Product) => Promise<void>; deleteProduct: (id: string) => Promise<void>;
  createOrder: (form: CheckoutData, key: string) => Promise<Order>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>; changeStatus: (id: string, status: string, note: string) => Promise<void>;
  showToast: (message: string, tone?: ToastState['tone']) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);
const CART_KEY = 'forma-cart-v1';
const FAVORITES_KEY = 'forma-favorites-v1';
function loadList(key: string): unknown[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data : []; }
  catch { return []; }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => loadList(CART_KEY).filter((item): item is CartItem => typeof item === 'object' && item !== null && typeof (item as CartItem).productId === 'string' && Number.isInteger((item as CartItem).quantity) && (item as CartItem).quantity > 0).slice(0, 30));
  const [favorites, setFavorites] = useState<string[]>(() => loadList(FAVORITES_KEY).filter((id): id is string => typeof id === 'string'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const reload = () => setLoadAttempt((value) => value + 1);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setCatalogError('');
    loadInitialState().then(([catalog, identity]) => {
      if (!active) return;
      if (catalog.status === 'fulfilled') setProducts(catalog.value);
      else setCatalogError(catalog.reason instanceof Error ? catalog.reason.message : 'Не вдалося отримати каталог.');
      if (identity.status === 'fulfilled') setUser(identity.value);
      else if (identity.reason instanceof ApiError && identity.reason.status === 401) setUser(null);
      else if (catalog.status === 'fulfilled') setError(identity.reason instanceof Error ? identity.reason.message : 'Не вдалося перевірити стан входу.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    let active = true;
    setOrders([]); setAdminOrders([]); setAdminProducts([]);
    if (!user) return;
    const report = (cause: unknown, fallback: string) => {
      if (active) setError(cause instanceof Error ? cause.message : fallback);
    };
    api.myOrders().then((data) => { if (active) setOrders(data); }).catch((cause) => report(cause, 'Не вдалося отримати історію замовлень.'));
    if (user.role === 'admin' || user.role === 'catalog_manager') api.adminProducts().then((data) => { if (active) setAdminProducts(data); }).catch((cause) => report(cause, 'Не вдалося отримати товари для керування.'));
    if (user.role === 'admin' || user.role === 'order_manager') api.adminOrders().then((data) => { if (active) setAdminOrders(data); }).catch((cause) => report(cause, 'Не вдалося отримати замовлення для керування.'));
    return () => { active = false; };
  }, [user]);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3000); return () => window.clearTimeout(timer); }, [toast]);

  const showToast = (message: string, tone: ToastState['tone'] = 'success') => setToast({ message, tone });
  const addToCart = (id: string, quantity = 1) => {
    const product = products.find((item) => item.id === id);
    if (!product || product.stock <= 0) { showToast('Цього товару немає в наявності.', 'info'); return; }
    setCart((current) => {
      const existing = current.find((item) => item.productId === id);
      if (existing) return current.map((item) => item.productId === id ? { ...item, quantity: Math.min(product.stock, item.quantity + quantity) } : item);
      return [...current, { productId: id, quantity: Math.min(product.stock, Math.max(1, quantity)) }];
    });
    showToast('Товар додано до кошика');
  };
  const updateQuantity = (id: string, quantity: number) => {
    const product = products.find((item) => item.id === id);
    if (!product || product.stock < 1) return;
    setCart((current) => current.map((item) => item.productId === id ? { ...item, quantity: Math.max(1, Math.min(product.stock, Math.trunc(quantity))) } : item));
  };
  const removeFromCart = (id: string) => { setCart((current) => current.filter((item) => item.productId !== id)); showToast('Позицію видалено', 'info'); };
  const clearCart = () => setCart([]);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const cartDetails = useMemo(() => cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  }), [cart,products]);
  const cartCount = cartDetails.reduce((sum,item) => sum + item.quantity, 0);
  const cartTotal = cartDetails.reduce((sum,item) => sum + item.quantity * item.product.price, 0);

  const saveProduct = async (product: Product) => {
    const saved = await api.saveProduct(product);
    setAdminProducts((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved,...current]);
    const publicProduct = { ...saved, stock: saved.stock - (saved.reserved ?? 0) };
    setProducts((current) => {
      const other = current.filter((item) => item.id !== saved.id);
      return saved.active ? [publicProduct,...other] : other;
    });
    try { setProducts(await api.products()); }
    catch { setError('Товар збережено, але не вдалося оновити рейтинг. Перезавантажте сторінку.'); }
    showToast('Товар збережено');
  };
  const deleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    setAdminProducts((current) => current.map((item) => item.id === id ? { ...item, active: false } : item));
    setProducts((current) => current.filter((item) => item.id !== id));
    setCart((current) => current.filter((item) => item.productId !== id));
    try { setProducts(await api.products()); }
    catch { setError('Товар приховано, але не вдалося оновити рейтинг. Перезавантажте сторінку.'); }
    showToast('Товар приховано з каталогу', 'info');
  };
  const createOrder = async (form: CheckoutData, key: string) => {
    const order = await api.createOrder(form, cartDetails.map(({ product,quantity }) => ({ productId: product.id, quantity })), key);
    if (user) setOrders((current) => [order,...current.filter((item) => item.id !== order.id)]);
    setCart([]);
    api.products().then(setProducts).catch(() => {});
    return order;
  };
  const login = async (email: string, password: string) => setUser(await api.login(email,password));
  const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => setUser(await api.register(data));
  const logout = async () => { await api.logout(); setUser(null); };
  const changeStatus = async (id: string, status: string, note: string) => {
    const updated = await api.changeStatus(id,status,note);
    setAdminOrders((current) => current.map((item) => item.id === id ? updated : item));
    const [catalog, inventory] = await Promise.allSettled([
      api.products(), user?.role === 'admin' ? api.adminProducts() : Promise.resolve(null),
    ]);
    if (catalog.status === 'fulfilled') setProducts(catalog.value);
    if (inventory.status === 'fulfilled' && inventory.value) setAdminProducts(inventory.value);
    if (catalog.status === 'rejected' || inventory.status === 'rejected') setError('Статус збережено, але не вдалося оновити залишки. Перезавантажте сторінку.');
    showToast('Статус оновлено');
  };

  return <StoreContext.Provider value={{ products,adminProducts,orders,adminOrders,user,cart,favorites,loading,error,catalogError,reload,toast,cartCount,cartTotal,cartDetails,addToCart,updateQuantity,removeFromCart,clearCart,toggleFavorite,saveProduct,deleteProduct,createOrder,login,register,logout,changeStatus,showToast }}>{children}</StoreContext.Provider>;
}

export function useStore() { const context = useContext(StoreContext); if (!context) throw new Error('useStore requires StoreProvider'); return context; }
