import { Check, XCircle } from 'lucide-react';
import type { OrderStatus } from '../types';

const steps: OrderStatus[] = [
  'Нове',
  'Підтверджене',
  'Комплектується',
  'Відправлене',
  'Виконане',
];

export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'Скасоване') {
    return (
      <div className="order-cancelled">
        <XCircle size={22} />

        <div>
          <strong>Замовлення скасовано</strong>
          <p>
            Резерв товарів знято. Якщо ви хочете повторити покупку,
            додайте товари до кошика.
          </p>
        </div>
      </div>
    );
  }

  const current = steps.indexOf(status);

  return (
    <div
      className="order-progress-scroll"
      tabIndex={0}
      role="region"
      aria-label="Етапи замовлення. На вузькому екрані прокручуйте горизонтально."
    >
      <div
        className="order-progress"
        role="list"
        aria-label={`Статус замовлення: ${status}`}
      >
        {steps.map((step, index) => {
          const complete = index < current || status === 'Виконане';
          const isCurrent = index === current;

          const className = [
            complete ? 'complete' : '',
            isCurrent ? 'current' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={step}
              role="listitem"
              className={className}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span aria-hidden="true">
                {complete ? (
                  <Check size={16} strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>

              <small>{step}</small>

              {isCurrent && (
                <b className="order-step-caption">
                  {status === 'Виконане' ? 'Готово' : 'Поточний етап'}
                </b>
              )}

              {index < steps.length - 1 && <i aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}   