export type Category = 'Аудіо' | 'Гаджети' | 'Дім' | 'Подорожі';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: Category;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  stock: number;
  reserved?: number;
  badge?: string;
  shortDescription: string;
  description: string;
  features: string[];
  art: 'watch' | 'headphones' | 'lamp' | 'backpack' | 'keyboard' | 'speaker' | 'mug' | 'powerbank';
  color: string;
  accent: string;
  isNew?: boolean;
  popularity: number;
  soldCount: number;
  salesRank: number | null;
  popularityScore: number;
  createdAt: string;
  active?: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export type OrderStatus = 'Нове' | 'Підтверджене' | 'Комплектується' | 'Відправлене' | 'Виконане' | 'Скасоване';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'catalog_manager' | 'order_manager' | 'admin';
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  deliveryFee: number;
  city: string;
  branch: string;
  paymentStatus: string;
  items: Array<{
    productId: string;
    name: string;
    sku?: string;
    quantity: number;
    price: number;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
  delivery: string;
  payment: string;
}

export interface CheckoutData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  branch: string;
  delivery: string;
  payment: string;
  comment: string;
}

export type AnalyticsPeriod = 7 | 30 | 90;
export interface ProductAnalytics {
  period: { days: AnalyticsPeriod; from: string; to: string };
  summary: {
    orders: number; units: number; revenue: number; productsSold: number;
    previousOrders: number; previousUnits: number; previousRevenue: number;
    growthPercent: number | null; restockProducts: number;
  };
  products: Array<{
    key: string; productId: string | null; name: string; sku: string; category: string; active: boolean;
    units: number; revenue: number; orders: number; previousUnits: number;
    growthPercent: number | null; sharePercent: number; availableStock: number;
    stockDays: number | null; suggestedRestock: number; demand: 'high' | 'medium' | 'none';
    recommendation: { code: 'inactive' | 'restock' | 'growing' | 'promote' | 'observe' | 'no_sales'; title: string; reason: string };
  }>;
  categories: Array<{ name: string; units: number; revenue: number; sharePercent: number }>;
}
