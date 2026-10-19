import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, uid, type PayMethod, type PaymentItem } from '../db'
import { groupBy, useServices } from '../hooks'
import { useI18n } from '../i18n'
import { cls, money, nowTime, today } from '../utils'
import { Button, Field, Icon, Input, Page, Segmented, Sheet } from '../components/ui'
import { ClientPicker } from '../components/Pickers'

export const METHODS: PayMethod[] = ['cash', 'ccp', 'baridimob']

export function MethodPicker({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-3 gap-2">
      {METHODS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cls('rounded-xl py-3 text-sm font-semibold ring-1', value === m ? 'bg-rose text-white ring-rose' : 'bg-white ring-nude')}
        >
          {t(`m_${m}`)}
        </button>
      ))}
    </div>
  )
}

export default function Checkout() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const apptId = params.get('appt')
  const allServices = useServices()

  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState<PaymentItem[]>([])
  const [discMode, setDiscMode] = useState<'da' | 'pct'>('da')
  const [disc, setDisc] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [adding, setAdding] = useState(false)
  const [freeName, setFreeName] = useState('')
  const [freePrice, setFreePrice] = useState('')

  useEffect(() => {
    if (!apptId) return
    db.appointments.get(apptId).then(async (a) => {
      if (!a) return
      setClientId(a.clientId)
      const svcs = await db.services.bulkGet(a.serviceIds)
      setItems(svcs.filter(Boolean).map((s) => ({ name: s!.name, price: s!.price })))
    })
  }, [apptId])

  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0), 0)
  const d = Number(disc) || 0
  const discount = Math.min(subtotal, discMode === 'pct' ? Math.round((subtotal * d) / 100) : d)
  const amount = subtotal - discount

  const save = async () => {
    if (!items.length) return
    const id = uid()
    await db.transaction('rw', db.payments, db.appointments, async () => {
      await db.payments.add({
        id,
        date: today(),
        time: nowTime(),
        clientId: clientId || undefined,
        appointmentId: apptId ?? undefined,
        items,
        subtotal,
        discount,
        amount,
        method,
        createdAt: Date.now(),
      })
      if (apptId) await db.appointments.update(apptId, { status: 'done', paymentId: id })
    })
    nav(-1)
  }

  const groups = groupBy(
    allServices.filter((s) => s.active),
    (s) => s.category || '—',
  )

  return (
    <Page title={apptId ? t('checkout') : t('quickSale')} back noNav>
      <Field label={t('client')}>
        <ClientPicker value={clientId} onChange={setClientId} />
      </Field>

      <div className="mb-1.5 text-sm font-medium text-muted">{t('services')}</div>
      <div className="mb-3 divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 truncate">{it.name}</span>
            <input
              type="number"
              inputMode="numeric"
              value={it.price}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))}
              className="w-24 rounded-lg border border-nude px-2 py-1.5 text-end"
            />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center text-muted" aria-label={t('delete')}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
        <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 py-3 font-semibold text-rose">
          <Icon name="plus" size={18} /> {t('addItem')}
        </button>
      </div>

      <div className="mb-1.5 text-sm font-medium text-muted">{t('discount')}</div>
      <div className="mb-4 flex gap-2">
        <Input type="number" inputMode="numeric" value={disc} onChange={(e) => setDisc(e.target.value)} placeholder="0" className="flex-1" />
        <div className="w-32">
          <Segmented
            value={discMode}
            onChange={setDiscMode}
            options={[
              { value: 'da', label: 'DA' },
              { value: 'pct', label: '%' },
            ]}
          />
        </div>
      </div>

      <div className="mb-1.5 text-sm font-medium text-muted">{t('method')}</div>
      <MethodPicker value={method} onChange={setMethod} />

      <div className="mt-5 space-y-1 rounded-2xl bg-white p-4 ring-1 ring-nude">
        <div className="flex justify-between text-muted">
          <span>{t('subtotal')}</span>
          <span>{money(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-rose">
            <span>{t('discount')}</span>
            <span>− {money(discount)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 text-xl font-bold">
          <span>{t('total')}</span>
          <span>{money(amount)}</span>
        </div>
      </div>

      <Button className="mt-4 w-full text-lg" onClick={save} disabled={!items.length}>
        <Icon name="check" size={20} /> {t('checkout')} {money(amount)}
      </Button>

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('addItem')}>
        <div className="mb-4 rounded-2xl bg-white p-3 ring-1 ring-nude">
          <div className="mb-2 text-sm font-semibold text-muted">{t('freeItem')}</div>
          <div className="flex gap-2">
            <Input placeholder={t('name')} value={freeName} onChange={(e) => setFreeName(e.target.value)} className="flex-1" />
            <Input type="number" inputMode="numeric" placeholder={t('price')} value={freePrice} onChange={(e) => setFreePrice(e.target.value)} className="w-28" />
          </div>
          <Button
            variant="soft"
            className="mt-2 w-full"
            disabled={!freeName.trim() || !freePrice}
            onClick={() => {
              setItems([...items, { name: freeName.trim(), price: Number(freePrice) }])
              setFreeName('')
              setFreePrice('')
              setAdding(false)
            }}
          >
            {t('add')}
          </Button>
        </div>
        {[...groups].map(([cat, list]) => (
          <div key={cat} className="mb-3">
            <div className="mb-1.5 text-xs font-semibold uppercase text-muted">{cat}</div>
            <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
              {list.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setItems([...items, { name: s.name, price: s.price }])
                    setAdding(false)
                  }}
                  className="flex w-full justify-between px-3 py-3 active:bg-blush-soft"
                >
                  <span>{s.name}</span>
                  <span className="font-semibold">{money(s.price)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Sheet>
    </Page>
  )
}
