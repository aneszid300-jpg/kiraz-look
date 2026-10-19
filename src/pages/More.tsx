import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useI18n, type TKey } from '../i18n'
import { Icon, Page, type IconName } from '../components/ui'
import { today } from '../utils'

export default function More() {
  const { t } = useI18n()
  const nav = useNavigate()
  const low = useLiveQuery(() => db.products.filter((p) => p.qty <= p.minQty).count(), [], 0)
  const brides = useLiveQuery(() => db.bridals.where('eventDate').aboveOrEqual(today()).count(), [], 0)

  const items: { to: string; icon: IconName; label: TKey; badge?: number; danger?: boolean }[] = [
    { to: '/bridal', icon: 'heart', label: 'bridal', badge: brides },
    { to: '/services', icon: 'scissors', label: 'services' },
    { to: '/stock', icon: 'box', label: 'stock', badge: low, danger: true },
    { to: '/expenses', icon: 'receipt', label: 'expenses' },
    { to: '/settings', icon: 'settings', label: 'settings' },
  ]

  return (
    <Page title={t('more')}>
      <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
        {items.map((it) => (
          <button key={it.to} onClick={() => nav(it.to)} className="flex w-full items-center gap-4 px-4 py-4 text-start active:bg-blush-soft">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-blush-soft text-rose">
              <Icon name={it.icon} />
            </span>
            <span className="flex-1 font-semibold">{t(it.label)}</span>
            {!!it.badge && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${it.danger ? 'bg-red-100 text-red-700' : 'bg-blush text-rose-dark'}`}>
                {it.danger && t('lowStock') + ' · '}
                {it.badge}
              </span>
            )}
            <Icon name="chevron" size={18} className="text-muted" flip />
          </button>
        ))}
      </div>
      <p className="mt-8 text-center font-display text-lg text-muted">Kiraz Look</p>
    </Page>
  )
}
