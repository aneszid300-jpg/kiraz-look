import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Appointment, type Status } from '../db'
import { useClientMap, useServiceMap, useSettings } from '../hooks'
import { useI18n } from '../i18n'
import { addDays, cls, endTime, fmtDuration, fromMin, money, nowTime, overlaps, today, toMin } from '../utils'
import { Button, Field, Icon, Input, Page, Select, STATUSES, Textarea, confirmDelete } from '../components/ui'
import { ClientPicker, ServiceChips } from '../components/Pickers'

const isActive = (a: Appointment) => a.status === 'confirmed' || a.status === 'arrived'

export default function AppointmentForm() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const { id } = useParams()
  const [params] = useSearchParams()
  const services = useServiceMap()
  const clients = useClientMap()
  const [settings] = useSettings()

  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(params.get('date') ?? today())
  const [start, setStart] = useState(params.get('time') ?? '')
  const [duration, setDuration] = useState(30)
  const [durationTouched, setDurationTouched] = useState(false)
  const [status, setStatus] = useState<Status>('confirmed')
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')
  const [loaded, setLoaded] = useState(!id)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!id) return
    db.appointments.get(id).then((a) => {
      if (!a) return nav('/', { replace: true })
      setClientId(a.clientId)
      setServiceIds(a.serviceIds)
      setDate(a.date)
      setStart(a.start)
      setDuration(a.duration)
      setDurationTouched(true)
      setStatus(a.status)
      setNote(a.note ?? '')
      setLoaded(true)
    })
  }, [id, nav])

  // duration follows the chosen services until edited by hand
  useEffect(() => {
    if (durationTouched) return
    const d = serviceIds.reduce((s, x) => s + (services.get(x)?.duration ?? 0), 0)
    if (d) setDuration(d)
  }, [serviceIds, services, durationTouched])

  const sameDay = useLiveQuery(() => db.appointments.where('date').equals(date).toArray(), [date], [] as Appointment[])
  const others = sameDay.filter((a) => a.id !== id && isActive(a))
  const lastVisit = useLiveQuery(
    async () => (clientId ? (await db.appointments.where('clientId').equals(clientId).filter((a) => a.status === 'done' && a.id !== id).sortBy('date')).pop() : undefined),
    [clientId, id],
  )

  // ---- time slots ----
  const open = toMin(settings.openTime)
  const close = toMin(settings.closeTime)
  const step = settings.slotStep || 30
  const slots: string[] = []
  for (let m = open; m < close; m += step) slots.push(fromMin(m))
  const past = (s: string) => date === today() && s < nowTime()
  const busyAt = (s: string) => others.some((a) => overlaps(a, { start: s, duration }))

  const conflicts = status === 'cancelled' || status === 'noshow' || !start ? [] : others.filter((a) => overlaps(a, { start, duration }))

  const client = clients.get(clientId)
  const price = serviceIds.reduce((s, x) => s + (services.get(x)?.price ?? 0), 0)
  const valid = clientId && serviceIds.length && date && start && duration > 0

  const save = async () => {
    setTried(true)
    if (!valid) return
    const data = { clientId, serviceIds, date, start, duration, status, note: note.trim() || undefined }
    if (id) await db.appointments.update(id, data)
    else await db.appointments.add({ id: uid(), ...data, createdAt: Date.now() })
    nav(`/?d=${date}&v=day`, { replace: true })
  }

  const remove = async () => {
    if (!id || !confirmDelete(t)) return
    await db.appointments.delete(id)
    nav(-1)
  }

  if (!loaded) return null

  const dateChip = (d: string, label: string) => (
    <button
      type="button"
      onClick={() => setDate(d)}
      className={cls('rounded-xl px-3 py-2.5 text-sm font-semibold ring-1', date === d ? 'bg-rose text-onaccent ring-rose' : 'bg-white ring-nude')}
    >
      {label}
    </button>
  )

  return (
    <Page
      title={id ? t('editAppt') : t('newAppt')}
      back
      noNav
      right={
        id && (
          <button onClick={remove} className="grid h-10 w-10 place-items-center rounded-full text-red-600 active:bg-red-50" aria-label={t('delete')}>
            <Icon name="trash" size={20} />
          </button>
        )
      }
    >
      {/* 1. Client */}
      <Field label={`1 · ${t('client')}`} hint={tried && !clientId ? t('required') : undefined}>
        <ClientPicker value={clientId} onChange={setClientId} />
      </Field>
      {client?.allergies && (
        <div className="-mt-2 mb-4 flex gap-2 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900">
          <Icon name="alert" size={18} className="shrink-0" />
          <span>
            <b>{t('allergies')} :</b> {client.allergies}
          </span>
        </div>
      )}

      {/* 2. Services */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">2 · {t('services')}</span>
          {serviceIds.length > 0 && (
            <span className="text-xs font-semibold text-rose-ink">
              {serviceIds.length} · {money(price)} · {fmtDuration(duration)}
            </span>
          )}
        </div>
        {lastVisit && lastVisit.serviceIds.join() !== serviceIds.join() && (
          <button
            type="button"
            onClick={() => setServiceIds(lastVisit.serviceIds.filter((s) => services.has(s)))}
            className="mb-2 flex w-full items-center gap-2 rounded-xl bg-blush-soft px-3 py-2.5 text-start text-sm"
          >
            <Icon name="repeat" size={16} className="shrink-0 text-rose" />
            <span className="min-w-0 flex-1">
              <b>{t('sameAsLast')}</b>
              <span className="block truncate text-xs text-muted">
                {fmtDate(lastVisit.date, { day: 'numeric', month: 'short' })} · {lastVisit.serviceIds.map((s) => services.get(s)?.name).filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
        )}
        <div className="relative mb-3">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchService')} className="!py-2.5 ps-10" />
        </div>
        <ServiceChips value={serviceIds} onChange={setServiceIds} query={q} />
        {tried && !serviceIds.length && <span className="mt-1 block text-xs text-rose">{t('required')}</span>}
      </div>

      {/* 3. Date & time */}
      <div className="mb-1.5 text-sm font-medium text-muted">3 · {t('date')}</div>
      <div className="mb-4 grid grid-cols-[auto_auto_1fr] gap-2">
        {dateChip(today(), t('today'))}
        {dateChip(addDays(today(), 1), t('tomorrow'))}
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!py-2.5" />
      </div>

      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-muted">
          {t('freeSlots')} · <span className="capitalize">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-red-200" /> {t('busy')}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-5 gap-1.5">
        {slots.map((s) => {
          const busy = busyAt(s)
          const sel = s === start
          return (
            <button
              type="button"
              key={s}
              disabled={past(s) && !sel}
              onClick={() => setStart(s)}
              className={cls(
                'rounded-lg py-2 text-sm font-semibold tabular-nums ring-1 disabled:opacity-30',
                sel ? 'bg-rose text-onaccent ring-rose' : busy ? 'bg-red-50 text-red-700 line-through decoration-1 ring-red-200' : 'bg-white ring-nude',
              )}
            >
              {s}
            </button>
          )
        })}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label={t('otherTime')}>
          <Input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label={t('duration')}>
          <Select
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value))
              setDurationTouched(true)
            }}
          >
            {[...new Set([15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300, duration])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {fmtDuration(m)}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      {tried && !start && <p className="-mt-3 mb-3 text-xs text-rose">{t('required')}</p>}

      {conflicts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Icon name="alert" size={18} /> {t('conflict')}
          </div>
          {conflicts.map((c) => (
            <div key={c.id}>
              {t('conflictWith')} : <b>{clients.get(c.clientId)?.name}</b> ({c.start} – {endTime(c)})
            </div>
          ))}
        </div>
      )}

      {id && (
        <Field label={t('status')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`st_${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label={t('note')}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-nude/70 bg-cream/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto mb-3 flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-muted">
              {client?.name ?? '—'} · {start ? `${start} – ${endTime({ start, duration })}` : '--:--'}
            </div>
            <div className="text-lg font-bold">{money(price)}</div>
          </div>
          <Button onClick={save} className={cls('flex-[1.4]', conflicts.length > 0 && '!bg-red-600')}>
            {conflicts.length > 0 ? t('saveAnyway') : t('save')}
          </Button>
        </div>
      </div>
      <div className="h-20" />
    </Page>
  )
}
