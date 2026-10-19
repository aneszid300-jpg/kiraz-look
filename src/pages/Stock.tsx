import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Product } from '../db'
import { groupBy } from '../hooks'
import { useI18n } from '../i18n'
import { cls } from '../utils'
import { Button, confirmDelete, Empty, Fab, Field, Icon, Input, Page, Sheet } from '../components/ui'

type Draft = Omit<Product, 'id'> & { id?: string }

export default function Stock() {
  const { t } = useI18n()
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [], [] as Product[])
  const [draft, setDraft] = useState<Draft | null>(null)
  const cats = t('prodCats').split(',')
  const low = products.filter((p) => p.qty <= p.minQty)
  const groups = groupBy(products, (p) => p.category || '—')

  const adjust = (p: Product, d: number) => db.products.update(p.id, { qty: Math.max(0, p.qty + d) })

  const save = async () => {
    if (!draft || !draft.name.trim()) return
    const data = { ...draft, name: draft.name.trim() }
    if (draft.id) await db.products.put(data as Product)
    else await db.products.add({ ...data, id: uid() })
    setDraft(null)
  }

  const row = (p: Product) => {
    const isLow = p.qty <= p.minQty
    return (
      <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => setDraft(p)} className="min-w-0 flex-1 text-start">
          <span className="block truncate font-medium">{p.name}</span>
          <span className={cls('block text-xs', isLow ? 'font-semibold text-red-600' : 'text-muted')}>
            {p.qty === 0 ? t('outOfStock') : isLow ? t('lowStock') : `min ${p.minQty}`}
          </span>
        </button>
        <button onClick={() => adjust(p, -1)} className="grid h-10 w-10 place-items-center rounded-full bg-blush-soft text-rose-dark active:bg-blush" aria-label="-1">
          <Icon name="minus" size={18} />
        </button>
        <span className={cls('w-14 text-center font-bold', isLow && 'text-red-600')}>
          {p.qty}
          <span className="block text-[10px] font-normal text-muted">{p.unit}</span>
        </span>
        <button onClick={() => adjust(p, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-blush-soft text-rose-dark active:bg-blush" aria-label="+1">
          <Icon name="plus" size={18} />
        </button>
      </div>
    )
  }

  return (
    <Page title={t('stock')} back>
      {low.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3">
          <div className="mb-1 flex items-center gap-2 font-semibold text-red-700">
            <Icon name="alert" size={18} /> {t('lowStock')} ({low.length})
          </div>
          <div className="text-sm text-red-800">{low.map((p) => p.name).join(' · ')}</div>
        </div>
      )}

      {products.length === 0 ? (
        <Empty icon="box" text={t('noData')} />
      ) : (
        [...groups].map(([cat, list]) => (
          <div key={cat} className="mb-5">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</div>
            <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">{list.map(row)}</div>
          </div>
        ))
      )}

      <Fab label={t('newProduct')} onClick={() => setDraft({ name: '', category: cats[0], qty: 0, minQty: 2, unit: '' })} />

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('edit') : t('newProduct')}>
        {draft && (
          <>
            <Field label={t('name')}>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex: L'Oréal Majirel 7.1" />
            </Field>
            <Field label={t('category')}>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={cls('rounded-full px-3 py-1.5 text-sm ring-1', draft.category === c ? 'bg-rose text-white ring-rose' : 'bg-white ring-nude')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('qty')}>
                <Input type="number" inputMode="numeric" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} />
              </Field>
              <Field label={t('minQty')}>
                <Input type="number" inputMode="numeric" value={draft.minQty} onChange={(e) => setDraft({ ...draft, minQty: Number(e.target.value) })} />
              </Field>
              <Field label={t('unit')}>
                <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="tube" />
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
