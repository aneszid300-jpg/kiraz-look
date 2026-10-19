import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Photo } from '../db'
import { useServiceMap } from '../hooks'
import { useI18n } from '../i18n'
import { cls, compressImage, money, today, waLink } from '../utils'
import { Avatar, btnCls, Card, confirmDelete, Icon, Page, SectionTitle, StatusBadge } from '../components/ui'

function PhotoImg({ photo, className, onClick }: { photo: Photo; className?: string; onClick?: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])
  return url ? <img src={url} onClick={onClick} className={className} alt="" /> : null
}

export default function ClientDetail() {
  const { t, fmtDate } = useI18n()
  const nav = useNavigate()
  const { id = '' } = useParams()
  const services = useServiceMap()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Photo['kind']>('before')
  const [viewing, setViewing] = useState<Photo | null>(null)

  const client = useLiveQuery(() => db.clients.get(id), [id])
  const appts = useLiveQuery(() => db.appointments.where('clientId').equals(id).reverse().sortBy('date'), [id], [])
  const payments = useLiveQuery(() => db.payments.where('clientId').equals(id).toArray(), [id], [])
  const photos = useLiveQuery(() => db.photos.where('clientId').equals(id).reverse().sortBy('createdAt'), [id], [] as Photo[])

  if (client === undefined) return null
  if (!client) return <Page title="—" back noNav>{null}</Page>

  const payById = new Map(payments.map((p) => [p.id, p]))
  const visits = appts.filter((a) => a.status === 'done').length
  const total = payments.reduce((s, p) => s + p.amount, 0)
  const last = appts.find((a) => a.status === 'done')
  const upcoming = appts.filter((a) => a.date >= today() && (a.status === 'confirmed' || a.status === 'arrived')).reverse()
  const past = appts.filter((a) => !upcoming.includes(a))

  const addPhoto = async (file?: File) => {
    if (!file) return
    const blob = await compressImage(file)
    await db.photos.add({ id: uid(), clientId: id, kind, blob, date: today(), createdAt: Date.now() })
  }

  const remove = async () => {
    if (!confirmDelete(t)) return
    await db.transaction('rw', db.clients, db.photos, db.appointments, async () => {
      await db.photos.where('clientId').equals(id).delete()
      await db.appointments.where('clientId').equals(id).delete()
      await db.clients.delete(id)
    })
    nav('/clients', { replace: true })
  }

  const apptRow = (a: (typeof appts)[number]) => (
    <button key={a.id} onClick={() => nav(`/appt/${a.id}`)} className="flex w-full items-start gap-3 px-4 py-3 text-start active:bg-blush-soft">
      <div className="w-16 shrink-0 text-sm">
        <div className="font-semibold">{fmtDate(a.date, { day: 'numeric', month: 'short' })}</div>
        <div className="text-xs text-muted">{a.date.slice(0, 4)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{a.serviceIds.map((s) => services.get(s)?.name).filter(Boolean).join(' · ')}</div>
        <div className="mt-1">
          <StatusBadge status={a.status} />
        </div>
      </div>
      {a.paymentId && payById.get(a.paymentId) && <div className="text-sm font-semibold">{money(payById.get(a.paymentId)!.amount)}</div>}
    </button>
  )

  return (
    <Page
      title={client.name}
      back
      noNav
      right={
        <button onClick={() => nav(`/clients/${id}/edit`)} className="grid h-10 w-10 place-items-center rounded-full active:bg-blush" aria-label={t('edit')}>
          <Icon name="edit" size={20} />
        </button>
      }
    >
      <div className="flex items-center gap-4">
        <Avatar name={client.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-bold">{client.name}</div>
          <div className="text-muted" dir="ltr">
            {client.phone}
          </div>
        </div>
      </div>

      {client.phone && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${client.phone}`} className={btnCls('ghost')}>
            <Icon name="phone" size={18} /> {t('call')}
          </a>
          <a href={waLink(client.phone)} target="_blank" rel="noreferrer" className={btnCls('ghost', 'text-emerald-700')}>
            <Icon name="chat" size={18} /> {t('whatsapp')}
          </a>
        </div>
      )}
      <button onClick={() => nav(`/appt/new?client=${id}`)} className={btnCls('primary', 'mt-2 w-full')}>
        <Icon name="plus" size={20} /> {t('newAppt')}
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Card className="!p-3">
          <div className="text-xl font-bold">{visits}</div>
          <div className="text-xs text-muted">{t('visits')}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-base font-bold leading-7">{money(total)}</div>
          <div className="text-xs text-muted">{t('totalSpent')}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-base font-bold leading-7">{last ? fmtDate(last.date, { day: 'numeric', month: 'short' }) : '—'}</div>
          <div className="text-xs text-muted">{t('lastVisit')}</div>
        </Card>
      </div>

      <SectionTitle>{t('techNotes')}</SectionTitle>
      <Card className="space-y-3 text-sm">
        {client.allergies && (
          <div className="flex gap-2 rounded-xl bg-amber-50 p-2.5 text-amber-900">
            <Icon name="alert" size={18} className="shrink-0" />
            <div>
              <b>{t('allergies')} :</b> {client.allergies}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs font-semibold uppercase text-muted">{t('colorFormula')}</div>
          <div className="whitespace-pre-wrap font-medium">{client.colorFormula || '—'}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted">{t('preferences')}</div>
          <div className="whitespace-pre-wrap">{client.preferences || '—'}</div>
        </div>
      </Card>

      <SectionTitle>{t('photos')}</SectionTitle>
      <div className="mb-2 grid grid-cols-2 gap-2">
        {(['before', 'after'] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k)
              fileRef.current?.click()
            }}
            className={btnCls('soft', 'text-sm')}
          >
            <Icon name="camera" size={18} /> {t(k)}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (addPhoto(e.target.files?.[0]), (e.target.value = ''))} />
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-nude">
              <PhotoImg photo={p} className="h-full w-full object-cover" onClick={() => setViewing(p)} />
              <span className={cls('absolute start-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-onaccent', p.kind === 'before' ? 'bg-black/60' : 'bg-rose')}>
                {t(p.kind)}
              </span>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle>{t('upcoming')}</SectionTitle>
          <Card className="divide-y divide-nude/60 !p-0">{upcoming.map(apptRow)}</Card>
        </>
      )}

      <SectionTitle>{t('history')}</SectionTitle>
      {past.length ? <Card className="divide-y divide-nude/60 !p-0">{past.map(apptRow)}</Card> : <p className="text-sm text-muted">—</p>}

      <button onClick={remove} className="mt-8 w-full py-3 text-sm font-semibold text-red-600">
        {t('delete')}
      </button>

      {viewing && (
        <div className="animate-fade fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-3 text-onaccent">
            <button
              onClick={async () => {
                if (!confirmDelete(t)) return
                await db.photos.delete(viewing.id)
                setViewing(null)
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-onaccent/10"
            >
              <Icon name="trash" size={20} />
            </button>
            <span className="text-sm">
              {t(viewing.kind)} · {fmtDate(viewing.date, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setViewing(null)} className="grid h-11 w-11 place-items-center rounded-full bg-onaccent/10">
              <Icon name="close" />
            </button>
          </div>
          <PhotoImg photo={viewing} className="min-h-0 flex-1 object-contain" />
        </div>
      )}
    </Page>
  )
}
