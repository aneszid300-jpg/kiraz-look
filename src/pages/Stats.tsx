import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Bridal, type Payment } from '../db'
import { useClientMap, useSettings } from '../hooks'
import { expCatIndex, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { addDays, cls, money, parseISO, toISO, today, toMin, weekStart } from '../utils'
import { Avatar, Card, Empty, Icon, Page, SectionTitle, Segmented, ThemeToggle } from '../components/ui'
import { BarChart, CAT_COLORS, Donut, Ring, Sparkbars } from '../components/Charts'
import { AlertsBell } from '../components/Alerts'
import { METHODS } from './Checkout'

type Period = 'day' | 'week' | 'month' | 'year'

function shift(p: Period, d: string, n: number) {
  if (p === 'day') return addDays(d, n)
  if (p === 'week') return addDays(d, 7 * n)
  const x = parseISO(d)
  x.setDate(1)
  if (p === 'month') x.setMonth(x.getMonth() + n)
  else x.setFullYear(x.getFullYear() + n)
  return toISO(x)
}

function range(p: Period, d: string): [string, string] {
  if (p === 'day') return [d, d]
  if (p === 'week') {
    const s = weekStart(d)
    return [s, addDays(s, 6)]
  }
  if (p === 'month') return [d.slice(0, 7) + '-01', d.slice(0, 7) + '-31']
  return [d.slice(0, 4) + '-01-01', d.slice(0, 4) + '-12-31']
}

const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)

/** CA = services sold + wedding packs whose wedding falls in the period (advances are cash, not turnover yet) */
const turnover = (pays: Payment[], brides: Bridal[]) => sum(pays.filter((p) => !p.bridalId)) + brides.reduce((s, b) => s + b.total, 0)

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const { t } = useI18n()
  if (!prev) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  const up = pct >= 0
  return (
    <span className={cls('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-emerald-400' : 'text-red-300')}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} />
      {up ? '+' : ''}
      {pct}% <span className="font-normal opacity-80">{t('vsPrev')}</span>
    </span>
  )
}

function Bars({ rows }: { rows: { key: string; label: string; value: string; ratio: number }[] }) {
  return (
    <Card className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-muted">{r.value}</span>
          </div>
          <div className="h-2 rounded-full bg-blush-soft">
            <div className="h-2 rounded-full bg-rose" style={{ width: `${Math.min(100, r.ratio * 100)}%` }} />
          </div>
        </div>
      ))}
    </Card>
  )
}

export default function Stats() {
  const { t, fmtDate, lang } = useI18n()
  const nav = useNavigate()
  const clients = useClientMap()
  const [theme] = useTheme()
  const [settings] = useSettings()
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(today())

  const [from, to] = range(period, anchor)
  const [pFrom, pTo] = range(period, shift(period, anchor, -1))
  const isCurrent = from <= today() && today() <= to

  const data = useLiveQuery(
    async () => ({
      pays: await db.payments.where('date').between(from, to, true, true).toArray(),
      exps: await db.expenses.where('date').between(from, to, true, true).toArray(),
      appts: await db.appointments.where('date').between(from, to, true, true).toArray(),
      brides: await db.bridals.where('eventDate').between(from, to, true, true).toArray(),
      prevPays: await db.payments.where('date').between(pFrom, pTo, true, true).toArray(),
      prevExps: await db.expenses.where('date').between(pFrom, pTo, true, true).toArray(),
      prevBrides: await db.bridals.where('eventDate').between(pFrom, pTo, true, true).toArray(),
    }),
    [from, to, pFrom, pTo],
  )

  const pays = data?.pays ?? []
  const exps = data?.exps ?? []
  const appts = data?.appts ?? []
  const brides = data?.brides ?? []

  const ca = turnover(pays, brides)
  const prevCa = turnover(data?.prevPays ?? [], data?.prevBrides ?? [])
  const costs = sum(exps)
  const prevCosts = sum(data?.prevExps ?? [])
  const collected = sum(pays)
  const margin = ca - costs
  const rate = ca ? margin / ca : 0

  // ---- buckets for the CA chart ----
  const locale = lang === 'ar' ? 'ar-DZ' : 'fr-FR'
  let labels: string[]
  let bucketOf: (date: string, time?: string) => number
  let tickEvery = 1
  if (period === 'day') {
    const h0 = Math.floor(toMin(settings.openTime) / 60)
    const h1 = Math.max(h0, Math.ceil(toMin(settings.closeTime) / 60) - 1)
    labels = Array.from({ length: h1 - h0 + 1 }, (_, i) => `${h0 + i}h`)
    bucketOf = (_d, time) => Math.min(h1, Math.max(h0, Number((time ?? '12').slice(0, 2)))) - h0
    tickEvery = labels.length > 8 ? 2 : 1
  } else if (period === 'week') {
    labels = Array.from({ length: 7 }, (_, i) => parseISO(addDays(from, i)).toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''))
    bucketOf = (d) => Math.round((parseISO(d).getTime() - parseISO(from).getTime()) / 864e5)
  } else if (period === 'month') {
    const dim = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0).getDate()
    labels = Array.from({ length: dim }, (_, i) => String(i + 1))
    bucketOf = (d) => Number(d.slice(8)) - 1
    tickEvery = 5
  } else {
    labels = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'narrow' }))
    bucketOf = (d) => Number(d.slice(5, 7)) - 1
  }
  const zeros = () => labels.map(() => 0)
  const caSeries = zeros()
  const cashSeries = zeros()
  const costSeries = zeros()
  for (const p of pays) {
    const i = bucketOf(p.date, p.time)
    cashSeries[i] += p.amount
    if (!p.bridalId) caSeries[i] += p.amount
  }
  for (const b of brides) caSeries[bucketOf(b.eventDate)] += b.total
  for (const e of exps) costSeries[bucketOf(e.date)] += e.amount
  const marginSeries = caSeries.map((v, i) => Math.max(0, v - costSeries[i]))

  // ---- expenses by category (colour follows the category) ----
  const byCat = new Map<string, number>()
  for (const e of exps) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
  const parts = [...byCat].map(([label, value]) => ({ label, value, color: expCatIndex(label) })).sort((a, b) => b.value - a.value)

  // ---- methods / services / clients ----
  const byMethod = METHODS.map((m) => ({ m, v: sum(pays.filter((p) => p.method === m)) }))
  const sales = pays.filter((p) => !p.bridalId)
  const svc = new Map<string, { n: number; sum: number }>()
  for (const p of sales)
    for (const it of p.items) {
      const v = svc.get(it.name) ?? { n: 0, sum: 0 }
      svc.set(it.name, { n: v.n + 1, sum: v.sum + it.price })
    }
  const topSvc = [...svc].sort((a, b) => b[1].n - a[1].n).slice(0, 6)
  const maxSvc = Math.max(1, ...topSvc.map(([, v]) => v.n))
  const cl = new Map<string, { n: number; sum: number }>()
  for (const p of pays) {
    if (!p.clientId || !clients.has(p.clientId)) continue
    const v = cl.get(p.clientId) ?? { n: 0, sum: 0 }
    cl.set(p.clientId, { n: v.n + 1, sum: v.sum + p.amount })
  }
  const topCl = [...cl].sort((a, b) => b[1].sum - a[1].sum).slice(0, 5)

  const done = appts.filter((a) => a.status === 'done').length
  const noshow = appts.filter((a) => a.status === 'noshow').length
  const avg = sales.length ? sum(sales) / sales.length : 0

  const periodLabel = isCurrent
    ? { day: t('today'), week: t('thisWeek'), month: t('thisMonth'), year: t('thisYear') }[period]
    : period === 'day'
      ? fmtDate(from, { weekday: 'short', day: 'numeric', month: 'short' })
      : period === 'week'
        ? `${fmtDate(from, { day: 'numeric', month: 'short' })} – ${fmtDate(to, { day: 'numeric', month: 'short' })}`
        : period === 'month'
          ? fmtDate(from, { month: 'long', year: 'numeric' })
          : from.slice(0, 4)

  return (
    <Page
      title={t('dashboard')}
      right={
        <div className="flex gap-2">
          <ThemeToggle />
          <AlertsBell />
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('overview')}</p>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-nude">
          <Icon name="calendar" size={14} />
          {fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      <Segmented
        value={period}
        onChange={(p) => {
          setPeriod(p)
          setAnchor(today())
        }}
        options={[
          { value: 'day', label: t('day') },
          { value: 'week', label: t('week') },
          { value: 'month', label: t('month') },
          { value: 'year', label: t('year') },
        ]}
      />

      <div className="my-3 flex items-center justify-between">
        <button onClick={() => setAnchor(shift(period, anchor, -1))} className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-nude" aria-label="prev">
          <Icon name="back" flip size={20} />
        </button>
        <span className="text-sm">
          <span className="text-muted">{t('period')} : </span>
          <b className="inline-block first-letter:uppercase">{periodLabel}</b>
        </span>
        <button
          onClick={() => setAnchor(shift(period, anchor, 1))}
          disabled={isCurrent}
          className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-nude disabled:opacity-30"
          aria-label="next"
        >
          <Icon name="chevron" flip size={20} />
        </button>
      </div>

      {/* Hero: turnover */}
      <div className={cls('rounded-3xl p-5 shadow-lg', theme === 'dark' ? 'bg-[#120d0e] text-[#f4e9eb] ring-1 ring-nude' : 'bg-ink text-cream')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm opacity-75">{t('turnover')}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{money(ca)}</div>
            <div className="mt-1.5 min-h-4">
              <Delta cur={ca} prev={prevCa} />
            </div>
          </div>
          <Sparkbars values={caSeries.slice(-14)} className="mt-1 text-[#e89aa6]" />
        </div>
        <div className="mt-2 text-xs text-[#e89aa6] first-letter:uppercase">{periodLabel}</div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Card className="!p-3.5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-xs text-muted">{t('netMargin')}</span>
            <Sparkbars values={marginSeries.slice(-10)} className="h-6 text-emerald-600" />
          </div>
          <div className={cls('mt-1 text-lg font-bold', margin < 0 && 'text-red-700')}>{money(margin)}</div>
        </Card>
        <Card className="!p-3.5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-xs text-muted">{t('totalCosts')}</span>
            <Sparkbars values={costSeries.slice(-10)} className="h-6 text-amber-500" />
          </div>
          <div className="mt-1 text-lg font-bold">{money(costs)}</div>
          {prevCosts > 0 && (
            <div className="text-[11px] text-muted">
              {t('vsPrev')} : {money(prevCosts)}
            </div>
          )}
        </Card>
        <Card className="!p-3.5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-xs text-muted">{t('collections')}</span>
            <Sparkbars values={cashSeries.slice(-10)} className="h-6 text-rose" />
          </div>
          <div className="mt-1 text-lg font-bold">{money(collected)}</div>
          <div className="text-[11px] text-muted">
            {pays.length} {t('transactions')}
          </div>
        </Card>
        <Card className="flex items-center justify-between gap-1 !p-3.5">
          <div>
            <span className="text-xs text-muted">{t('marginRate')}</span>
            <div className="mt-1 text-lg font-bold">{ca ? `${(rate * 100).toFixed(1)}%` : '—'}</div>
          </div>
          <Ring value={rate} />
        </Card>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Card className="!p-2.5">
          <div className="text-lg font-bold">{done}</div>
          <div className="text-[11px] text-muted">{t('appointments')}</div>
        </Card>
        <Card className="!p-2.5">
          <div className="text-sm font-bold leading-7">{money(avg)}</div>
          <div className="text-[11px] text-muted">{t('avgTicket')}</div>
        </Card>
        <Card className="!p-2.5">
          <div className={cls('text-lg font-bold', noshow > 0 && 'text-red-700')}>{noshow}</div>
          <div className="text-[11px] text-muted">{t('noshowRate')}</div>
        </Card>
      </div>

      <SectionTitle>{t('caEvolution')}</SectionTitle>
      <Card className="!p-3">
        <BarChart values={caSeries} labels={labels} tickEvery={tickEvery} />
      </Card>

      <SectionTitle>{t('expByCat')}</SectionTitle>
      <Card>{parts.length ? <Donut parts={parts} colors={CAT_COLORS[theme]} /> : <p className="py-6 text-center text-sm text-muted">{t('noData')}</p>}</Card>

      <SectionTitle>{t('byMethod')}</SectionTitle>
      <Bars
        rows={byMethod.map(({ m, v }) => ({
          key: m,
          label: t(`m_${m}`),
          value: `${money(v)} · ${collected ? Math.round((v / collected) * 100) : 0}%`,
          ratio: collected ? v / collected : 0,
        }))}
      />

      <SectionTitle>{t('topServices')}</SectionTitle>
      {topSvc.length === 0 ? (
        <Empty icon="scissors" text={t('noData')} />
      ) : (
        <Bars rows={topSvc.map(([name, v]) => ({ key: name, label: name, value: `×${v.n} · ${money(v.sum)}`, ratio: v.n / maxSvc }))} />
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
