import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Bridal, type Payment } from '../db'
import { useClientMap } from '../hooks'
import { useI18n } from '../i18n'
import { cls, money, today } from '../utils'
import { Avatar, Card, Empty, Fab, Page, SectionTitle } from '../components/ui'

export default function Bridals() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const clients = useClientMap()
  const packs = useLiveQuery(() => db.bridals.orderBy('eventDate').toArray(), [], [] as Bridal[])
  const pays = useLiveQuery(() => db.payments.where('bridalId').above('').toArray(), [], [] as Payment[])
  const paid = (id: string) => pays.filter((p) => p.bridalId === id).reduce((s, p) => s + p.amount, 0)

  const upcoming = packs.filter((b) => b.eventDate >= today())
  const past = packs.filter((b) => b.eventDate < today()).reverse()

  const card = (b: Bridal) => {
    const p = paid(b.id)
    const rest = b.total - p
    return (
      <Card key={b.id} onClick={() => nav(`/bridal/${b.id}`)} className="flex items-center gap-3 !p-3">
        <Avatar name={clients.get(b.clientId)?.name ?? '?'} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{clients.get(b.clientId)?.name}</div>
          <div className="text-sm capitalize text-muted">{fmtDate(b.eventDate, { weekday: 'short', day: 'numeric', month: 'long' })}</div>
          <div className="mt-1.5 h-1.5 rounded-full bg-blush-soft">
            <div className="h-1.5 rounded-full bg-gold" style={{ width: `${b.total ? Math.min(100, (p / b.total) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="text-end">
          <div className={cls('text-sm font-bold', rest > 0 ? 'text-rose-dark' : 'text-emerald-700')}>{rest > 0 ? money(rest) : t('settled')}</div>
          {rest > 0 && <div className="text-[11px] text-muted">{t('remaining')}</div>}
        </div>
      </Card>
    )
  }

  return (
    <Page title={t('bridal')} back>
      {packs.length === 0 && <Empty icon="heart" text={t('noData')} />}
      {upcoming.length > 0 && <div className="space-y-2">{upcoming.map(card)}</div>}
      {past.length > 0 && (
        <>
          <SectionTitle>{t('history')}</SectionTitle>
          <div className="space-y-2 opacity-75">{past.map(card)}</div>
        </>
      )}
      <Fab label={t('newBridal')} onClick={() => nav('/bridal/new')} />
    </Page>
  )
}
