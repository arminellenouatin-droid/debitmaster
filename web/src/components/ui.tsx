import React, { useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { hasPermission } from '../lib/api'

export function Button({
  variant = 'primary', className = '', loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }) {
  const map = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost' }
  return (
    <button className={`${map[variant]} ${className}`} disabled={props.disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {props.children}
    </button>
  )
}

export function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`card ${onClick ? 'cursor-pointer hover:shadow-modal transition-shadow' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="label">{children}</label>
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`bg-bg dark:bg-bg dark w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-t-lg sm:rounded-lg shadow-modal p-lg max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-md">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-sm hover:bg-surface" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success dark:text-success dark',
  ON_TIME: 'bg-success/10 text-success dark:text-success dark',
  READY: 'bg-success/10 text-success dark:text-success dark',
  SUCCESS: 'bg-success/10 text-success dark:text-success dark',
  VALIDATED: 'bg-success/10 text-success dark:text-success dark',
  PAID: 'bg-success/10 text-success dark:text-success dark',
  FREE: 'bg-success/10 text-success dark:text-success dark',
  TRIAL: 'bg-info/10 text-info dark:text-info dark',
  DRAFT: 'bg-info/10 text-info dark:text-info dark',
  IN_PREPARATION: 'bg-info/10 text-info dark:text-info dark',
  PENDING: 'bg-warning/10 text-warning dark:text-warning dark',
  GRACE_PERIOD: 'bg-warning/10 text-warning dark:text-warning dark',
  LATE: 'bg-warning/10 text-warning dark:text-warning dark',
  PENDING_VALIDATION: 'bg-warning/10 text-warning dark:text-warning dark',
  OCCUPIED: 'bg-warning/10 text-warning dark:text-warning dark',
  RESERVED: 'bg-info/10 text-info dark:text-info dark',
  SUSPENDED: 'bg-danger/10 text-danger dark:text-danger dark',
  EXPIRED: 'bg-danger/10 text-danger dark:text-danger dark',
  ABSENT: 'bg-danger/10 text-danger dark:text-danger dark',
  FAILED: 'bg-danger/10 text-danger dark:text-danger dark',
  REJECTED: 'bg-danger/10 text-danger dark:text-danger dark',
  CANCELLED: 'bg-danger/10 text-danger dark:text-danger dark',
  TO_CLEAN: 'bg-warning/10 text-warning dark:text-warning dark',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${statusStyles[status] ?? 'bg-line text-ink-secondary'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label ?? status.replace(/_/g, ' ')}
    </span>
  )
}

export function StatCard({ icon, label, value, hint, tone = 'primary' }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    primary: 'text-primary bg-primary-light',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-danger bg-danger/10',
    info: 'text-info bg-info/10',
  }
  return (
    <Card className="flex items-start gap-md">
      <div className={`p-3 rounded-md ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-caption text-ink-secondary dark:text-ink-darkSecondary">{label}</p>
        <p className="text-2xl font-bold tabular-nums truncate">{value}</p>
        {hint && <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{hint}</p>}
      </div>
    </Card>
  )
}

export function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
      <div className="p-4 rounded-full bg-surface dark:bg-surface dark text-ink-secondary">{icon}</div>
      <p className="font-semibold">{title}</p>
      {subtitle && <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary max-w-sm">{subtitle}</p>}
      {action}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-line dark:bg-line dark'} ${disabled ? 'opacity-50' : ''}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function useHasPermission(code: string) {
  const [allowed, setAllowed] = React.useState(true)
  useEffect(() => {
    let mounted = true
    hasPermission(code).then((ok) => { if (mounted) setAllowed(ok) })
    return () => { mounted = false }
  }, [code])
  return allowed
}

export { useI18n }
