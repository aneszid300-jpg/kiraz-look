import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Appointment, type Expense, type Payment } from '../db'
import { useClientMap } from '../hooks'
import { useI18n } from '../i18n'
import { cls, money, monthKey, parseISO, toISO, today } from '../utils'
import { Avatar, Card, Empty, Icon, Page, SectionTitle } from '../components/ui'

const shiftMonth = (m: string, n: number) => {
  const d = parseISO(m + '-01')
  d.setMonth(d.getMonth() + n)
  return toISO(d).slice(0, 7)
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={cls('!p-3', accent && '!bg-blush-soft')}>
      <div className="text-xs text-muted first-letter:uppercase">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </Card>
  )
}

export default function Stats() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const clients = useClientMap()
  const [month, setMonth] = useState(monthKey(today()))
  const [hover, setHover] = useState<number | null>(null)

  const from = month + '-01'
  const to = month + '-31'
  const payments = useLiveQuery(() => db.payments.where('date').between(from, to, true, true).toArray(), [month], [] as Payment[])
  const expenses = useLiveQuery(() => db.expenses.where('date').between(from, to, true, true).toArray(), [month], [] as Expense[])
  const appts = useLiveQuery(() => db.appointments.where('date').between(from, to, true, true).toArray(), [month], [] as Appointment[])
  const allPayments = useLiveQuery(() => db.payments.toArray(), [], [] as Payment[])
  const todayRev = useLiveQuery(async () => (await db.payments.where('date').equals(today()).toArray()).reduce((s, p) => s + p.amount, 0), [], 0)

  const revenue = payments.reduce((s, p) => s + p.amount, 0)
  const spent = expenses.reduce((s, e) => s + e.amount, 0)
  const profit = revenue - spent
  const doneCount = appts.filter((a) => a.status === 'done').length
  const noshow = appts.filter((a) => a.status === 'noshow').length
  const avg = payments.length ? revenue / payments.length : 0

  // daily revenue
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const daily = Array.from({ length: daysInMonth }, (_, i) => payments.filter((p) => Number(p.date.slice(8)) === i + 1).reduce((s, p) => s + p.amount, 0))
  const maxDay = Math.max(1, ...daily)

  // top services (from cashed items)
  const svc = new Map<string, { n: number; sum: number }>()
  for (const p of payments)
    for (const it of p.items) {
      const v = svc.get(it.name) ?? { n: 0, sum: 0 }
      svc.set(it.name, { n: v.n + 1, sum: v.sum + it.price })
    }
  const topSvc = [...svc].sort((a, b) => b[1].n - a[1].n).slice(0, 8)
  const maxSvc = Math.max(1, ...topSvc.map(([, v]) => v.n))

  // loyal clients (all time)
  const cl = new Map<string, { n: number; sum: number }>()
  for (const p of allPayments) {
    if (!p.clientId) continue
    const v = cl.get(p.clientId) ?? { n: 0, sum: 0 }
    cl.set(p.clientId, { n: v.n + 1, sum: v.sum + p.amount })
  }
  const topCl = [...cl].filter(([id]) => clients.has(id)).sort((a, b) => b[1].n - a[1].n || b[1].sum - a[1].sum).slice(0, 8)

  const isCurrent = month === monthKey(today())

  return (
    <Page title={t('stats')}>
      <Card className="mb-4 flex items-center justify-between !bg-gradient-to-br from-rose to-rose-dark !p-4 text-white">
        <span className="text-sm text-white/85">{t('todayRevenue')}</span>
        <span className="text-2xl font-bold">{money(todayRev)}</span>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude">
          <Icon name="back" flip />
        </button>
        <span className="font-semibold capitalize">{fmtDate(from, { month: 'long', year: 'numeric' })}</span>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={isCurrent}
          className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude disabled:opacity-30"
        >
          <Icon name="chevron" flip />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label={t('revenue')} value={money(revenue)} />
        <Tile label={t('expenses')} value={money(spent)} />
        <div className="col-span-2">
          <Card className={cls('!p-4', profit >= 0 ? '!bg-emerald-50' : '!bg-red-50')}>
            <div className="text-sm text-muted">{t('profit')}</div>
            <div className={cls('text-3xl font-bold', profit >= 0 ? 'text-emerald-800' : 'text-red-700')}>{money(profit)}</div>
          </Card>
        </div>
        <Tile label={t('appointments')} value={String(doneCount)} />
        <Tile label={t('avgTicket')} value={money(avg)} />
        <Tile label={t('noshowRate')} value={String(noshow)} />
        <Tile label={t('transactions')} value={String(payments.length)} />
      </div>

      <SectionTitle>{t('revenue')} / {t('day').toLowerCase()}</SectionTitle>
      <Card className="!p-3">
        <div className="mb-2 h-5 text-sm">
          {hover !== null ? (
            <>
              <span className="text-muted">{fmtDate(`${month}-${String(hover + 1).padStart(2, '0')}`, { weekday: 'short', day: 'numeric' })} · </span>
              <b>{money(daily[hover])}</b>
            </>
          ) : (
            <span className="text-muted">max {money(maxDay === 1 ? 0 : maxDay)}</span>
          )}
        </div>
        <div className="flex h-36 items-end gap-[2px] border-b border-nude" dir="ltr" onPointerLeave={() => setHover(null)}>
          {daily.map((v, i) => (
            <button
              key={i}
              onPointerEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              className="flex h-full flex-1 items-end"
              aria-label={`${i + 1}: ${money(v)}`}
            >
              <span
                className={cls('w-full rounded-t-[4px]', hover === i ? 'bg-rose-dark' : 'bg-rose')}
                style={{ height: v ? `${Math.max(3, (v / maxDay) * 100)}%` : 0 }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted" dir="ltr">
          <span>1</span>
          <span>10</span>
          <span>20</span>
          <span>{daysInMonth}</span>
        </div>
      </Card>

      <SectionTitle>{t('topServices')}</SectionTitle>
      {topSvc.length === 0 ? (
        <Empty icon="scissors" text={t('noData')} />
      ) : (
        <Card className="space-y-3">
          {topSvc.map(([name, v]) => (
            <div key={name}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{name}</span>
                <span className="text-muted">
                  ×{v.n} · {money(v.sum)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-blush-soft">
                <div className="h-2 rounded-full bg-rose" style={{ width: `${(v.n / maxSvc) * 100}%` }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <SectionTitle>{t('topClients')}</SectionTitle>
      {topCl.length === 0 ? (
        <Empty icon="heart" text={t('noData')} />
      ) : (
        <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
          {topCl.map(([id, v], i) => (
            <button key={id} onClick={() => nav(`/clients/${id}`)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start active:bg-blush-soft">
              <span className={cls('w-5 text-center font-bold', i < 3 ? 'text-gold' : 'text-muted')}>{i + 1}</span>
              <Avatar name={clients.get(id)!.name} size={36} />
              <span className="flex-1 truncate font-medium">{clients.get(id)!.name}</span>
              <span className="text-end text-sm">
                <span className="block font-semibold">{money(v.sum)}</span>
                <span className="block text-xs text-muted">
                  {v.n} {t('visits')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Page>
  )
}
