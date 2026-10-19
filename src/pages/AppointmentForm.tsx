import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Appointment, type Status } from '../db'
import { useClientMap, useServiceMap } from '../hooks'
import { useI18n } from '../i18n'
import { cls, endTime, fmtDuration, fromMin, money, overlaps, today } from '../utils'
import { Button, Field, Icon, Input, Page, Select, STATUSES, Textarea, confirmDelete } from '../components/ui'
import { ClientPicker, ServiceChips } from '../components/Pickers'

const nextSlot = () => {
  const d = new Date()
  const m = d.getHours() * 60 + d.getMinutes()
  return fromMin(Math.min(Math.ceil(m / 30) * 30, 23 * 60))
}

export default function AppointmentForm() {
  const { t } = useI18n()
  const nav = useNavigate()
  const { id } = useParams()
  const [params] = useSearchParams()
  const services = useServiceMap()
  const clients = useClientMap()

  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(params.get('date') ?? today())
  const [start, setStart] = useState(params.get('time') ?? (params.get('date') && params.get('date') !== today() ? '09:00' : nextSlot()))
  const [duration, setDuration] = useState(30)
  const [durationTouched, setDurationTouched] = useState(false)
  const [status, setStatus] = useState<Status>('confirmed')
  const [note, setNote] = useState('')
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

  // auto duration from services
  useEffect(() => {
    if (durationTouched) return
    const d = serviceIds.reduce((s, x) => s + (services.get(x)?.duration ?? 0), 0)
    if (d) setDuration(d)
  }, [serviceIds, services, durationTouched])

  const sameDay = useLiveQuery(() => db.appointments.where('date').equals(date).toArray(), [date], [] as Appointment[])
  const conflicts =
    status === 'cancelled' || status === 'noshow'
      ? []
      : sameDay.filter((a) => a.id !== id && (a.status === 'confirmed' || a.status === 'arrived') && overlaps(a, { start, duration }))

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
      <Field label={`1 · ${t('client')}`} hint={tried && !clientId ? t('required') : undefined}>
        <ClientPicker value={clientId} onChange={setClientId} />
      </Field>

      <div className="mb-4">
        <div className="mb-1.5 text-sm font-medium text-muted">2 · {t('services')}</div>
        <ServiceChips value={serviceIds} onChange={setServiceIds} />
        {tried && !serviceIds.length && <span className="mt-1 block text-xs text-rose">{t('required')}</span>}
      </div>

      <div className="mb-1.5 text-sm font-medium text-muted">3 · {t('date')} / {t('time')}</div>
      <div className="grid grid-cols-2 gap-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} />
      </div>

      <div className="mb-4 mt-4 grid grid-cols-2 gap-3">
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
      </div>

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

      <Field label={t('note')}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-nude/70 bg-cream/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto mb-3 flex max-w-xl items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-muted">
              {start} – {endTime({ start, duration })}
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
