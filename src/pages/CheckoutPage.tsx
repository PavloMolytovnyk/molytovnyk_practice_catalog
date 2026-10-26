import { ArrowLeft, Check, CheckCircle2, CreditCard, Landmark, Loader2, MapPin, Package, Truck } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { ProductArtwork } from '../components/ProductArtwork';
import { useStore } from '../context/StoreContext';
import type { CheckoutData, Order } from '../types';

const money = (value: number) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;

const initialForm: CheckoutData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  city: '',
  branch: '',
  delivery: 'Нова пошта',
  payment: 'Оплата карткою',
  comment: '',
};

type Errors = Partial<Record<keyof CheckoutData, string>>;

function validate(values: CheckoutData): Errors {
  const errors: Errors = {};
  if (values.firstName.trim().length < 2) errors.firstName = 'Вкажіть ім’я (щонайменше 2 символи).';
  if (values.lastName.trim().length < 2) errors.lastName = 'Вкажіть прізвище.';
  if (!/^\+?380\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(values.phone.replace(/-/g, ' '))) errors.phone = 'Формат: +380 67 123 45 67.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Перевірте електронну адресу.';
  if (values.city.trim().length < 2) errors.city = 'Оберіть або введіть місто.';
  if (values.branch.trim().length < 2) errors.branch = 'Вкажіть відділення або адресу.';
  return errors;
}

export function CheckoutPage({ navigate }: { navigate: (path: string) => void }) {
  const { cartDetails, cartTotal, createOrder, user } = useStore();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const deliveryPrice = form.delivery === 'Кур’єр' ? 160 : cartTotal >= 2500 ? 0 : 120;
  const idempotencyKey = useRef<string | null>(null);

  const field = (name: keyof CheckoutData, value: string) => {
    idempotencyKey.current = null;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const canSubmit = useMemo(() => cartDetails.length > 0 && !submitting, [cartDetails.length, submitting]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const order = await createOrder(form, idempotencyKey.current);
      setCompletedOrder(order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Не вдалося створити замовлення. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (completedOrder) {
    return (
      <main className="page-main confirmation-page">
        <div className="container confirmation-card">
          <div className="confirmation-icon"><CheckCircle2 size={42} /></div>
          <span className="section-kicker">Замовлення створено</span>
          <h1>Дякуємо за покупку</h1>
          <p>Замовлення за адресою <strong>{completedOrder.customer.email}</strong> створено. {user ? 'Статус доступний у вашому кабінеті.' : 'Збережіть номер замовлення для зв’язку з магазином.'} Оплата має статус «{completedOrder.paymentStatus}».</p>
          <div className="confirmation-number"><span>Номер замовлення</span><strong>{completedOrder.number}</strong></div>
          <div className="confirmation-details"><span><Package size={18} />{completedOrder.items.length} позиції</span><span><Truck size={18} />{completedOrder.delivery}</span><span><CreditCard size={18} />{money(completedOrder.total)}</span></div>
          <div className="confirmation-actions">{user && <button className="button primary" onClick={() => navigate('/account')}>Переглянути замовлення</button>}<button className="button ghost" onClick={() => navigate('/catalog')}>До каталогу</button></div>
        </div>
      </main>
    );
  }

  if (!cartDetails.length) {
    return <main className="page-main"><div className="container empty-state"><h1>Немає товарів для оформлення</h1><p>Поверніться до каталогу й додайте потрібні позиції.</p><button className="button primary" onClick={() => navigate('/catalog')}>До каталогу</button></div></main>;
  }

  return (
    <main className="page-main checkout-page">
      <div className="container">
        <button className="back-link" onClick={() => navigate('/cart')}><ArrowLeft size={17} />Назад до кошика</button>
        <div className="checkout-heading"><div><span className="section-kicker">Фінішна пряма</span><h1>Оформлення замовлення</h1></div><div className="checkout-steps"><span className="done"><Check size={14} />Кошик</span><i /><span className="active">2</span><b>Дані</b><i /><span>3</span><b>Готово</b></div></div>
        <form className="checkout-layout" onSubmit={submit} noValidate>
          <div className="checkout-form-stack">
            <section className="form-section">
              <div className="form-section-heading"><span>01</span><div><h2>Контактні дані</h2><p>Для підтвердження та повідомлень про статус.</p></div></div>
              <div className="form-grid two-cols">
                <label>Ім’я<input value={form.firstName} onChange={(event) => field('firstName', event.target.value)} placeholder="Анна" aria-invalid={!!errors.firstName} />{errors.firstName && <small className="field-error">{errors.firstName}</small>}</label>
                <label>Прізвище<input value={form.lastName} onChange={(event) => field('lastName', event.target.value)} placeholder="Коваль" aria-invalid={!!errors.lastName} />{errors.lastName && <small className="field-error">{errors.lastName}</small>}</label>
                <label>Телефон<input value={form.phone} onChange={(event) => field('phone', event.target.value)} placeholder="+380 67 123 45 67" inputMode="tel" aria-invalid={!!errors.phone} />{errors.phone && <small className="field-error">{errors.phone}</small>}</label>
                <label>Електронна адреса<input value={form.email} onChange={(event) => field('email', event.target.value)} placeholder="anna@example.com" type="email" aria-invalid={!!errors.email} />{errors.email && <small className="field-error">{errors.email}</small>}</label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-heading"><span>02</span><div><h2>Доставка</h2><p>Оберіть зручний спосіб отримання.</p></div></div>
              <div className="choice-grid">
                <label className={`choice-card ${form.delivery === 'Нова пошта' ? 'active' : ''}`}><input type="radio" name="delivery" checked={form.delivery === 'Нова пошта'} onChange={() => field('delivery', 'Нова пошта')} /><span className="choice-icon"><Package size={21} /></span><span><strong>Нова пошта</strong><small>У відділення або поштомат</small></span><b>{deliveryPrice ? money(deliveryPrice) : 'Безкоштовно'}</b></label>
                <label className={`choice-card ${form.delivery === 'Кур’єр' ? 'active' : ''}`}><input type="radio" name="delivery" checked={form.delivery === 'Кур’єр'} onChange={() => field('delivery', 'Кур’єр')} /><span className="choice-icon"><Truck size={21} /></span><span><strong>Кур’єр</strong><small>За вказаною адресою</small></span><b>від 160 ₴</b></label>
              </div>
              <div className="form-grid two-cols delivery-fields">
                <label>Місто<div className="input-with-icon"><MapPin size={17} /><input value={form.city} onChange={(event) => field('city', event.target.value)} placeholder="Івано-Франківськ" aria-invalid={!!errors.city} /></div>{errors.city && <small className="field-error">{errors.city}</small>}</label>
                <label>{form.delivery === 'Кур’єр' ? 'Адреса' : 'Відділення'}<input value={form.branch} onChange={(event) => field('branch', event.target.value)} placeholder={form.delivery === 'Кур’єр' ? 'Вулиця, будинок, квартира' : '№ 12, вул. Незалежності, 83'} aria-invalid={!!errors.branch} />{errors.branch && <small className="field-error">{errors.branch}</small>}</label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-heading"><span>03</span><div><h2>Оплата</h2><p>Онлайн-платіж поки не проводиться; статус оплати залишиться «Очікується».</p></div></div>
              <div className="choice-grid">
                <label className={`choice-card ${form.payment === 'Оплата карткою' ? 'active' : ''}`}><input type="radio" name="payment" checked={form.payment === 'Оплата карткою'} onChange={() => field('payment', 'Оплата карткою')} /><span className="choice-icon"><CreditCard size={21} /></span><span><strong>Карткою після підтвердження</strong><small>Реквізити надасть менеджер</small></span></label>
                <label className={`choice-card ${form.payment === 'Післяплата' ? 'active' : ''}`}><input type="radio" name="payment" checked={form.payment === 'Післяплата'} onChange={() => field('payment', 'Післяплата')} /><span className="choice-icon"><Landmark size={21} /></span><span><strong>Післяплата</strong><small>Під час отримання</small></span></label>
              </div>
              <label className="comment-field">Коментар до замовлення<textarea value={form.comment} onChange={(event) => field('comment', event.target.value)} placeholder="Наприклад, зателефонувати за 30 хвилин до доставки" rows={3} /></label>
            </section>
          </div>

          <aside className="checkout-summary">
            <h2>Ваше замовлення</h2>
            <div className="checkout-items">{cartDetails.map(({ product, quantity }) => <div key={product.id}><ProductArtwork product={product} /><span><strong>{product.name}</strong><small>{quantity} × {money(product.price)}</small></span><b>{money(product.price * quantity)}</b></div>)}</div>
            <dl><div><dt>Товари</dt><dd>{money(cartTotal)}</dd></div><div><dt>Доставка</dt><dd className={deliveryPrice === 0 ? 'free' : ''}>{deliveryPrice ? money(deliveryPrice) : 'Безкоштовно'}</dd></div><div className="summary-total"><dt>До сплати</dt><dd>{money(cartTotal + deliveryPrice)}</dd></div></dl>
            {serverError && <div className="server-error" role="alert">{serverError}</div>}
            <button className="button primary full" disabled={!canSubmit}>{submitting ? <><Loader2 size={18} className="spin" />Створюємо…</> : <>Підтвердити замовлення<Check size={18} /></>}</button>
            <p className="terms-note">Натискаючи кнопку, ви погоджуєтеся з правилами продажу й обробки даних.</p>
          </aside>
        </form>
      </div>
    </main>
  );
}
