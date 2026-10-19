import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Appointment } from '../db'
import { useClientMap, useServiceMap, useSettings } from '../hooks'
import { useI18n } from '../i18n'
import { addDays, cls, endTime, fmtDuration, fromMin, money, nowTime, overlaps, today, toMin, weekStart } from '../utils'
import { Card, Empty, Fab, Icon, Page, Segmented, StatusBadge, statusStyle } from '../components/ui'
import { AlertsBell } from '../components/Alerts'
import ApptSheet from '../components/ApptSheet'

const isActive = (a: Appointment) => a.status === 'confirmed' || a.status === 'arrived'
const counts = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'noshow'

export function conflictIds(list: Appointment[]) {
  const ids = new Set<string>()
  const act = list.filter(isActive)
  for (let i = 0; i < act.length; i++)
    for (let j = i + 1; j < act.length; j++)
      if (act[i].date === act[j].date && overlaps(act[i], act[j])) {
        ids.add(act[i].id)
        ids.add(act[j].id)
      }
  return ids
}

export default function Agenda() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [settings] = useSettings()
  const date = params.get('d') ?? today()
  const view = (params.get('v') as 'day' | 'week') ?? 'day'
  const [openId, setOpenId] = useState<string | null>(null)

  const set = (d: string, v = view) => setParams({ d, v }, { replace: true })

  const ws = weekStart(date)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i))

  const weekAppts = useLiveQuery(() => db.appointments.where('date').between(weekDays[0], weekDays[6], true, true).toArray(), [ws], [] as Appointment[])
  const clients = useClientMap()
  const services = useServiceMap()
  const conflicts = conflictIds(weekAppts)
  const byDay = (d: string) => weekAppts.filter((a) => a.date === d).sort((a, b) => a.start.localeCompare(b.start))
  const dayAppts = byDay(date)
  const openAppt = weekAppts.find((a) => a.id === openId) ?? null

  const priceOf = (a: Appointment) => a.serviceIds.reduce((s, id) => s + (services.get(id)?.price ?? 0), 0)
  const dayTotal = (list: Appointment[]) => list.filter(counts).reduce((s, a) => s + priceOf(a), 0)

  const live = dayAppts.filter(counts)
  const doneCount = live.filter((a) => a.status === 'done').length
  const step = view === 'day' ? 1 : 7
  const isToday = date === today()

  // ---- day timeline: appointments, free gaps and the "now" line ----
  const rows: ReactNode[] = []
  const open = toMin(settings.openTime)
  const close = toMin(settings.closeTime)
  const minGap = settings.slotStep || 30
  const now = toMin(nowTime())
  let cursor = open
  let nowShown = !isToday || now < open || now >= close

  const pushNow = (before: number) => {
    if (!nowShown && now <= before) {
      rows.push(
        <div key="now" className="flex items-center gap-2 text-xs font-bold text-red-500">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          {t('now')} · {nowTime()}
          <span className="h-px flex-1 bg-red-300" />
        </div>,
      )
      nowShown = true
    }
  }
  const pushGap = (from: number, to: number) => {
    if (date < today()) return
    const s = Math.max(from, isToday ? Math.ceil(now / minGap) * minGap : from)
    if (to - s < minGap) return
    rows.push(
      <button
        key={`gap-${s}`}
        onClick={() => nav(`/appt/new?date=${date}&time=${fromMin(s)}`)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-nude px-3 py-2.5 text-sm text-muted active:bg-blush-soft"
      >
        <span className="w-14 text-center font-semibold tabular-nums">{fromMin(s)}</span>
        <span className="flex-1 text-start">
          {t('freeSlots')} · {fmtDuration(to - s)}
        </span>
        <Icon name="plus" size={18} className="text-rose" />
      </button>,
    )
  }

  for (const a of dayAppts) {
    const s = toMin(a.start)
    if (counts(a)) {
      pushNow(s)
      pushGap(cursor, Math.min(s, close))
    }
    const c = clients.get(a.clientId)
    rows.push(
      <Card
        key={a.id}
        onClick={() => setOpenId(a.id)}
        className={cls('flex gap-3 border-s-4 !p-3', statusStyle[a.status].bar, !counts(a) && 'opacity-55', a.status === 'done' && 'opacity-80')}
      >
        <div className="w-14 shrink-0 text-center">
          <div className="text-lg font-bold tabular-nums">{a.start}</div>
          <div className="text-xs text-muted tabular-nums">{endTime(a)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{c?.name ?? '—'}</span>
            {c?.allergies && <Icon name="alert" size={14} className="shrink-0 text-amber-500" />}
            {conflicts.has(a.id) && <Icon name="alert" size={16} className="shrink-0 text-red-500" />}
          </div>
          <div className="truncate text-sm text-muted">
            {a.serviceIds
              .map((id) => services.get(id)?.name)
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={a.status} />
            {a.paymentId ? <Icon name="check" size={16} className="text-emerald-600" /> : <span className="text-xs text-muted">{money(priceOf(a))}</span>}
          </div>
        </div>
      </Card>,
    )
    if (counts(a)) cursor = Math.max(cursor, s + a.duration)
  }
  pushNow(close)
  if (dayAppts.length) pushGap(cursor, close)

  return (
    <Page
      title="Kiraz Look"
      right={
        <div className="flex items-center gap-2">
          {date !== today() && (
            <button onClick={() => set(today())} className="rounded-full bg-blush px-3 py-1.5 text-sm font-semibold text-rose-ink">
              {t('today')}
            </button>
          )}
          <AlertsBell />
        </div>
      }
    >
      <Segmented
        value={view}
        onChange={(v) => set(date, v)}
        options={[
          { value: 'day', label: t('day') },
          { value: 'week', label: t('week') },
        ]}
      />

      <div className="my-3 flex items-center justify-between">
        <button onClick={() => set(addDays(date, -step))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude active:bg-blush" aria-label="prev">
          <Icon name="back" flip />
        </button>
        <div className="text-center font-semibold capitalize">
          {view === 'day'
            ? fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
            : `${fmtDate(weekDays[0], { day: 'numeric', month: 'short' })} – ${fmtDate(weekDays[6], { day: 'numeric', month: 'short' })}`}
        </div>
        <button onClick={() => set(addDays(date, step))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude active:bg-blush" aria-label="next">
          <Icon name="chevron" flip />
        </button>
      </div>

      {view === 'day' && (
        <>
          <div className="mb-3 grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const n = byDay(d).filter(counts).length
              const sel = d === date
              return (
                <button
                  key={d}
                  onClick={() => set(d)}
                  className={cls('flex flex-col items-center rounded-xl py-2', sel ? 'bg-rose text-onaccent' : 'bg-white ring-1 ring-nude', d === today() && !sel && 'ring-2 ring-rose')}
                >
                  <span className={cls('text-[10px] uppercase', sel ? 'text-onaccent/80' : 'text-muted')}>{fmtDate(d, { weekday: 'short' }).replace('.', '')}</span>
                  <span className="text-lg font-bold leading-6">{Number(d.slice(8))}</span>
                  <span className={cls('text-[10px] font-semibold leading-3', sel ? 'text-onaccent/90' : 'text-rose')}>{n || ' '}</span>
                </button>
              )
            })}
          </div>

          {live.length > 0 && (
            <div className="mb-3 rounded-2xl bg-white p-3 ring-1 ring-nude">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{t('daySummary', { n: live.length, amount: money(dayTotal(dayAppts)) })}</span>
                <span className="text-muted tabular-nums">
                  {doneCount}/{live.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-blush-soft">
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / live.length) * 100}%` }} />
              </div>
            </div>
          )}

          {dayAppts.length === 0 ? <Empty icon="calendar" text={t('noAppt')} /> : <div className="space-y-2.5">{rows}</div>}
        </>
      )}

      {view === 'week' && (
        <div className="space-y-3">
          {weekDays.map((d) => {
            const list = byDay(d)
            const n = list.filter(counts).length
            return (
              <Card key={d} className="!p-0">
                <button onClick={() => set(d, 'day')} className={cls('flex w-full items-center justify-between gap-2 px-4 py-3', list.length > 0 && 'border-b border-nude/60')}>
                  <span className={cls('font-semibold capitalize', d === today() && 'text-rose')}>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                  <span className="flex items-center gap-2">
                    {n > 0 && <span className="text-xs text-muted">{money(dayTotal(list))}</span>}
                    <span className="rounded-full bg-blush-soft px-2.5 py-0.5 text-sm font-semibold text-rose-ink">{n}</span>
                  </span>
                </button>
                {list.map((a) => (
                  <button key={a.id} onClick={() => setOpenId(a.id)} className={cls('flex w-full items-center gap-3 px-4 py-2.5 text-start active:bg-blush-soft', !counts(a) && 'opacity-55')}>
                    <span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', statusStyle[a.status].dot)} />
                    <span className="w-12 shrink-0 font-semibold tabular-nums">{a.start}</span>
                    <span className="flex-1 truncate">{clients.get(a.clientId)?.name}</span>
                    {conflicts.has(a.id) && <Icon name="alert" size={16} className="text-red-500" />}
                  </button>
                ))}
              </Card>
            )
          })}
        </div>
      )}

      <Fab label={t('newAppt')} onClick={() => nav(`/appt/new?date=${date}`)} />
      <ApptSheet appt={openAppt} onClose={() => setOpenId(null)} />
    </Page>
  )
}
