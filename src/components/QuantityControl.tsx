import { Minus, Plus } from 'lucide-react';

interface QuantityControlProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}

export function QuantityControl({ value, max, onChange, label = 'Кількість' }: QuantityControlProps) {
  return (
    <div className="quantity-control" aria-label={label}>
      <button onClick={() => onChange(Math.max(1, value - 1))} aria-label="Зменшити кількість" disabled={value <= 1}><Minus size={16} /></button>
      <span aria-live="polite">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="Збільшити кількість" disabled={value >= max}><Plus size={16} /></button>
    </div>
  );
}
