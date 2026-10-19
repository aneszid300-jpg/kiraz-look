import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Appointment } from '../db'
import { useClientMap, useServiceMap } from '../hooks'
import { useI18n } from '../i18n'
import { addDays, cls, endTime, overlaps, today, waLink, weekStart } from '../utils'
import { Card, Empty, Fab, Icon, Page, Segmented, StatusBadge, statusStyle } from '../components/ui'
import ApptSheet from '../components/ApptSheet'

const isActive = (a: Appointment) => a.status === 'confirmed' || a.status === 'arrived'

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
  const date = params.get('d') ?? today()
  const view = (params.get('v') as 'day' | 'week') ?? 'day'
  const [openId, setOpenId] = useState<string | null>(null)

  const set = (d: string, v = view) => setParams({ d, v }, { replace: true })

  const ws = weekStart(date)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i))

  const weekAppts = useLiveQuery(
    () => db.appointments.where('date').between(weekDays[0], weekDays[6], true, true).toArray(),
    [ws],
    [] as Appointment[],
  )
  const clients = useClientMap()
  const services = useServiceMap()
  const conflicts = conflictIds(weekAppts)
  const byDay = (d: string) => weekAppts.filter((a) => a.date === d).sort((a, b) => a.start.localeCompare(b.start))
  const dayAppts = byDay(date)
  const openAppt = weekAppts.find((a) => a.id === openId) ?? null

  const md = date.slice(5)
  const birthdays = [...clients.values()].filter((c) => c.birthday?.slice(5) === md)

  const step = view === 'day' ? 1 : 7

  return (
    <Page
      title="Kiraz Look"
      right={
        date !== today() && (
          <button onClick={() => set(today())} className="rounded-full bg-blush px-3 py-1.5 text-sm font-semibold text-rose-dark">
            {t('today')}
          </button>
        )
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
        <button onClick={() => set(addDays(date, -step))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude active:bg-blush">
          <Icon name="back" flip />
        </button>
        <div className="text-center font-semibold capitalize">
          {view === 'day'
            ? fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
            : `${fmtDate(weekDays[0], { day: 'numeric', month: 'short' })} – ${fmtDate(weekDays[6], { day: 'numeric', month: 'short' })}`}
        </div>
        <button onClick={() => set(addDays(date, step))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude active:bg-blush">
          <Icon name="chevron" flip />
        </button>
      </div>

      {view === 'day' && (
        <>
          {/* week strip */}
          <div className="mb-4 grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const n = byDay(d).filter((a) => a.status !== 'cancelled').length
              const sel = d === date
              return (
                <button
                  key={d}
                  onClick={() => set(d)}
                  className={cls('flex flex-col items-center rounded-xl py-2', sel ? 'bg-rose text-white' : 'bg-white ring-1 ring-nude', d === today() && !sel && 'ring-2 ring-rose')}
                >
                  <span className={cls('text-[10px] uppercase', sel ? 'text-white/80' : 'text-muted')}>{fmtDate(d, { weekday: 'short' }).replace('.', '')}</span>
                  <span className="text-lg font-bold leading-6">{Number(d.slice(8))}</span>
                  <span className={cls('mt-0.5 h-1.5 w-1.5 rounded-full', n ? (sel ? 'bg-white' : 'bg-rose') : 'bg-transparent')} />
                </button>
              )
            })}
          </div>

          {birthdays.map((c) => (
            <a
              key={c.id}
              href={waLink(c.phone)}
              target="_blank"
              rel="noreferrer"
              className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-gold/25 to-blush p-3 text-sm"
            >
              <Icon name="cake" className="text-gold" />
              <span className="flex-1">
                <b>{t('birthdaysToday')}</b> · {c.name}
              </span>
              <Icon name="chat" size={18} className="text-rose" />
            </a>
          ))}

          {dayAppts.length === 0 ? (
            <Empty icon="calendar" text={t('noAppt')} />
          ) : (
            <div className="space-y-2.5">
              {dayAppts.map((a) => {
                const c = clients.get(a.clientId)
                return (
                  <Card
                    key={a.id}
                    onClick={() => setOpenId(a.id)}
                    className={cls('flex gap-3 border-s-4 !p-3', statusStyle[a.status].bar, (a.status === 'cancelled' || a.status === 'noshow') && 'opacity-60')}
                  >
                    <div className="w-14 shrink-0 text-center">
                      <div className="text-lg font-bold">{a.start}</div>
                      <div className="text-xs text-muted">{endTime(a)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{c?.name ?? '—'}</span>
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
                        {a.paymentId && <Icon name="check" size={16} className="text-emerald-600" />}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {view === 'week' && (
        <div className="space-y-3">
          {weekDays.map((d) => {
            const list = byDay(d)
            return (
              <Card key={d} className="!p-0">
                <button onClick={() => set(d, 'day')} className={cls('flex w-full items-center justify-between px-4 py-3', list.length > 0 && 'border-b border-nude/60')}>
                  <span className={cls('font-semibold capitalize', d === today() && 'text-rose')}>{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                  <span className="rounded-full bg-blush-soft px-2.5 py-0.5 text-sm font-semibold text-rose-dark">{list.filter((a) => a.status !== 'cancelled').length}</span>
                </button>
                {list.map((a) => (
                  <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start active:bg-blush-soft">
                    <span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', statusStyle[a.status].dot)} />
                    <span className="w-12 shrink-0 font-semibold">{a.start}</span>
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
