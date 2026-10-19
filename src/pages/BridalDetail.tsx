import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type PayMethod, type Payment } from '../db'
import { useI18n } from '../i18n'
import { money, nowTime, today, waLink } from '../utils'
import { btnCls, Button, Card, confirmDelete, Field, Icon, Input, Page, SectionTitle, Sheet } from '../components/ui'
import { MethodPicker } from './Checkout'

export default function BridalDetail() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const { id = '' } = useParams()
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')

  const b = useLiveQuery(() => db.bridals.get(id), [id])
  const client = useLiveQuery(() => (b ? db.clients.get(b.clientId) : undefined), [b?.clientId])
  const pays = useLiveQuery(() => db.payments.where('bridalId').equals(id).sortBy('createdAt'), [id], [] as Payment[])

  if (!b) return null
  const paid = pays.reduce((s, p) => s + p.amount, 0)
  const rest = b.total - paid

  const addPayment = async () => {
    const a = Number(amount)
    if (!a) return
    await db.payments.add({
      id: uid(),
      date: today(),
      time: nowTime(),
      clientId: b.clientId,
      bridalId: b.id,
      items: [{ name: `${t('bridal')} · ${pays.length ? t('addPayment') : t('advance')}`, price: a }],
      subtotal: a,
      discount: 0,
      amount: a,
      method,
      createdAt: Date.now(),
    })
    setAmount('')
    setPaying(false)
  }

  const remove = async () => {
    if (!confirmDelete(t)) return
    await db.bridals.delete(id)
    nav(-1)
  }

  const fmtLong = (d: string) => fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Page
      title={client?.name ?? t('bridal')}
      back
      noNav
      right={
        <button onClick={() => nav(`/bridal/${id}/edit`)} className="grid h-10 w-10 place-items-center rounded-full active:bg-blush" aria-label={t('edit')}>
          <Icon name="edit" size={20} />
        </button>
      }
    >
      <div className="rounded-3xl bg-gradient-to-br from-gold/40 via-blush to-blush-soft p-5">
        <div className="flex items-center gap-2 text-sm text-ink/70">
          <Icon name="heart" size={16} /> {t('eventDate')}
        </div>
        <div className="mt-1 text-xl font-bold capitalize">{fmtLong(b.eventDate)}</div>
        {b.trialDate && (
          <div className="mt-2 text-sm capitalize">
            {t('trialDate')} : <b>{fmtLong(b.trialDate)}</b>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Card className="!p-3">
          <div className="text-xs text-muted">{t('total')}</div>
          <div className="font-bold">{money(b.total)}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-muted">{t('paidSoFar')}</div>
          <div className="font-bold text-emerald-700">{money(paid)}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-muted">{t('remaining')}</div>
          <div className="font-bold text-rose-dark">{money(Math.max(0, rest))}</div>
        </Card>
      </div>

      {rest > 0 ? (
        <Button className="mt-3 w-full" onClick={() => (setAmount(String(rest)), setPaying(true))}>
          <Icon name="wallet" size={20} /> {pays.length ? t('addPayment') : t('advance')}
        </Button>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 font-semibold text-emerald-800">
          <Icon name="check" size={18} /> {t('settled')}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        {b.trialDate && (
          <button onClick={() => nav(`/appt/new?client=${b.clientId}&date=${b.trialDate}`)} className={btnCls('ghost', 'text-sm')}>
            <Icon name="calendar" size={18} /> {t('trialDate')}
          </button>
        )}
        <button onClick={() => nav(`/appt/new?client=${b.clientId}&date=${b.eventDate}`)} className={btnCls('ghost', 'text-sm')}>
          <Icon name="calendar" size={18} /> {t('eventDate')}
        </button>
        {client?.phone && (
          <a href={waLink(client.phone)} target="_blank" rel="noreferrer" className={btnCls('ghost', 'text-sm text-emerald-700')}>
            <Icon name="chat" size={18} /> {t('whatsapp')}
          </a>
        )}
      </div>

      <SectionTitle>{t('services')}</SectionTitle>
      <Card className="divide-y divide-nude/60 !p-0">
        {b.items.map((i) => (
          <div key={i.name} className="flex justify-between px-4 py-2.5">
            <span>{i.name}</span>
            <span className="text-muted">{money(i.price)}</span>
          </div>
        ))}
      </Card>
      {b.note && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm ring-1 ring-nude">{b.note}</p>}

      <SectionTitle>{t('paid')}</SectionTitle>
      {pays.length === 0 ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <Card className="divide-y divide-nude/60 !p-0">
          {pays.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <span>
                {fmtDate(p.date, { day: 'numeric', month: 'short' })} · <span className="text-muted">{t(`m_${p.method}`)}</span>
              </span>
              <span className="flex items-center gap-2 font-semibold">
                {money(p.amount)}
                <button
                  onClick={async () => confirmDelete(t) && (await db.payments.delete(p.id))}
                  className="grid h-8 w-8 place-items-center text-muted"
                  aria-label={t('delete')}
                >
                  <Icon name="close" size={16} />
                </button>
              </span>
            </div>
          ))}
        </Card>
      )}

      <button onClick={remove} className="mt-8 w-full py-3 text-sm font-semibold text-red-600">
        {t('delete')}
      </button>

      <Sheet open={paying} onClose={() => setPaying(false)} title={pays.length ? t('addPayment') : t('advance')}>
        <Field label={`${t('amount')} (DA)`}>
          <Input type="number" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <div className="mb-5">
          <MethodPicker value={method} onChange={setMethod} />
        </div>
        <Button className="w-full" onClick={addPayment} disabled={!Number(amount)}>
          {t('save')}
        </Button>
      </Sheet>
    </Page>
  )
}
