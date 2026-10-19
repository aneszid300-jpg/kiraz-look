import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Bridal, type Payment } from '../db'
import { useClientMap } from '../hooks'
import { useI18n } from '../i18n'
import { cls, money, parseISO, today } from '../utils'
import { Avatar, Card, Empty, Fab, Page, Segmented } from '../components/ui'

export const daysUntil = (d: string) => Math.round((parseISO(d).getTime() - parseISO(today()).getTime()) / 864e5)

export function Countdown({ date, className }: { date: string; className?: string }) {
  const { t } = useI18n()
  const n = daysUntil(date)
  if (n < 0) return null
  return (
    <span className={cls('rounded-full px-2 py-0.5 text-[11px] font-bold', n <= 7 ? 'bg-rose text-onaccent' : 'bg-gold/25 text-ink', className)}>
      {n === 0 ? t('dDay') : t('daysLeft', { n })}
    </span>
  )
}

type Tab = 'upcoming' | 'unpaid' | 'past'

export default function Bridals() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const clients = useClientMap()
  const [tab, setTab] = useState<Tab>('upcoming')
  const packs = useLiveQuery(() => db.bridals.orderBy('eventDate').toArray(), [], [] as Bridal[])
  const pays = useLiveQuery(() => db.payments.where('bridalId').above('').toArray(), [], [] as Payment[])
  const paid = (id: string) => pays.filter((p) => p.bridalId === id).reduce((s, p) => s + p.amount, 0)
  const rest = (b: Bridal) => Math.max(0, b.total - paid(b.id))

  const upcoming = packs.filter((b) => b.eventDate >= today())
  const unpaid = packs.filter((b) => rest(b) > 0)
  const past = packs.filter((b) => b.eventDate < today()).reverse()
  const list = { upcoming, unpaid, past }[tab]
  const toCollect = unpaid.reduce((s, b) => s + rest(b), 0)

  return (
    <Page title={t('bridal')} back>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="!p-3.5">
          <div className="text-xs text-muted">{t('upcoming')}</div>
          <div className="text-2xl font-bold">{upcoming.length}</div>
          {upcoming[0] && (
            <div className="mt-1 truncate text-xs text-muted">
              {clients.get(upcoming[0].clientId)?.name} · <Countdown date={upcoming[0].eventDate} className="!px-1.5" />
            </div>
          )}
        </Card>
        <Card className="!p-3.5">
          <div className="text-xs text-muted">{t('toCollect')}</div>
          <div className="text-xl font-bold text-rose-ink">{money(toCollect)}</div>
          <div className="mt-1 text-xs text-muted">
            {unpaid.length} {t('unpaidOnly').toLowerCase()}
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: `${t('upcoming')} (${upcoming.length})` },
            { value: 'unpaid', label: `${t('unpaidOnly')} (${unpaid.length})` },
            { value: 'past', label: t('past') },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty icon="heart" text={t('noData')} />
      ) : (
        <div className={cls('space-y-2', tab === 'past' && 'opacity-80')}>
          {list.map((b) => {
            const p = paid(b.id)
            const r = rest(b)
            const name = clients.get(b.clientId)?.name ?? '?'
            return (
              <Card key={b.id} onClick={() => nav(`/bridal/${b.id}`)} className="!p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{name}</span>
                      <Countdown date={b.eventDate} />
                    </div>
                    <div className="text-sm capitalize text-muted">{fmtDate(b.eventDate, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <div className="text-end">
                    <div className={cls('text-sm font-bold', r > 0 ? 'text-rose-ink' : 'text-emerald-700')}>{r > 0 ? money(r) : t('settled')}</div>
                    {r > 0 && <div className="text-[11px] text-muted">{t('remaining')}</div>}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-blush-soft">
                    <div className="h-1.5 rounded-full bg-gold" style={{ width: `${b.total ? Math.min(100, (p / b.total) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[11px] text-muted tabular-nums">
                    {money(p)} / {money(b.total)}
                  </span>
                </div>
                {b.trialDate && b.trialDate >= today() && (
                  <div className="mt-1.5 text-xs text-muted">
                    {t('trialDate')} : <b className="capitalize">{fmtDate(b.trialDate, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      <Fab label={t('newBridal')} onClick={() => nav('/bridal/new')} />
    </Page>
  )
}
