import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, uid } from '../db'
import { useI18n } from '../i18n'
import { Button, Field, Input, Page, Textarea } from '../components/ui'

export default function ClientForm() {
  const { t } = useI18n()
  const nav = useNavigate()
  const { id } = useParams()
  const [f, setF] = useState({ name: '', phone: '', birthday: '', colorFormula: '', allergies: '', preferences: '' })
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (id)
      db.clients.get(id).then((c) => {
        if (c)
          setF({
            name: c.name,
            phone: c.phone,
            birthday: c.birthday ?? '',
            colorFormula: c.colorFormula ?? '',
            allergies: c.allergies ?? '',
            preferences: c.preferences ?? '',
          })
      })
  }, [id])

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    setTried(true)
    if (!f.name.trim()) return
    const data = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      birthday: f.birthday || undefined,
      colorFormula: f.colorFormula.trim() || undefined,
      allergies: f.allergies.trim() || undefined,
      preferences: f.preferences.trim() || undefined,
    }
    if (id) {
      await db.clients.update(id, data)
      nav(-1)
    } else {
      const nid = uid()
      await db.clients.add({ id: nid, ...data, createdAt: Date.now() })
      nav(`/clients/${nid}`, { replace: true })
    }
  }

  return (
    <Page title={id ? t('editClient') : t('newClient')} back noNav>
      <Field label={t('name')} hint={tried && !f.name.trim() ? t('required') : undefined}>
        <Input autoFocus={!id} value={f.name} onChange={set('name')} />
      </Field>
      <Field label={t('phone')}>
        <Input type="tel" inputMode="tel" dir="ltr" value={f.phone} onChange={set('phone')} placeholder="05 / 06 / 07 …" />
      </Field>
      <Field label={t('birthday')}>
        <Input type="date" value={f.birthday} onChange={set('birthday')} />
      </Field>

      <h2 className="mb-3 mt-6 font-display text-xl font-bold">{t('techNotes')}</h2>
      <Field label={t('colorFormula')}>
        <Textarea rows={2} value={f.colorFormula} onChange={set('colorFormula')} placeholder={t('colorFormulaPh')} />
      </Field>
      <Field label={t('allergies')}>
        <Textarea rows={2} value={f.allergies} onChange={set('allergies')} />
      </Field>
      <Field label={t('preferences')}>
        <Textarea rows={2} value={f.preferences} onChange={set('preferences')} />
      </Field>

      <Button className="mt-2 w-full" onClick={save}>
        {t('save')}
      </Button>
    </Page>
  )
}
