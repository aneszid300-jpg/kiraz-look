import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useSettings } from '../hooks'
import { useI18n } from '../i18n'
import { addDays, money, parseISO, today } from '../utils'
import { Icon, Sheet, type IconName } from './ui'

interface Alert {
  icon: IconName
  text: string
  to: string
  tone: 'danger' | 'warn' | 'info'
}

export function useAlerts(): Alert[] {
  const { t } = useI18n()
  const [settings] = useSettings()
  const data = useLiveQuery(async () => {
    const low = await db.products.filter((p) => p.qty <= p.minQty).count()
    const unpaid = await db.appointments
      .where('date')
      .between(addDays(today(), -7), today(), true, true)
      .filter((a) => !a.paymentId && (a.status === 'arrived' || a.status === 'done'))
      .count()
    const soon = await db.bridals.where('eventDate').between(today(), addDays(today(), 14), true, true).toArray()
    const brides = []
    for (const b of soon) {
      const paid = (await db.payments.where('bridalId').equals(b.id).toArray()).reduce((s, p) => s + p.amount, 0)
      if (b.total - paid > 0) brides.push({ b, rest: b.total - paid, name: (await db.clients.get(b.clientId))?.name ?? '' })
    }
    const hasData = (await db.clients.count()) > 0
    return { low, unpaid, brides, hasData }
  }, [])
  if (!data) return []

  const out: Alert[] = []
  if (data.unpaid) out.push({ icon: 'wallet', text: t('alertUnpaid', { n: data.unpaid }), to: '/cash', tone: 'danger' })
  if (data.low) out.push({ icon: 'box', text: t('alertLowStock', { n: data.low }), to: '/stock', tone: 'warn' })
  for (const { b, rest, name } of data.brides) {
    const n = Math.round((parseISO(b.eventDate).getTime() - parseISO(today()).getTime()) / 864e5)
    out.push({ icon: 'heart', text: t('alertBride', { name, n, amount: money(rest) }), to: `/bridal/${b.id}`, tone: 'info' })
  }
  if (data.hasData && (!settings.lastBackup || Date.now() - settings.lastBackup > 7 * 864e5))
    out.push({ icon: 'download', text: t('alertBackup'), to: '/settings', tone: 'warn' })
  return out
}

const toneCls = {
  danger: 'bg-red-50 text-red-700',
  warn: 'bg-amber-50 text-amber-800',
  info: 'bg-blush-soft text-rose-ink',
}

export function AlertsBell() {
  const { t } = useI18n()
  const nav = useNavigate()
  const alerts = useAlerts()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-nude active:bg-blush" aria-label={t('notifications')}>
        <Icon name="bell" size={19} />
        {alerts.length > 0 && (
          <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[11px] font-bold text-onaccent ring-2 ring-cream">
            {alerts.length}
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('notifications')}>
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-muted">{t('noAlerts')}</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <button
                key={i}
                onClick={() => {
                  setOpen(false)
                  nav(a.to)
                }}
                className={`flex w-full items-center gap-3 rounded-2xl p-3 text-start font-medium ${toneCls[a.tone]}`}
              >
                <Icon name={a.icon} size={20} />
                <span className="flex-1">{a.text}</span>
                <Icon name="chevron" size={16} flip />
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </>
  )
}
