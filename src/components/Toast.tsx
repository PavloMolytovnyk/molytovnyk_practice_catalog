import { CheckCircle2, Info, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
      {toast.tone === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
      <span>{toast.message}</span>
      <X size={16} aria-hidden="true" />
    </div>
  );
}
