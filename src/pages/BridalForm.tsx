import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, uid, type PaymentItem } from '../db'
import { useServices } from '../hooks'
import { useI18n } from '../i18n'
import { cls, money } from '../utils'
import { Button, Field, Icon, Input, Page, Textarea } from '../components/ui'
import { ClientPicker } from '../components/Pickers'

export default function BridalForm() {
  const { t } = useI18n()
  const nav = useNavigate()
  const { id } = useParams()
  const services = useServices().filter((s) => s.active)

  const [clientId, setClientId] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [trialDate, setTrialDate] = useState('')
  const [items, setItems] = useState<PaymentItem[]>([])
  const [total, setTotal] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!id) return
    db.bridals.get(id).then((b) => {
      if (!b) return
      setClientId(b.clientId)
      setEventDate(b.eventDate)
      setTrialDate(b.trialDate ?? '')
      setItems(b.items)
      setTotal(b.total)
      setNote(b.note ?? '')
    })
  }, [id])

  const sum = items.reduce((s, i) => s + i.price, 0)
  const toggle = (name: string, price: number) =>
    setItems(items.some((i) => i.name === name) ? items.filter((i) => i.name !== name) : [...items, { name, price }])

  const valid = clientId && eventDate && items.length

  const save = async () => {
    setTried(true)
    if (!valid) return
    const data = { clientId, eventDate, trialDate: trialDate || undefined, items, total: total === '' ? sum : total, note: note.trim() || undefined }
    if (id) {
      await db.bridals.update(id, data)
      nav(-1)
    } else {
      const nid = uid()
      await db.bridals.add({ id: nid, ...data, createdAt: Date.now() })
      nav(`/bridal/${nid}`, { replace: true })
    }
  }

  return (
    <Page title={id ? t('edit') : t('newBridal')} back noNav>
      <Field label={t('client')} hint={tried && !clientId ? t('required') : undefined}>
        <ClientPicker value={clientId} onChange={setClientId} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('eventDate')} hint={tried && !eventDate ? t('required') : undefined}>
          <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </Field>
        <Field label={t('trialDate')}>
          <Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} />
        </Field>
      </div>

      <div className="mb-1.5 text-sm font-medium text-muted">{t('services')}</div>
      <div className="mb-4 flex flex-wrap gap-2">
        {services.map((s) => {
          const on = items.some((i) => i.name === s.name)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.name, s.price)}
              className={cls('rounded-full px-3 py-1.5 text-sm ring-1', on ? 'bg-rose text-onaccent ring-rose' : 'bg-white ring-nude')}
            >
              {on && <Icon name="check" size={14} className="-mt-0.5 me-1 inline" />}
              {s.name}
            </button>
          )
        })}
      </div>
      {tried && !items.length && <p className="-mt-2 mb-3 text-xs text-rose">{t('required')}</p>}

      <Field label={`${t('total')} (DA)`}>
        <Input type="number" inputMode="numeric" value={total} placeholder={String(sum)} onChange={(e) => setTotal(e.target.value === '' ? '' : Number(e.target.value))} />
      </Field>
      <Field label={t('note')}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <Button className="w-full" onClick={save}>
        {t('save')} · {money(total === '' ? sum : total)}
      </Button>
    </Page>
  )
}
