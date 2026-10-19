import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Expense } from '../db'
import { groupBy } from '../hooks'
import { expCatIndex, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { cls, money, monthKey, parseISO, toISO, today } from '../utils'
import { Button, Card, confirmDelete, Empty, Fab, Field, Icon, Input, Page, Sheet } from '../components/ui'
import { CAT_COLORS } from '../components/Charts'
import { MethodPicker } from './Checkout'

type Draft = Omit<Expense, 'id' | 'createdAt'> & { id?: string; createdAt?: number }

const shiftMonth = (m: string, n: number) => {
  const d = parseISO(m + '-01')
  d.setMonth(d.getMonth() + n)
  return toISO(d).slice(0, 7)
}

export default function Expenses() {
  const { t, fmtDate } = useI18n()
  const [theme] = useTheme()
  const [month, setMonth] = useState(monthKey(today()))
  const [filter, setFilter] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const cats = t('expCats').split(',')
  const colors = CAT_COLORS[theme]

  const range = (m: string) => [m + '-01', m + '-31'] as const
  const list = useLiveQuery(() => db.expenses.where('date').between(...range(month), true, true).reverse().sortBy('date'), [month], [] as Expense[])
  const prevTotal = useLiveQuery(
    async () => (await db.expenses.where('date').between(...range(shiftMonth(month, -1)), true, true).toArray()).reduce((s, e) => s + e.amount, 0),
    [month],
    0,
  )

  const total = list.reduce((s, e) => s + e.amount, 0)
  const byCat = [...list.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const shown = filter ? list.filter((e) => e.category === filter) : list
  const days = groupBy(shown, (e) => e.date)
  const delta = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null

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
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude" aria-label="prev">
          <Icon name="back" flip />
        </button>
        <span className="font-semibold capitalize">{fmtDate(month + '-01', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude" aria-label="next">
          <Icon name="chevron" flip />
        </button>
      </div>

      <Card className="mb-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-sm text-muted">{t('total')}</div>
            <div className="text-3xl font-bold">{money(total)}</div>
          </div>
          {delta !== null && (
            <span className={cls('mb-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', delta > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} size={12} />
              {delta > 0 ? '+' : ''}
              {delta}% <span className="font-normal">{t('vsPrev')}</span>
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full" dir="ltr">
            {byCat.map(([c, v]) => (
              <span key={c} style={{ width: `${(v / total) * 100}%`, background: colors[expCatIndex(c)] }} />
            ))}
          </div>
        )}
      </Card>

      {byCat.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <button
            onClick={() => setFilter(null)}
            className={cls('shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1', !filter ? 'bg-ink text-cream ring-ink' : 'bg-white ring-nude')}
          >
            {t('all')}
          </button>
          {byCat.map(([c, v]) => (
            <button
              key={c}
              onClick={() => setFilter(filter === c ? null : c)}
              className={cls('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1', filter === c ? 'bg-ink text-cream ring-ink' : 'bg-white ring-nude')}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[expCatIndex(c)] }} />
              {c} · <b>{money(v)}</b>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <Empty icon="receipt" text={t('noData')} />
      ) : (
        [...days].map(([d, items]) => (
          <div key={d} className="mb-4">
            <div className="mb-1.5 flex justify-between px-1 text-xs font-semibold uppercase text-muted">
              <span className="capitalize">{fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
              <span>{money(items.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
              {items.map((e) => (
                <button key={e.id} onClick={() => setDraft(e)} className="flex w-full items-center gap-3 px-4 py-3 text-start active:bg-blush-soft">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colors[expCatIndex(e.category)] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{e.category}</span>
                    <span className="block truncate text-xs text-muted">
                      {t(`m_${e.method ?? 'cash'}`)}
                      {e.note && ` · ${e.note}`}
                    </span>
                  </span>
                  <span className="font-semibold">{money(e.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <Fab label={t('newExpense')} onClick={() => setDraft({ date: today(), category: filter ?? cats[0], amount: 0, method: 'cash' })} />

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
                    className={cls('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1', draft.category === c ? 'bg-rose text-onaccent ring-rose' : 'bg-white ring-nude')}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: colors[expCatIndex(c)] }} />
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('amount')} (DA)`}>
                <Input type="number" inputMode="numeric" autoFocus={!draft.id} value={draft.amount || ''} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
              </Field>
              <Field label={t('date')}>
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
            </div>
            <div className="mb-4">
              <div className="mb-1.5 text-sm font-medium text-muted">{t('method')}</div>
              <MethodPicker value={draft.method ?? 'cash'} onChange={(m) => setDraft({ ...draft, method: m })} />
            </div>
            <Field label={t('note')}>
              <Input value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
            <Button className="w-full" onClick={save} disabled={!draft.amount}>
              {t('save')}
            </Button>
            {draft.id && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setDraft({ category: draft.category, amount: draft.amount, method: draft.method, note: draft.note, date: today() })}
                >
                  <Icon name="repeat" size={16} /> {t('add')}
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (!confirmDelete(t)) return
                    await db.expenses.delete(draft.id!)
                    setDraft(null)
                  }}
                >
                  {t('delete')}
                </Button>
              </div>
            )}
          </>
        )}
      </Sheet>
    </Page>
  )
}
