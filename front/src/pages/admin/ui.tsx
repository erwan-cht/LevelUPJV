import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { roleLabel, statusLabel, type AccountRole, type AccountStatus } from '../../data/admin';
import { buttonOutline, buttonPrimary } from '../../components/ui';
import { useAdmin } from './store';

const roleStyle: Record<AccountRole, string> = {
  etudiant: 'bg-slate-200 text-navy',
  enseignant: 'bg-sky-100 text-sky-700',
  admin: 'bg-navy text-white',
};

const statusStyle: Record<AccountStatus, string> = {
  actif: 'bg-green-100 text-green-700',
  suspendu: 'bg-red-100 text-red-700',
  'en-attente': 'bg-brand-light text-brand',
};

export function RoleBadge({ role }: { role: AccountRole }) {
  return <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${roleStyle[role]}`}>{roleLabel[role]}</span>;
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${statusStyle[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel[status]}
    </span>
  );
}

/** Fenêtre modale accessible (Échap et clic sur le fond pour fermer). */
export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('.p-5 input, .p-5 select, .p-5 textarea, .p-5 button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/50 p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white shadow-xl ${width}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} width="max-w-md">
      <div className="text-sm text-muted">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={buttonOutline}>
          Annuler
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={danger ? `${buttonPrimary} bg-red-600 hover:bg-red-700` : buttonPrimary}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Petit message de confirmation en bas d'écran, qui disparaît seul. */
export function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = (m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 3500);
  };
  const node = msg ? (
    <p role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2.5 text-sm text-white shadow-lg">
      {msg}
    </p>
  ) : null;
  return { show, node };
}

export function StatCard({ label, value, hint, border }: { label: string; value: number | string; hint?: string; border: string }) {
  return (
    <div className={`rounded-lg border-t-4 bg-white p-4 shadow-sm ${border}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function AuditLog() {
  const { audit } = useAdmin();
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Journal d’administration</h2>
      <ol className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
        {audit.map((a) => (
          <li key={a.id} className="px-4 py-2.5">
            <p className="text-xs">{a.text}</p>
            <p className="text-[10px] text-muted">{a.at}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1">{children}</div>
      {error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}

export const selectClass =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none';
