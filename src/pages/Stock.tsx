import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Product } from '../db'
import { groupBy } from '../hooks'
import { useI18n } from '../i18n'
import { cls, money } from '../utils'
import { Button, Card, confirmDelete, Empty, Fab, Field, Icon, Input, Page, Sheet } from '../components/ui'
import { normalize } from '../components/Pickers'

type Draft = Omit<Product, 'id'> & { id?: string }

export default function Stock() {
  const { t } = useI18n()
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [], [] as Product[])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string | null>(null) // null = all, '!low' = low stock, else category
  const cats = t('prodCats').split(',')

  const isLow = (p: Product) => p.qty <= p.minQty
  const low = products.filter(isLow)
  const value = products.reduce((s, p) => s + p.qty * (p.cost ?? 0), 0)
  const nq = normalize(q)
  const shown = products.filter(
    (p) => (!nq || normalize(p.name).includes(nq)) && (!filter || (filter === '!low' ? isLow(p) : p.category === filter)),
  )
  const groups = groupBy(shown, (p) => p.category || '—')
  const usedCats = [...new Set(products.map((p) => p.category))]

  const adjust = (p: Product, d: number) => db.products.update(p.id, { qty: Math.max(0, p.qty + d) })

  const save = async () => {
    if (!draft || !draft.name.trim()) return
    const data = { ...draft, name: draft.name.trim(), unit: draft.unit.trim() }
    if (draft.id) await db.products.put(data as Product)
    else await db.products.add({ ...data, id: uid() })
    setDraft(null)
  }

  const chip = (key: string | null, label: string, danger = false) => (
    <button
      key={key ?? 'all'}
      onClick={() => setFilter(key)}
      className={cls(
        'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1',
        filter === key ? (danger ? 'bg-red-600 text-onaccent ring-red-600' : 'bg-ink text-cream ring-ink') : danger ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-white ring-nude',
      )}
    >
      {label}
    </button>
  )

  const row = (p: Product) => {
    const l = isLow(p)
    return (
      <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => setDraft(p)} className="min-w-0 flex-1 text-start">
          <span className="block truncate font-medium">{p.name}</span>
          <span className={cls('block text-xs', l ? 'font-semibold text-red-600' : 'text-muted')}>
            {p.qty === 0 ? t('outOfStock') : l ? `${t('lowStock')} · min ${p.minQty}` : `min ${p.minQty}`}
            {p.cost ? ` · ${money(p.cost)}` : ''}
          </span>
        </button>
        <button onClick={() => adjust(p, -1)} className="grid h-10 w-10 place-items-center rounded-full bg-blush-soft text-rose-ink active:bg-blush" aria-label={t('use')}>
          <Icon name="minus" size={18} />
        </button>
        <span className={cls('w-12 text-center font-bold tabular-nums', l && 'text-red-600')}>
          {p.qty}
          {p.unit && <span className="block truncate text-[10px] font-normal text-muted">{p.unit}</span>}
        </span>
        <button onClick={() => adjust(p, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-blush-soft text-rose-ink active:bg-blush" aria-label={t('restock')}>
          <Icon name="plus" size={18} />
        </button>
      </div>
    )
  }

  return (
    <Page title={t('stock')} back>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Card className="!p-2.5">
          <div className="text-lg font-bold">{products.length}</div>
          <div className="text-[11px] text-muted">{t('products')}</div>
        </Card>
        <Card className={cls('!p-2.5', low.length > 0 && '!bg-red-50')} onClick={low.length ? () => setFilter('!low') : undefined}>
          <div className={cls('text-lg font-bold', low.length > 0 && 'text-red-700')}>{low.length}</div>
          <div className="text-[11px] text-muted">{t('lowStock')}</div>
        </Card>
        <Card className="!p-2.5">
          <div className="text-sm font-bold leading-7">{money(value)}</div>
          <div className="text-[11px] text-muted">{t('stockValue')}</div>
        </Card>
      </div>

      {products.length > 0 && (
        <>
          <div className="relative mb-3">
            <Icon name="search" size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} className="ps-10" />
          </div>
          <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
            {chip(null, t('all'))}
            {low.length > 0 && chip('!low', `${t('lowStock')} (${low.length})`, true)}
            {usedCats.map((c) => chip(c, c))}
          </div>
        </>
      )}

      {shown.length === 0 ? (
        <Empty icon="box" text={t('noData')} />
      ) : (
        [...groups].map(([cat, list]) => (
          <div key={cat} className="mb-5">
            <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</div>
            <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">{list.map(row)}</div>
          </div>
        ))
      )}

      <Fab label={t('newProduct')} onClick={() => setDraft({ name: '', category: cats[0], qty: 0, minQty: 2, unit: '' })} />

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('edit') : t('newProduct')}>
        {draft && (
          <>
            <Field label={t('name')}>
              <Input value={draft.name} autoFocus={!draft.id} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex: Majirel 7.1" />
            </Field>
            <Field label={t('category')}>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={cls('rounded-full px-3 py-1.5 text-sm ring-1', draft.category === c ? 'bg-rose text-onaccent ring-rose' : 'bg-white ring-nude')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <div className="mb-1.5 text-sm font-medium text-muted">{t('qty')}</div>
            <div className="mb-4 flex items-center gap-2">
              {[-5, -1].map((d) => (
                <button key={d} type="button" onClick={() => setDraft({ ...draft, qty: Math.max(0, draft.qty + d) })} className="h-12 w-12 rounded-xl bg-blush-soft font-bold text-rose-ink">
                  {d}
                </button>
              ))}
              <Input type="number" inputMode="numeric" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Math.max(0, Number(e.target.value)) })} className="flex-1 text-center text-lg font-bold" />
              {[1, 5].map((d) => (
                <button key={d} type="button" onClick={() => setDraft({ ...draft, qty: draft.qty + d })} className="h-12 w-12 rounded-xl bg-blush-soft font-bold text-rose-ink">
                  +{d}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('minQty')}>
                <Input type="number" inputMode="numeric" value={draft.minQty} onChange={(e) => setDraft({ ...draft, minQty: Number(e.target.value) })} />
              </Field>
              <Field label={t('unit')}>
                <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="tube" />
              </Field>
              <Field label={`${t('cost')} (DA)`}>
                <Input type="number" inputMode="numeric" value={draft.cost ?? ''} onChange={(e) => setDraft({ ...draft, cost: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
            </div>
            <Button className="w-full" onClick={save} disabled={!draft.name.trim()}>
              {t('save')}
            </Button>
            {draft.id && (
              <Button
                variant="danger"
                className="mt-2 w-full"
                onClick={async () => {
                  if (!confirmDelete(t)) return
                  await db.products.delete(draft.id!)
                  setDraft(null)
                }}
              >
                {t('delete')}
              </Button>
            )}
          </>
        )}
      </Sheet>
    </Page>
  )
}
