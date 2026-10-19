import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Expense } from '../db'
import { useI18n } from '../i18n'
import { cls, money, monthKey, parseISO, toISO, today } from '../utils'
import { Button, confirmDelete, Empty, Fab, Field, Icon, Input, Page, Sheet } from '../components/ui'

type Draft = Omit<Expense, 'id' | 'createdAt'> & { id?: string; createdAt?: number }

export default function Expenses() {
  const { t, fmtDate } = useI18n()
  const [month, setMonth] = useState(monthKey(today()))
  const [draft, setDraft] = useState<Draft | null>(null)
  const cats = t('expCats').split(',')

  const list = useLiveQuery(
    () => db.expenses.where('date').between(month + '-01', month + '-31', true, true).reverse().sortBy('date'),
    [month],
    [] as Expense[],
  )
  const total = list.reduce((s, e) => s + e.amount, 0)
  const byCat = [...list.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1])

  const shift = (n: number) => {
    const d = parseISO(month + '-01')
    d.setMonth(d.getMonth() + n)
    setMonth(toISO(d).slice(0, 7))
  }

  const save = async () => {
    if (!draft || !draft.amount) return
    const data = { ...draft, note: draft.note?.trim() || undefined, createdAt: draft.createdAt ?? Date.now() }
    if (draft.id) await db.expenses.put(data as Expense)
    else await db.expenses.add({ ...data, id: uid() })
    setDraft(null)
  }

  return (
    <Page title={t('expenses')} back>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude">
          <Icon name="back" flip />
        </button>
        <span className="font-semibold capitalize">{fmtDate(month + '-01', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => shift(1)} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude">
          <Icon name="chevron" flip />
        </button>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-nude">
        <div className="text-sm text-muted">{t('total')}</div>
        <div className="text-3xl font-bold">{money(total)}</div>
        {byCat.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {byCat.map(([c, v]) => (
              <span key={c} className="rounded-full bg-blush-soft px-2.5 py-1 text-xs">
                {c} · <b>{money(v)}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <Empty icon="receipt" text={t('noData')} />
      ) : (
        <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
          {list.map((e) => (
            <button key={e.id} onClick={() => setDraft(e)} className="flex w-full items-center gap-3 px-4 py-3 text-start active:bg-blush-soft">
              <span className="w-12 text-sm text-muted">{fmtDate(e.date, { day: 'numeric', month: 'short' })}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{e.category}</span>
                {e.note && <span className="block truncate text-xs text-muted">{e.note}</span>}
              </span>
              <span className="font-semibold">{money(e.amount)}</span>
            </button>
          ))}
        </div>
      )}

      <Fab label={t('newExpense')} onClick={() => setDraft({ date: today(), category: cats[0], amount: 0 })} />

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('edit') : t('newExpense')}>
        {draft && (
          <>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('amount')} (DA)`}>
                <Input type="number" inputMode="numeric" autoFocus value={draft.amount || ''} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
              </Field>
              <Field label={t('date')}>
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
            </div>
            <Field label={t('note')}>
              <Input value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
            <Button className="w-full" onClick={save} disabled={!draft.amount}>
              {t('save')}
            </Button>
            {draft.id && (
              <Button
                variant="danger"
                className="mt-2 w-full"
                onClick={async () => {
                  if (!confirmDelete(t)) return
                  await db.expenses.delete(draft.id!)
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
