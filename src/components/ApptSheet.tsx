import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Appointment, type Status } from '../db'
import { useClientMap, useServiceMap } from '../hooks'
import { useI18n } from '../i18n'
import { cls, endTime, money, waLink } from '../utils'
import { btnCls, Button, Icon, Sheet, STATUSES, statusStyle } from './ui'

export default function ApptSheet({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const clients = useClientMap()
  const services = useServiceMap()
  const payment = useLiveQuery(() => (appt?.paymentId ? db.payments.get(appt.paymentId) : undefined), [appt?.paymentId])

  if (!appt) return null
  const client = clients.get(appt.clientId)
  const svc = appt.serviceIds.map((id) => services.get(id)).filter(Boolean)
  const estimate = svc.reduce((s, x) => s + x!.price, 0)

  const setStatus = (status: Status) => db.appointments.update(appt.id, { status })

  const reminder = client
    ? waLink(
        client.phone,
        t('reminderMsg', {
          name: client.name.split(' ')[0],
          date: fmtDate(appt.date, { weekday: 'long', day: 'numeric', month: 'long' }),
          time: appt.start,
        }),
      )
    : ''

  return (
    <Sheet open onClose={onClose} title={client?.name ?? '—'}>
      <div className="mb-4 text-muted">
        {fmtDate(appt.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {appt.start} – {endTime(appt)}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {svc.map((s) => (
          <span key={s!.id} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-nude">
            {s!.name}
          </span>
        ))}
      </div>
      {appt.note && <p className="mb-4 rounded-xl bg-white p-3 text-sm ring-1 ring-nude">{appt.note}</p>}

      <div className="mb-1 text-sm font-medium text-muted">{t('status')}</div>
      <div className="mb-5 grid grid-cols-5 gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cls(
              'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight',
              appt.status === s ? statusStyle[s].badge + ' ring-2 ring-current' : 'bg-white text-muted ring-1 ring-nude',
            )}
          >
            <span className={cls('h-2.5 w-2.5 rounded-full', statusStyle[s].dot)} />
            {t(`st_${s}`)}
          </button>
        ))}
      </div>

      {payment ? (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">
          <span className="flex items-center gap-2">
            <Icon name="check" size={18} /> {t('paid')} · {t(`m_${payment.method}`)}
          </span>
          <span>{money(payment.amount)}</span>
        </div>
      ) : (
        appt.status !== 'cancelled' &&
        appt.status !== 'noshow' && (
          <Button className="mb-3 w-full" onClick={() => nav(`/checkout?appt=${appt.id}`)}>
            <Icon name="wallet" size={20} /> {t('checkout')} · {money(estimate)}
          </Button>
        )
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" onClick={() => nav(`/appt/${appt.id}`)}>
          <Icon name="edit" size={18} />
        </Button>
        {client && (
          <a href={`tel:${client.phone}`} className={btnCls('ghost')}>
            <Icon name="phone" size={18} />
          </a>
        )}
        {client && (
          <a href={reminder} target="_blank" rel="noreferrer" className={btnCls('soft', 'text-sm')}>
            <Icon name="chat" size={18} /> {t('reminder')}
          </a>
        )}
      </div>
      {client && (
        <button onClick={() => nav(`/clients/${client.id}`)} className="mt-4 w-full py-2 text-center text-sm font-semibold text-rose">
          {t('clients')} → {client.name}
        </button>
      )}
    </Sheet>
  )
}
