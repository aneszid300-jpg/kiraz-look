import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Client } from '../db'
import { useI18n } from '../i18n'
import { Avatar, Empty, Fab, Icon, Input, Page } from '../components/ui'
import { matchClient } from '../components/Pickers'

export default function Clients() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), [], [] as Client[])
  const lastVisit = useLiveQuery(async () => {
    const m = new Map<string, string>()
    await db.appointments.each((a) => {
      if (a.status === 'done' && (m.get(a.clientId) ?? '') < a.date) m.set(a.clientId, a.date)
    })
    return m
  }, [], new Map<string, string>())

  const list = clients.filter((c) => matchClient(c, q))

  return (
    <Page title={`${t('clients')} (${clients.length})`}>
      <div className="relative mb-4">
        <Icon name="search" size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} className="ps-10" />
      </div>

      {list.length === 0 ? (
        <Empty icon="users" text={t('noClients')} />
      ) : (
        <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
          {list.map((c) => (
            <button key={c.id} onClick={() => nav(`/clients/${c.id}`)} className="flex w-full items-center gap-3 px-3 py-3 text-start active:bg-blush-soft">
              <Avatar name={c.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block text-sm text-muted">
                  <span dir="ltr">{c.phone}</span>
                  {lastVisit.get(c.id) && <> · {fmtDate(lastVisit.get(c.id)!, { day: 'numeric', month: 'short', year: '2-digit' })}</>}
                </span>
              </span>
              {c.allergies && <Icon name="alert" size={16} className="text-amber-500" />}
              <Icon name="chevron" size={18} className="text-muted" flip />
            </button>
          ))}
        </div>
      )}
      <Fab label={t('newClient')} onClick={() => nav('/clients/new')} />
    </Page>
  )
}
