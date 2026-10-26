import {
  ChevronDown,
  CreditCard,
  Heart,
  LogOut,
  Package,
  Truck,
} from 'lucide-react';

import { FormEvent, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderProgress } from '../components/OrderProgress';

const money = (value: number) =>
  `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;

export function AccountPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const {
    user,
    orders,
    favorites,
    login,
    register,
    logout,
  } = useStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setError('');
    setPending(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          firstName,
          lastName,
        });
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Спробуйте ще раз.',
      );
    } finally {
      setPending(false);
    }
  };

  if (!user) {
    return (
      <main className="page-main account-page">
        <div className="container auth-wrap">
          <div className="auth-intro">
            <span className="section-kicker">Кабінет FORMA</span>

            <h1>
              {mode === 'login'
                ? 'Раді вас бачити'
                : 'Створіть обліковий запис'}
            </h1>

            <p>
              Увійдіть, щоб бачити власні замовлення
              та їхні актуальні статуси.
            </p>
          </div>

          <form className="auth-card" onSubmit={submit}>
            {mode === 'register' && (
              <div className="form-grid two-cols">
                <label>
                  Ім’я
                  <input
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(event.target.value)
                    }
                    minLength={2}
                    required
                    autoComplete="given-name"
                  />
                </label>

                <label>
                  Прізвище
                  <input
                    value={lastName}
                    onChange={(event) =>
                      setLastName(event.target.value)
                    }
                    minLength={2}
                    required
                    autoComplete="family-name"
                  />
                </label>
              </div>
            )}

            <label>
              Електронна адреса
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === 'register' ? 10 : undefined}
                required
                autoComplete={
                  mode === 'register'
                    ? 'new-password'
                    : 'current-password'
                }
              />
            </label>

            {mode === 'register' && (
              <small>Щонайменше 10 символів.</small>
            )}

            {error && (
              <div className="server-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="button primary full"
              disabled={pending}
            >
              {pending
                ? 'Зачекайте…'
                : mode === 'login'
                  ? 'Увійти'
                  : 'Зареєструватися'}
            </button>

            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login'
                ? 'Немає облікового запису? Зареєструватися'
                : 'Уже маєте обліковий запис? Увійти'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const latest = orders[0];

  return (
    <main className="page-main account-page">
      <div className="container">
        <div className="account-header">
          <div className="profile-avatar">
            {user.firstName[0]}
            {user.lastName[0]}
          </div>

          <div>
            <span className="section-kicker">
              Особистий кабінет
            </span>
            <h1>Вітаємо, {user.firstName}</h1>
            <p>{user.email}</p>
          </div>

          <button
            className="button ghost compact-button"
            onClick={() =>
              logout().catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'Не вдалося вийти.',
                ),
              )
            }
          >
            <LogOut size={17} />
            Вийти
          </button>
        </div>

        {error && (
          <div className="server-error" role="alert">
            {error}
          </div>
        )}

        <div className="account-layout">
          <aside className="account-sidebar">
            <button className="active">
              <Package size={18} />
              Мої замовлення
              <span>{orders.length}</span>
            </button>

            <button
              onClick={() => navigate('/catalog?favorites=1')}
            >
              <Heart size={18} />
              Обране
              <span>{favorites.length}</span>
            </button>
          </aside>

          <div className="account-content">
            <section className="account-summary-grid">
              <div>
                <span className="summary-icon purple">
                  <Package size={20} />
                </span>
                <span>
                  <small>Усього замовлень</small>
                  <strong>{orders.length}</strong>
                </span>
              </div>

              <div>
                <span className="summary-icon green">
                  <Truck size={20} />
                </span>
                <span>
                  <small>У дорозі</small>
                  <strong>
                    {
                      orders.filter(
                        (item) => item.status === 'Відправлене',
                      ).length
                    }
                  </strong>
                </span>
              </div>

              <div>
                <span className="summary-icon coral">
                  <Heart size={20} />
                </span>
                <span>
                  <small>В обраному</small>
                  <strong>{favorites.length}</strong>
                </span>
              </div>

              <div>
                <span className="summary-icon blue">
                  <CreditCard size={20} />
                </span>
                <span>
                  <small>Сума покупок</small>
                  <strong>
                    {money(
                      orders.reduce(
                        (sum, item) => sum + item.total,
                        0,
                      ),
                    )}
                  </strong>
                </span>
              </div>
            </section>

            {latest && (
              <section className="active-order-card">
                <div className="active-order-heading">
                  <div>
                    <span className="section-kicker">
                      Останнє замовлення
                    </span>

                    <h2 title={latest.number}>
                      {latest.number}
                    </h2>
                  </div>

                  <span
                    className={`status-chip ${
                      latest.status === 'Виконане'
                        ? 'done'
                        : latest.status === 'Скасоване'
                          ? 'cancelled'
                          : latest.status === 'Відправлене'
                            ? 'shipped'
                            : 'new'
                    }`}
                  >
                    {latest.status}
                  </span>
                </div>

                <OrderProgress status={latest.status} />

                <div className="active-order-footer">
                  <span>
                    <Package size={16} />
                    {latest.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0,
                    )}{' '}
                    шт.
                  </span>

                  <span>
                    <Truck size={16} />
                    <span
                      className="order-delivery-name"
                      title={latest.delivery}
                    >
                      {latest.delivery}
                    </span>
                  </span>

                  <strong>{money(latest.total)}</strong>
                </div>
              </section>
            )}

            <section className="orders-section">
              <div className="section-heading compact">
                <div>
                  <h2>Історія замовлень</h2>
                  <p>
                    Склад, сума та поточний стан ваших покупок.
                  </p>
                </div>
              </div>

              {!orders.length && (
                <div className="empty-state">
                  <p>Ви ще не створили замовлень.</p>

                  <button
                    className="button primary"
                    onClick={() => navigate('/catalog')}
                  >
                    До каталогу
                  </button>
                </div>
              )}

              <div className="orders-list">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="order-row-wrap"
                  >
                    <div className="order-row">
                      <div>
                        <small>Номер</small>
                        <strong>{order.number}</strong>
                      </div>

                      <div>
                        <small>Дата</small>
                        <span>
                          {new Intl.DateTimeFormat('uk-UA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }).format(new Date(order.createdAt))}
                        </span>
                      </div>

                      <div>
                        <small>Позицій</small>
                        <span>
                          {order.items.reduce(
                            (sum, item) => sum + item.quantity,
                            0,
                          )}
                        </span>
                      </div>

                      <div>
                        <small>Сума</small>
                        <strong>{money(order.total)}</strong>
                      </div>

                      <div>
                        <small>Статус</small>
                        <span
                          className={`status-chip ${
                            order.status === 'Виконане'
                              ? 'done'
                              : order.status === 'Скасоване'
                                ? 'cancelled'
                                : order.status === 'Відправлене'
                                  ? 'shipped'
                                  : 'new'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          setExpanded(
                            expanded === order.id
                              ? null
                              : order.id,
                          )
                        }
                        aria-label={`Деталі замовлення ${order.number}`}
                        aria-expanded={expanded === order.id}
                      >
                        <ChevronDown size={19} />
                      </button>
                    </div>

                    {expanded === order.id && (
                      <div className="order-expanded">
                        <ul>
                          {order.items.map((item, index) => (
                            <li key={index}>
                              {item.name} × {item.quantity}
                              <strong>
                                {money(item.price * item.quantity)}
                              </strong>
                            </li>
                          ))}
                        </ul>

                        <p>
                          Доставка: {order.delivery}, {order.city},{' '}
                          {order.branch} — {money(order.deliveryFee)}.
                          {' '}Оплата: {order.payment} (
                          {order.paymentStatus}).
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}