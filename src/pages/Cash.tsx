import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Appointment, type Payment } from '../db'
import { useClientMap, useServiceMap } from '../hooks'
import { useI18n } from '../i18n'
import { addDays, money, today } from '../utils'
import { Button, Card, confirmDelete, Empty, Fab, Icon, Page, SectionTitle, Sheet } from '../components/ui'
import { METHODS } from './Checkout'

export default function Cash() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('d') ?? today()
  const [open, setOpen] = useState<Payment | null>(null)
  const clients = useClientMap()
  const services = useServiceMap()

  const payments = useLiveQuery(() => db.payments.where('date').equals(date).reverse().sortBy('createdAt'), [date], [] as Payment[])
  const toCash = useLiveQuery(
    () =>
      db.appointments
        .where('date')
        .equals(date)
        .filter((a) => !a.paymentId && (a.status === 'arrived' || a.status === 'done'))
        .sortBy('start'),
    [date],
    [] as Appointment[],
  )

  const total = payments.reduce((s, p) => s + p.amount, 0)
  const byMethod = METHODS.map((m) => [m, payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0)] as const)

  const removePayment = async (p: Payment) => {
    if (!confirmDelete(t)) return
    await db.transaction('rw', db.payments, db.appointments, async () => {
      await db.payments.delete(p.id)
      if (p.appointmentId) await db.appointments.update(p.appointmentId, { paymentId: undefined })
    })
    setOpen(null)
  }

  return (
    <Page title={t('cash')}>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setParams({ d: addDays(date, -1) }, { replace: true })} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude">
          <Icon name="back" flip />
        </button>
        <button onClick={() => setParams({}, { replace: true })} className="font-semibold capitalize">
          {date === today() ? t('today') : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        </button>
        <button onClick={() => setParams({ d: addDays(date, 1) }, { replace: true })} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude">
          <Icon name="chevron" flip />
        </button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-rose to-rose-dark p-5 text-white shadow-lg shadow-rose/30">
        <div className="text-sm text-white/80">{t('todayRevenue')}</div>
        <div className="mt-1 text-4xl font-bold">{money(total)}</div>
        <div className="mt-1 text-sm text-white/80">
          {payments.length} {t('transactions')}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {byMethod.map(([m, v]) => (
            <div key={m} className="rounded-xl bg-white/15 px-2 py-2 text-center">
              <div className="text-[11px] text-white/80">{t(`m_${m}`)}</div>
              <div className="text-sm font-bold">{money(v)}</div>
            </div>
          ))}
        </div>
      </div>

      {toCash.length > 0 && (
        <>
          <SectionTitle>{t('checkout')}</SectionTitle>
          <div className="space-y-2">
            {toCash.map((a) => (
              <Card key={a.id} onClick={() => nav(`/checkout?appt=${a.id}`)} className="flex items-center gap-3 !p-3">
                <span className="w-12 font-bold">{a.start}</span>
                <span className="flex-1 truncate">
                  <span className="block font-semibold">{clients.get(a.clientId)?.name}</span>
                  <span className="block truncate text-xs text-muted">{a.serviceIds.map((s) => services.get(s)?.name).join(' · ')}</span>
                </span>
                <span className="rounded-full bg-rose px-3 py-1.5 text-sm font-semibold text-white">{t('checkout')}</span>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>{t('paid')}</SectionTitle>
      {payments.length === 0 ? (
        <Empty icon="wallet" text={t('noPayments')} />
      ) : (
        <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
          {payments.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)} className="flex w-full items-center gap-3 px-3 py-3 text-start active:bg-blush-soft">
              <span className="w-12 text-sm text-muted">{p.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{(p.clientId && clients.get(p.clientId)?.name) || t('quickSale')}</span>
                <span className="block truncate text-xs text-muted">
                  {t(`m_${p.method}`)} · {p.items.map((i) => i.name).join(', ')}
                </span>
              </span>
              <span className="font-bold">{money(p.amount)}</span>
            </button>
          ))}
        </div>
      )}

      <Fab label={t('quickSale')} onClick={() => nav('/checkout')} />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={`${open?.time ?? ''} · ${money(open?.amount ?? 0)}`}>
        {open && (
          <>
            <div className="mb-4 divide-y divide-nude/60 rounded-2xl bg-white ring-1 ring-nude">
              {open.items.map((i, k) => (
                <div key={k} className="flex justify-between px-3 py-2.5">
                  <span>{i.name}</span>
                  <span>{money(i.price)}</span>
                </div>
              ))}
              {open.discount > 0 && (
                <div className="flex justify-between px-3 py-2.5 text-rose">
                  <span>{t('discount')}</span>
                  <span>− {money(open.discount)}</span>
                </div>
              )}
              <div className="flex justify-between px-3 py-2.5 font-bold">
                <span>
                  {t('total')} · {t(`m_${open.method}`)}
                </span>
                <span>{money(open.amount)}</span>
              </div>
            </div>
            <Button variant="danger" className="w-full" onClick={() => removePayment(open)}>
              <Icon name="trash" size={18} /> {t('delete')}
            </Button>
          </>
        )}
      </Sheet>
    </Page>
  )
}
