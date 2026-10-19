import { useState } from 'react'
import { db, uid, type Service } from '../db'
import { groupBy, useServices } from '../hooks'
import { useI18n } from '../i18n'
import { cls, fmtDuration, money } from '../utils'
import { Button, confirmDelete, Empty, Fab, Field, Icon, Input, Page, Sheet } from '../components/ui'
import { normalize } from '../components/Pickers'

type Draft = Omit<Service, 'id'> & { id?: string }
const DURATIONS = [15, 30, 45, 60, 90, 120, 180]

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!on)
      }}
      className={cls('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-emerald-500' : 'bg-nude')}
    >
      <span className={cls('absolute top-1 h-5 w-5 rounded-full bg-onaccent shadow transition-all', on ? 'start-6' : 'start-1')} />
    </button>
  )
}

export default function Services() {
  const { t } = useI18n()
  const services = useServices()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))]
  const nq = normalize(q)
  const shown = services.filter((s) => (!cat || s.category === cat) && (!nq || normalize(s.name).includes(nq)))
  const groups = groupBy(shown, (s) => s.category || '—')
  const activeCount = services.filter((s) => s.active).length

  const save = async () => {
    if (!draft || !draft.name.trim()) return
    const data = { ...draft, name: draft.name.trim(), category: draft.category.trim() }
    if (draft.id) await db.services.put(data as Service)
    else await db.services.add({ ...data, id: uid() })
    setDraft(null)
  }

  const remove = async () => {
    if (!draft?.id || !confirmDelete(t)) return
    await db.services.delete(draft.id)
    setDraft(null)
  }

  return (
    <Page title={`${t('services')} (${activeCount})`} back>
      <div className="relative mb-3">
        <Icon name="search" size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input placeholder={t('searchService')} value={q} onChange={(e) => setQ(e.target.value)} className="ps-10" />
      </div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {[null, ...categories].map((c) => (
          <button
            key={c ?? 'all'}
            onClick={() => setCat(c)}
            className={cls('shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1', cat === c ? 'bg-ink text-cream ring-ink' : 'bg-white ring-nude')}
          >
            {c ?? t('all')}
          </button>
        ))}
      </div>

      {shown.length === 0 && <Empty icon="scissors" text={t('noData')} />}
      {[...groups].map(([g, list]) => (
        <div key={g} className="mb-5">
          <div className="mb-1.5 flex justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <span>{g}</span>
            <span>{list.length}</span>
          </div>
          <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
            {list.map((s) => (
              <div key={s.id} onClick={() => setDraft(s)} className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-blush-soft">
                <span className={cls('min-w-0 flex-1', !s.active && 'opacity-45')}>
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Icon name="clock" size={12} /> {fmtDuration(s.duration)}
                  </span>
                </span>
                <span className={cls('font-semibold', !s.active && 'opacity-45')}>{money(s.price)}</span>
                <Switch on={s.active} onChange={(v) => db.services.update(s.id, { active: v })} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Fab label={t('newService')} onClick={() => setDraft({ name: '', category: cat ?? categories[0] ?? '', price: 0, duration: 30, active: true })} />

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('edit') : t('newService')}>
        {draft && (
          <>
            <Field label={t('name')}>
              <Input value={draft.name} autoFocus={!draft.id} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('category')}>
              <div className="mb-2 flex flex-wrap gap-2">
                {categories.map((c) => (
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
              <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder={`+ ${t('category')}`} className="!py-2.5" />
            </Field>
            <Field label={`${t('price')} (DA)`}>
              <Input type="number" inputMode="numeric" value={draft.price || ''} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
            </Field>
            <Field label={t('duration')}>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...DURATIONS, draft.duration])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDraft({ ...draft, duration: m })}
                      className={cls('rounded-lg px-3 py-2 text-sm font-semibold ring-1', draft.duration === m ? 'bg-rose text-onaccent ring-rose' : 'bg-white ring-nude')}
                    >
                      {fmtDuration(m)}
                    </button>
                  ))}
              </div>
            </Field>
            <label className="mb-5 flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-nude">
              <span className="font-medium">{draft.active ? t('active') : t('inactive')}</span>
              <Switch on={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
            </label>
            <Button className="w-full" onClick={save} disabled={!draft.name.trim()}>
              {t('save')}
            </Button>
            {draft.id && (
              <Button variant="danger" className="mt-2 w-full" onClick={remove}>
                {t('delete')}
              </Button>
            )}
          </>
        )}
      </Sheet>
    </Page>
  )
}
