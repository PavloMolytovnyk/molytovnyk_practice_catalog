import type { AnalyticsPeriod, CheckoutData, Order, Product, ProductAnalytics, User } from '../types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public requestId?: string) { super(message); }
}

async function requestPayload<T>(path: string, options: RequestInit = {}): Promise<{ data: T; meta?: { total: number; page: number; limit: number } }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const headers = new Headers(options.headers);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, signal: controller.signal, headers });
    if (response.status === 204) return { data: undefined as T };
    const payload = await response.json().catch(() => null);
    const requestId = response.headers.get('X-Request-ID') || payload?.requestId;
    if (!response.ok) {
      const proxyFailure = !payload?.message && response.status >= 500;
      throw new ApiError(payload?.message || (proxyFailure
        ? 'API недоступний. Перевірте, чи запущено сервер на порту 4000 та чи він підключився до PostgreSQL.'
        : 'Не вдалося виконати запит.'), response.status, payload?.code || (proxyFailure ? 'API_UNAVAILABLE' : undefined), requestId);
    }
    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      throw new ApiError('Сервер повернув некоректну відповідь. Перевірте адресу API та налаштування проксі.', response.status, 'INVALID_RESPONSE', requestId);
    }
    return payload as { data: T; meta?: { total: number; page: number; limit: number } };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted
      ? 'Сервер не відповів вчасно. Спробуйте повторити завантаження.'
      : 'Немає зв’язку із сервером. Перевірте, чи запущено API.', 0, controller.signal.aborted ? 'TIMEOUT' : 'NETWORK');
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await requestPayload<T>(path, options)).data;
}

const json = (value: unknown) => JSON.stringify(value);

export const api = {
  products: async () => {
    const all: Product[] = [];
    let page = 1;
    do {
      const result = await requestPayload<Product[]>(`/products?limit=100&page=${page}`);
      if (!Array.isArray(result.data)) throw new ApiError('Некоректна відповідь каталогу.', 200, 'INVALID_RESPONSE');
      all.push(...result.data);
      if (!result.meta || all.length >= result.meta.total || !result.data.length) break;
      page += 1;
    } while (true);
    return all;
  },
  adminProducts: () => request<Product[]>('/admin/products'),
  me: () => request<User>('/auth/me'),
  login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => request<User>('/auth/register', { method: 'POST', body: json(data) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  myOrders: () => request<Order[]>('/me/orders'),
  adminOrders: () => request<Order[]>('/admin/orders'),
  analytics: (days: AnalyticsPeriod, signal?: AbortSignal) => request<ProductAnalytics>(`/admin/analytics?days=${days}`, { signal }),
  saveProduct: (product: Product) => {
    const { id, name, sku, category, price, stock, shortDescription, description, features, art, color, accent, active } = product;
    return request<Product>(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PATCH' : 'POST', body: json({ name, sku, category, price, stock, shortDescription, description, features, art, color, accent, ...(id ? { active } : {}) }) });
  },
  deleteProduct: (id: string) => request<void>(`/admin/products/${id}`, { method: 'DELETE' }),
  createOrder: (form: CheckoutData, items: Array<{ productId: string; quantity: number }>, key: string) => request<Order>('/orders', {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: json({ items, customer: { firstName: form.firstName, lastName: form.lastName, phone: form.phone.replace(/\D/g, '').replace(/^/, '+'), email: form.email }, city: form.city, branch: form.branch, delivery: form.delivery, payment: form.payment, comment: form.comment }),
  }),
  changeStatus: (id: string, status: string, note: string) => request<Order>(`/admin/orders/${id}/status`, { method: 'POST', body: json({ status, note }) }),
};

// React StrictMode runs mount effects twice. Share only an in-flight load;
// a manual retry always makes fresh requests after the previous load finishes.
let initialLoad: ReturnType<typeof fetchInitialState> | undefined;
function fetchInitialState() { return Promise.allSettled([api.products(), api.me()]); }
export function loadInitialState() {
  if (!initialLoad) initialLoad = fetchInitialState().finally(() => { initialLoad = undefined; });
  return initialLoad;
}
