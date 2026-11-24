import React from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function ToastContainer() {
  const { toasts } = useApp();
  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon =
          t.type === 'warning' || t.type === 'error'
            ? AlertTriangle
            : t.type === 'info'
            ? Info
            : CheckCircle2;
        const color =
          t.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-900'
            : t.type === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-slate-200/90 bg-white text-[#1E293B]';
        const iconColor =
          t.type === 'error'
            ? 'text-red-600'
            : t.type === 'warning'
            ? 'text-amber-600'
            : 'text-[#0F766E]';

        return (
          <div
            key={t.id}
            className={`animate-modal-in pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-sm text-sm font-medium ${color}`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
