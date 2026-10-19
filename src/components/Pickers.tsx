import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Client } from '../db'
import { groupBy, useServices } from '../hooks'
import { useI18n } from '../i18n'
import { cls, fmtDuration, money } from '../utils'
import { Avatar, Button, Field, Icon, Input, Sheet } from './ui'

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')

export function matchClient(c: Client, q: string) {
  const n = normalize(q)
  return !n || normalize(c.name).includes(n) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')
}

export function ClientPicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], [] as Client[])
  const selected = clients.find((c) => c.id === value)
  const list = clients.filter((c) => matchClient(c, q)).slice(0, 50)

  const close = () => {
    setOpen(false)
    setQ('')
    setAdding(false)
  }

  const create = async () => {
    if (!name.trim()) return
    const id = uid()
    await db.clients.add({ id, name: name.trim(), phone: phone.trim(), createdAt: Date.now() })
    onChange(id)
    setName('')
    setPhone('')
    close()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-nude bg-white px-3.5 py-2.5 text-start"
      >
        {selected ? (
          <>
            <Avatar name={selected.name} size={36} />
            <span className="flex-1">
              <span className="block font-semibold">{selected.name}</span>
              <span className="block text-sm text-muted" dir="ltr">
                {selected.phone}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 py-1.5 text-muted">{t('chooseClient')}</span>
        )}
        <Icon name="chevron" size={18} className="text-muted" flip />
      </button>

      <Sheet open={open} onClose={close} title={adding ? t('newClient') : t('chooseClient')}>
        {adding ? (
          <>
            <Field label={t('name')}>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('phone')}>
              <Input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 / 06 / 07 …" />
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setAdding(false)}>
                {t('cancel')}
              </Button>
              <Button className="flex-1" onClick={create} disabled={!name.trim()}>
                {t('save')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="sticky top-14 z-10 -mx-5 bg-cream px-5 pb-3">
              <Input autoFocus placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button
              variant="soft"
              className="mb-3 w-full"
              onClick={() => {
                setAdding(true)
                if (/^[\d\s+]+$/.test(q)) setPhone(q)
                else setName(q)
              }}
            >
              <Icon name="plus" size={20} /> {t('newClient')}
            </Button>
            <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
              {list.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onChange(c.id)
                    close()
                  }}
                  className={cls('flex w-full items-center gap-3 px-3 py-2.5 text-start active:bg-blush-soft', c.id === value && 'bg-blush-soft')}
                >
                  <Avatar name={c.name} size={36} />
                  <span className="flex-1">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-sm text-muted" dir="ltr">
                      {c.phone}
                    </span>
                  </span>
                </button>
              ))}
              {list.length === 0 && <p className="p-4 text-center text-muted">{t('noClients')}</p>}
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}

export function ServiceChips({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const services = useServices().filter((s) => s.active || value.includes(s.id))
  const groups = groupBy(services, (s) => s.category || '—')
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div className="space-y-3">
      {[...groups].map(([cat, list]) => (
        <div key={cat}>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</div>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => {
              const on = value.includes(s.id)
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={cls('rounded-xl px-3 py-2 text-start text-sm ring-1 transition', on ? 'bg-rose text-white ring-rose' : 'bg-white ring-nude')}
                >
                  <span className="block font-semibold">{s.name}</span>
                  <span className={cls('block text-xs', on ? 'text-white/85' : 'text-muted')}>
                    {money(s.price)} · {fmtDuration(s.duration)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
