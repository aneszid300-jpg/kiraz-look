import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Appointment, type CashMove, type Expense, type PayMethod, type Payment } from '../db'
import { useClientMap, useServiceMap } from '../hooks'
import { useI18n } from '../i18n'
import { addDays, cls, money, nowTime, today } from '../utils'
import { Button, Card, confirmDelete, Field, Icon, Input, Page, SectionTitle, Segmented, Sheet, type IconName } from '../components/ui'
import { MethodPicker } from './Checkout'

const isCash = (m?: PayMethod) => !m || m === 'cash'
const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
const hhmm = (ts: number) => new Date(ts).toTimeString().slice(0, 5)

type Row =
  | { kind: 'sale'; time: string; p: Payment }
  | { kind: 'move'; time: string; m: CashMove }
  | { kind: 'expense'; time: string; e: Expense }

type SheetKind = null | 'opening' | 'in' | 'out' | 'close' | { row: Row }

export default function Cash() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('d') ?? today()
  const clients = useClientMap()
  const services = useServiceMap()
  const expCats = t('expCats').split(',')

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [outKind, setOutKind] = useState<'expense' | 'withdraw'>('expense')
  const [cat, setCat] = useState(expCats[0])
  const [method, setMethod] = useState<PayMethod>('cash')

  const data = useLiveQuery(async () => {
    const prev = await db.cashDays.where('date').below(date).reverse().first()
    return {
      day: await db.cashDays.get(date),
      prevClosing: prev?.closing,
      payments: await db.payments.where('date').equals(date).toArray(),
      moves: await db.cashMoves.where('date').equals(date).toArray(),
      expenses: await db.expenses.where('date').equals(date).toArray(),
      toCash: await db.appointments
        .where('date')
        .equals(date)
        .filter((a) => !a.paymentId && (a.status === 'arrived' || a.status === 'done'))
        .sortBy('start'),
    }
  }, [date])

  if (!data) return null
  const { day, payments, moves, expenses, toCash } = data
  const opening = day?.opening ?? data.prevClosing ?? 0
  const closed = day?.closing !== undefined

  const sales = sum(payments)
  const cashSales = sum(payments.filter((p) => isCash(p.method)))
  const ins = moves.filter((m) => m.type === 'in')
  const outs = moves.filter((m) => m.type === 'out')
  const cashExp = sum(expenses.filter((e) => isCash(e.method)))
  const inflows = sales + sum(ins)
  const outflows = sum(expenses) + sum(outs)
  const theoretical = opening + cashSales + sum(ins) - cashExp - sum(outs)

  const rows: Row[] = [
    ...payments.map((p) => ({ kind: 'sale' as const, time: p.time, p })),
    ...moves.map((m) => ({ kind: 'move' as const, time: m.time, m })),
    ...expenses.map((e) => ({ kind: 'expense' as const, time: hhmm(e.createdAt), e })),
  ].sort((a, b) => b.time.localeCompare(a.time))

  const openSheet = (k: SheetKind, preset = '') => {
    setAmount(preset)
    setLabel('')
    setMethod('cash')
    setOutKind('expense')
    setCat(expCats[0])
    setSheet(k)
  }
  const close = () => setSheet(null)
  const n = Number(amount) || 0

  const saveOpening = async () => {
    await db.cashDays.put({ ...(day ?? { date }), date, opening: n })
    close()
  }
  const saveIn = async () => {
    if (!n) return
    await db.cashMoves.add({ id: uid(), date, time: nowTime(), type: 'in', amount: n, label: label.trim() || t('manualIn'), createdAt: Date.now() })
    close()
  }
  const saveOut = async () => {
    if (!n) return
    if (outKind === 'expense') await db.expenses.add({ id: uid(), date, category: cat, amount: n, method, note: label.trim() || undefined, createdAt: Date.now() })
    else await db.cashMoves.add({ id: uid(), date, time: nowTime(), type: 'out', amount: n, label: label.trim() || t('manualOut'), createdAt: Date.now() })
    close()
  }
  const saveClose = async () => {
    await db.cashDays.put({ date, opening, closing: n, closedAt: Date.now() })
    close()
  }
  const reopen = async () => {
    await db.cashDays.put({ date, opening })
  }

  const removeRow = async (r: Row) => {
    if (!confirmDelete(t)) return
    if (r.kind === 'sale')
      await db.transaction('rw', db.payments, db.appointments, async () => {
        await db.payments.delete(r.p.id)
        if (r.p.appointmentId) await db.appointments.update(r.p.appointmentId, { paymentId: undefined })
      })
    else if (r.kind === 'move') await db.cashMoves.delete(r.m.id)
    else await db.expenses.delete(r.e.id)
    close()
  }

  const rowView = (r: Row): { icon: IconName; title: string; sub: string; amount: number; sign: 1 | -1; offDrawer: boolean } => {
    if (r.kind === 'sale')
      return {
        icon: 'wallet',
        title: (r.p.clientId && clients.get(r.p.clientId)?.name) || t('quickSale'),
        sub: `${t(`m_${r.p.method}`)} · ${r.p.items.map((i) => i.name).join(', ')}`,
        amount: r.p.amount,
        sign: 1,
        offDrawer: !isCash(r.p.method),
      }
    if (r.kind === 'move')
      return { icon: r.m.type === 'in' ? 'arrowDown' : 'arrowUp', title: r.m.label, sub: r.m.type === 'in' ? t('manualIn') : t('manualOut'), amount: r.m.amount, sign: r.m.type === 'in' ? 1 : -1, offDrawer: false }
    return {
      icon: 'receipt',
      title: r.e.category,
      sub: `${t('expense')} · ${t(`m_${r.e.method ?? 'cash'}`)}${r.e.note ? ' · ' + r.e.note : ''}`,
      amount: r.e.amount,
      sign: -1,
      offDrawer: !isCash(r.e.method),
    }
  }

  const gap = n - theoretical

  return (
    <Page title={t('cash')}>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setParams({ d: addDays(date, -1) }, { replace: true })} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude" aria-label="prev">
          <Icon name="back" flip />
        </button>
        <button onClick={() => setParams({}, { replace: true })} className="font-semibold capitalize">
          {date === today() ? t('today') : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        </button>
        <button onClick={() => setParams({ d: addDays(date, 1) }, { replace: true })} className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-nude" aria-label="next">
          <Icon name="chevron" flip />
        </button>
      </div>

      {/* Drawer balance */}
      <div className="rounded-3xl bg-gradient-to-br from-rose to-rose-dark p-5 text-onaccent shadow-lg shadow-rose/30">
        <div className="flex items-center justify-between">
          <span className="text-sm text-onaccent/85">
            {t('theoretical')} · {t('cashInDrawer')}
          </span>
          {closed && (
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-onaccent/15 px-2 py-0.5 text-xs font-semibold">
              <Icon name="lock" size={12} /> {t('closed')}
            </span>
          )}
        </div>
        <div className="mt-1 text-4xl font-bold tracking-tight">{money(theoretical)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <button onClick={() => !closed && openSheet('opening', String(opening))} className="rounded-xl bg-onaccent/15 px-2 py-2">
            <div className="flex items-center justify-center gap-1 text-[11px] text-onaccent/80">
              {t('opening')} {!closed && <Icon name="edit" size={10} />}
            </div>
            <div className="text-sm font-bold">{money(opening)}</div>
          </button>
          <div className="rounded-xl bg-onaccent/15 px-2 py-2">
            <div className="text-[11px] text-onaccent/80">+ {t('m_cash')}</div>
            <div className="text-sm font-bold">{money(cashSales + sum(ins))}</div>
          </div>
          <div className="rounded-xl bg-onaccent/15 px-2 py-2">
            <div className="text-[11px] text-onaccent/80">− {t('m_cash')}</div>
            <div className="text-sm font-bold">{money(cashExp + sum(outs))}</div>
          </div>
        </div>
      </div>

      {/* Inflows / outflows, all methods */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Card className="!p-3.5">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Icon name="arrowDown" size={12} />
            </span>
            {t('inflows')}
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-700">{money(inflows)}</div>
          <div className="text-[11px] text-muted">
            {t('sales')} {money(sales)}
            {sales !== cashSales && (
              <>
                <br />
                {t('otherMethods')} {money(sales - cashSales)}
              </>
            )}
          </div>
        </Card>
        <Card className="!p-3.5">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-red-100 text-red-700">
              <Icon name="arrowUp" size={12} />
            </span>
            {t('outflows')}
          </div>
          <div className="mt-1 text-lg font-bold text-red-700">{money(outflows)}</div>
          <div className="text-[11px] text-muted">
            {t('expenses')} {money(sum(expenses))}
            {outs.length > 0 && (
              <>
                <br />
                {t('manualOut')} {money(sum(outs))}
              </>
            )}
          </div>
        </Card>
      </div>

      {closed ? (
        <Card className="mt-2 flex items-center gap-3 !p-3.5">
          <Icon name="lock" className="text-muted" />
          <div className="flex-1 text-sm">
            <div>
              {t('counted')} : <b>{money(day!.closing!)}</b>
            </div>
            <div className={cls('font-semibold', day!.closing! - theoretical === 0 ? 'text-emerald-700' : 'text-red-700')}>
              {t('gap')} : {day!.closing! - theoretical > 0 ? '+' : ''}
              {money(day!.closing! - theoretical)}
            </div>
          </div>
          <Button variant="ghost" className="!min-h-10 text-sm" onClick={reopen}>
            {t('reopen')}
          </Button>
        </Card>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button variant="soft" className="text-sm" onClick={() => openSheet('in')}>
            <Icon name="plus" size={18} /> {t('inflows')}
          </Button>
          <Button variant="soft" className="text-sm" onClick={() => openSheet('out')}>
            <Icon name="minus" size={18} /> {t('outflows')}
          </Button>
          <Button variant="ghost" className="px-2 text-sm" onClick={() => openSheet('close', String(theoretical))}>
            <Icon name="lock" size={16} /> {t('closeRegister').split(' ')[0]}
          </Button>
        </div>
      )}

      {toCash.length > 0 && (
        <>
          <SectionTitle>{t('checkout')}</SectionTitle>
          <div className="space-y-2">
            {toCash.map((a: Appointment) => (
              <Card key={a.id} onClick={() => nav(`/checkout?appt=${a.id}`)} className="flex items-center gap-3 !p-3">
                <span className="w-12 font-bold tabular-nums">{a.start}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{clients.get(a.clientId)?.name}</span>
                  <span className="block truncate text-xs text-muted">{a.serviceIds.map((s) => services.get(s)?.name).join(' · ')}</span>
                </span>
                <span className="rounded-full bg-rose px-3 py-1.5 text-sm font-semibold text-onaccent">{t('checkout')}</span>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>
        {t('movements')} ({rows.length})
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t('noPayments')}</p>
      ) : (
        <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
          {rows.map((r, i) => {
            const v = rowView(r)
            return (
              <button key={i} onClick={() => setSheet({ row: r })} className="flex w-full items-center gap-3 px-3 py-3 text-start active:bg-blush-soft">
                <span className={cls('grid h-9 w-9 shrink-0 place-items-center rounded-full', v.sign > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                  <Icon name={v.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{v.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.time} · {v.sub}
                  </span>
                </span>
                <span className="text-end">
                  <span className={cls('block font-bold tabular-nums', v.sign > 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {v.sign > 0 ? '+' : '−'} {money(v.amount)}
                  </span>
                  {v.offDrawer && <span className="block text-[10px] text-muted">{t('notCountedInDrawer')}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button onClick={() => nav('/checkout')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-rose">
        <Icon name="plus" size={18} /> {t('quickSale')}
      </button>

      {/* ---- sheets ---- */}
      <Sheet open={sheet === 'opening'} onClose={close} title={t('opening')}>
        <p className="mb-3 text-sm text-muted">{t('openingHint')}</p>
        <Field label={`${t('amount')} (DA)`}>
          <Input type="number" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Button className="w-full" onClick={saveOpening}>
          {t('save')}
        </Button>
      </Sheet>

      <Sheet open={sheet === 'in'} onClose={close} title={t('inflows')}>
        <Button variant="soft" className="mb-4 w-full" onClick={() => nav('/checkout')}>
          <Icon name="wallet" size={18} /> {t('quickSale')}
        </Button>
        <div className="mb-2 text-sm font-semibold">{t('manualIn')}</div>
        <Field label={`${t('amount')} (DA)`}>
          <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('label')}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('manualIn')} />
        </Field>
        <Button className="w-full" onClick={saveIn} disabled={!n}>
          {t('save')}
        </Button>
      </Sheet>

      <Sheet open={sheet === 'out'} onClose={close} title={t('outflows')}>
        <div className="mb-4">
          <Segmented
            value={outKind}
            onChange={setOutKind}
            options={[
              { value: 'expense', label: t('expense') },
              { value: 'withdraw', label: t('manualOut') },
            ]}
          />
        </div>
        {outKind === 'expense' && (
          <Field label={t('category')}>
            <div className="flex flex-wrap gap-2">
              {expCats.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={cls('rounded-full px-3 py-1.5 text-sm ring-1', cat === c ? 'bg-rose text-onaccent ring-rose' : 'bg-white ring-nude')}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label={`${t('amount')} (DA)`}>
          <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {outKind === 'expense' && (
          <div className="mb-4">
            <MethodPicker value={method} onChange={setMethod} />
          </div>
        )}
        <Field label={outKind === 'expense' ? t('note') : t('label')}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Button className="w-full" onClick={saveOut} disabled={!n}>
          {t('save')}
        </Button>
      </Sheet>

      <Sheet open={sheet === 'close'} onClose={close} title={t('closeRegister')}>
        <div className="mb-4 flex justify-between rounded-2xl bg-white p-3 ring-1 ring-nude">
          <span className="text-muted">{t('theoretical')}</span>
          <b>{money(theoretical)}</b>
        </div>
        <Field label={`${t('counted')} (DA)`}>
          <Input type="number" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <div className={cls('mb-4 rounded-2xl p-3 text-center font-bold', gap === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
          {t('gap')} : {gap > 0 ? '+' : ''}
          {money(gap)}
        </div>
        <Button className="w-full" onClick={saveClose}>
          <Icon name="lock" size={18} /> {t('closeRegister')}
        </Button>
      </Sheet>

      <Sheet open={typeof sheet === 'object' && sheet !== null} onClose={close} title={sheet && typeof sheet === 'object' ? `${sheet.row.time} · ${rowView(sheet.row).title}` : ''}>
        {sheet && typeof sheet === 'object' && (
          <>
            {sheet.row.kind === 'sale' && (
              <div className="mb-4 divide-y divide-nude/60 rounded-2xl bg-white ring-1 ring-nude">
                {sheet.row.p.items.map((i, k) => (
                  <div key={k} className="flex justify-between px-3 py-2.5">
                    <span>{i.name}</span>
                    <span>{money(i.price)}</span>
                  </div>
                ))}
                {sheet.row.p.discount > 0 && (
                  <div className="flex justify-between px-3 py-2.5 text-rose">
                    <span>{t('discount')}</span>
                    <span>− {money(sheet.row.p.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-3 py-2.5 font-bold">
                  <span>
                    {t('total')} · {t(`m_${sheet.row.p.method}`)}
                  </span>
                  <span>{money(sheet.row.p.amount)}</span>
                </div>
              </div>
            )}
            {sheet.row.kind !== 'sale' && (
              <div className="mb-4 rounded-2xl bg-white p-3 ring-1 ring-nude">
                <div className="text-sm text-muted">{rowView(sheet.row).sub}</div>
                <div className="text-2xl font-bold">{money(rowView(sheet.row).amount)}</div>
              </div>
            )}
            <Button variant="danger" className="w-full" onClick={() => removeRow(sheet.row)}>
              <Icon name="trash" size={18} /> {t('delete')}
            </Button>
          </>
        )}
      </Sheet>
    </Page>
  )
}
