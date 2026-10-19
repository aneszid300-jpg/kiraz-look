import { useState } from 'react'
import { db, uid, type Service } from '../db'
import { groupBy, useServices } from '../hooks'
import { useI18n } from '../i18n'
import { cls, fmtDuration, money } from '../utils'
import { Button, confirmDelete, Fab, Field, Input, Page, Sheet } from '../components/ui'

type Draft = Omit<Service, 'id'> & { id?: string }
const empty: Draft = { name: '', category: '', price: 0, duration: 30, active: true }

export default function Services() {
  const { t } = useI18n()
  const services = useServices()
  const [draft, setDraft] = useState<Draft | null>(null)
  const groups = groupBy(services, (s) => s.category || '—')
  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))]

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
    <Page title={t('services')} back>
      {[...groups].map(([cat, list]) => (
        <div key={cat} className="mb-5">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{cat}</div>
          <div className="divide-y divide-nude/60 overflow-hidden rounded-2xl bg-white ring-1 ring-nude">
            {list.map((s) => (
              <button key={s.id} onClick={() => setDraft(s)} className={cls('flex w-full items-center px-4 py-3 text-start active:bg-blush-soft', !s.active && 'opacity-45')}>
                <span className="flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">{fmtDuration(s.duration)}</span>
                </span>
                <span className="font-semibold">{money(s.price)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <Fab label={t('newService')} onClick={() => setDraft({ ...empty })} />

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('edit') : t('newService')}>
        {draft && (
          <>
            <Field label={t('name')}>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('category')}>
              <Input list="svc-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              <datalist id="svc-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('price')} (DA)`}>
                <Input type="number" inputMode="numeric" value={draft.price || ''} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
              </Field>
              <Field label={`${t('duration')} (${t('min')})`}>
                <Input type="number" inputMode="numeric" step={5} value={draft.duration || ''} onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })} />
              </Field>
            </div>
            <label className="mb-5 flex items-center gap-3">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-5 w-5 accent-rose" />
              <span className="font-medium">{t('active')}</span>
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
