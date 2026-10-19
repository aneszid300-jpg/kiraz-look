import { useState } from 'react'
import { cls, money } from '../utils'

/** Categorical slots — validated order (light / dark steps), colour follows the category, never its rank */
export const CAT_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
}

/** Rounded axis max plus evenly spaced ticks that land on round numbers */
const niceScale = (v: number) => {
  if (v <= 0) return { max: 1000, ticks: [0, 250, 500, 750, 1000] }
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  const max = step * p
  const parts = step === 2 ? 4 : 5
  return { max, ticks: Array.from({ length: parts + 1 }, (_, i) => (max / parts) * i) }
}

const short = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(v))

export function BarChart({ values, labels, tickEvery = 1 }: { values: number[]; labels: string[]; tickEvery?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const { max, ticks } = niceScale(Math.max(...values, 0))

  return (
    <div dir="ltr">
      <div className="mb-2 h-5 text-sm">
        {sel !== null ? (
          <>
            <span className="text-muted">{labels[sel]} · </span>
            <b>{money(values[sel])}</b>
          </>
        ) : (
          <span className="text-muted">Total · {money(values.reduce((a, b) => a + b, 0))}</span>
        )}
      </div>
      <div className="flex">
        <div className="relative h-40 w-8 shrink-0 text-[10px] text-muted tabular-nums">
          {ticks.map((v) => (
            <span key={v} className="absolute end-1 translate-y-1/2" style={{ bottom: `${(v / max) * 100}%` }}>
              {short(v)}
            </span>
          ))}
        </div>
        <div className="relative h-40 flex-1" onPointerLeave={() => setSel(null)}>
          {ticks.map((v) => (
            <div key={v} className={cls('absolute inset-x-0 border-t', v === 0 ? 'border-nude' : 'border-nude/50')} style={{ bottom: `${(v / max) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {values.map((v, i) => (
              <button
                key={i}
                className="flex h-full min-w-0 flex-1 items-end justify-center"
                onPointerEnter={() => setSel(i)}
                onClick={() => setSel(i)}
                aria-label={`${labels[i]}: ${money(v)}`}
              >
                <span
                  className={cls('w-full max-w-5 rounded-t-[4px] transition-colors', sel === i ? 'bg-rose-ink' : 'bg-rose', sel !== null && sel !== i && 'opacity-50')}
                  style={{ height: v ? `max(3px, ${(v / max) * 100}%)` : 0 }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ms-8 mt-1 flex gap-[2px] text-[10px] text-muted">
        {labels.map((l, i) => (
          <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {i % tickEvery === 0 ? l : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Sparkbars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className={cls('flex h-8 items-end gap-[2px]', className)} dir="ltr" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="w-1 rounded-t-[2px] bg-current" style={{ height: v ? `max(2px, ${(v / max) * 100}%)` : '2px', opacity: v ? 1 : 0.25 }} />
      ))}
    </div>
  )
}

export function Ring({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-blush-soft" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-emerald-600" strokeDasharray={`${v * c} ${c}`} />
    </svg>
  )
}

export function Donut({ parts, colors, size = 168 }: { parts: { label: string; value: number; color: number }[]; colors: string[]; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const [sel, setSel] = useState<number | null>(null)
  const stroke = 26
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = parts.length > 1 ? 2 : 0
  let acc = 0
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {parts.map((p, i) => {
            const len = (p.value / total) * c
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colors[p.color]}
                strokeWidth={sel === i ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-acc}
                onClick={() => setSel(sel === i ? null : i)}
                className="cursor-pointer transition-[stroke-width]"
              />
            )
            acc += len
            return el
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[60%] truncate text-xs text-muted">{sel !== null ? parts[sel].label : 'Total'}</span>
          <span className="text-base font-bold">{money(sel !== null ? parts[sel].value : total)}</span>
        </div>
      </div>
      <div className="mt-4 w-full space-y-2">
        {parts.map((p, i) => (
          <button key={p.label} onClick={() => setSel(sel === i ? null : i)} className={cls('flex w-full items-center gap-2.5 text-sm', sel !== null && sel !== i && 'opacity-50')}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colors[p.color] }} />
            <span className="flex-1 truncate text-start">{p.label}</span>
            <span className="text-muted">{money(p.value)}</span>
            <span className="w-11 text-end font-semibold tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}
