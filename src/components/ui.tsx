import { useEffect, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Status } from '../db'
import { useI18n } from '../i18n'
import { cls } from '../utils'

/* ---------- Icons ---------- */

const paths = {
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 14h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 18l6-6-6-6',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  chat: 'M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  box: 'M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7L12 12l8.7-5M12 22V12',
  receipt: 'M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2zM8 8h8M8 12h8M8 16h5',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  check: 'M20 6L9 17l-5-5',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  minus: 'M5 12h14',
  cake: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01',
  close: 'M18 6L6 18M6 6l12 12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 22, className, flip }: { name: IconName; size?: number; className?: string; flip?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls(flip && 'rtl:-scale-x-100', className)}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  )
}

/* ---------- Layout ---------- */

export function Page({
  title,
  back,
  right,
  children,
  noNav,
}: {
  title: ReactNode
  back?: boolean
  right?: ReactNode
  children: ReactNode
  noNav?: boolean
}) {
  const nav = useNavigate()
  return (
    <div className={cls('min-h-dvh', noNav ? 'pb-10' : 'pb-28')}>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-nude/60 bg-cream/90 px-3 backdrop-blur">
        {back && (
          <button onClick={() => nav(-1)} className="-ms-1 grid h-10 w-10 place-items-center rounded-full active:bg-blush" aria-label="back">
            <Icon name="back" flip />
          </button>
        )}
        <h1 className={cls('flex-1 truncate font-display text-2xl font-bold text-ink', !back && 'ps-1')}>{title}</h1>
        {right}
      </header>
      <main className="mx-auto max-w-xl px-4 pt-4">{children}</main>
    </div>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cls('rounded-2xl border border-nude/70 bg-white p-4 shadow-[0_1px_3px_rgba(61,44,46,0.05)]', onClick && 'cursor-pointer active:bg-blush-soft', className)}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {right}
    </div>
  )
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-muted">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-blush-soft text-rose">
        <Icon name={icon} size={28} />
      </div>
      <p>{text}</p>
    </div>
  )
}

const TAB_PATHS = ['/', '/clients', '/cash', '/stats', '/more']

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  const hasNav = TAB_PATHS.includes(useLocation().pathname)
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cls(
        'fixed end-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-rose text-white shadow-lg shadow-rose/40 active:scale-95 active:bg-rose-dark',
        hasNav ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      <Icon name="plus" size={30} />
    </button>
  )
}

/* ---------- Form ---------- */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-rose">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-xl border border-nude bg-white px-3.5 py-3 outline-none focus:border-rose focus:ring-2 focus:ring-blush'

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cls(inputCls, p.className)} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cls(inputCls, 'appearance-none', p.className)} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cls(inputCls, p.className)} />

type Variant = 'primary' | 'ghost' | 'danger' | 'soft'

export const btnCls = (variant: Variant = 'primary', className?: string) =>
  cls(
    'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition active:scale-[0.98] disabled:opacity-50',
    variant === 'primary' && 'bg-rose text-white active:bg-rose-dark',
    variant === 'soft' && 'bg-blush text-rose-dark',
    variant === 'ghost' && 'border border-nude bg-white text-ink',
    variant === 'danger' && 'bg-red-50 text-red-700',
    className,
  )

export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={btnCls(variant, className)} />
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-blush-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cls('flex-1 rounded-lg py-2 text-sm font-semibold', value === o.value ? 'bg-white text-rose-dark shadow-sm' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Bottom sheet ---------- */

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="animate-sheet safe-bottom relative max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-cream">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-cream px-5 pb-2 pt-3">
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full active:bg-blush" aria-label="close">
            <Icon name="close" />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Status ---------- */

export const STATUSES: Status[] = ['confirmed', 'arrived', 'done', 'cancelled', 'noshow']

export const statusStyle: Record<Status, { dot: string; badge: string; bar: string }> = {
  confirmed: { dot: 'bg-rose', badge: 'bg-blush text-rose-dark', bar: 'border-s-rose' },
  arrived: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800', bar: 'border-s-amber-500' },
  done: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', bar: 'border-s-emerald-500' },
  cancelled: { dot: 'bg-stone-400', badge: 'bg-stone-100 text-stone-600', bar: 'border-s-stone-400' },
  noshow: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700', bar: 'border-s-red-500' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n()
  return <span className={cls('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', statusStyle[status].badge)}>{t(`st_${status}`)}</span>
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-blush font-semibold text-rose-dark">
      {initials || '?'}
    </div>
  )
}

export function confirmDelete(t: (k: 'confirmDelete') => string) {
  return window.confirm(t('confirmDelete'))
}
