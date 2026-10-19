import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, importBackup } from '../db'
import { useSettings, type SalonSettings } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../theme'
import { cls, fillTpl, today } from '../utils'
import { Button, Card, Field, Icon, Input, Page, SectionTitle, Segmented, Select, Textarea } from '../components/ui'

export default function Settings() {
  const { t, lang, setLang, fmtDate } = useI18n()
  const [theme, setTheme] = useTheme()
  const [settings, update] = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<SalonSettings>(settings)
  const [savedAt, setSavedAt] = useState(0)

  // keep the form in sync once the stored settings load
  const loadedKey = JSON.stringify(settings)
  useEffect(() => setForm(settings), [loadedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useLiveQuery(
    async () => ({
      clients: await db.clients.count(),
      appts: await db.appointments.count(),
      payments: await db.payments.count(),
      photos: await db.photos.count(),
    }),
    [],
  )

  const dirty = JSON.stringify(form) !== loadedKey
  const set = <K extends keyof SalonSettings>(k: K, v: SalonSettings[K]) => setForm({ ...form, [k]: v })
  const save = async () => {
    await update(form)
    setSavedAt(Date.now())
  }

  const doExport = async () => {
    setBusy(true)
    try {
      const blob = await exportBackup()
      const name = `kiraz-look-${today()}.json`
      const file = new File([blob], name, { type: 'application/json' })
      let done = false
      if (navigator.canShare?.({ files: [file] })) {
        done = await navigator.share({ files: [file], title: name }).then(
          () => true,
          () => false,
        )
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        done = true
      }
      if (done) await update({ lastBackup: Date.now() })
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file?: File) => {
    if (!file || !window.confirm(t('importWarn'))) return
    setBusy(true)
    try {
      await importBackup(file)
      alert(t('importOk'))
    } catch {
      alert(t('importErr'))
    } finally {
      setBusy(false)
    }
  }

  const tpl = form.reminderTpl || t('reminderMsg')
  const preview = fillTpl(tpl, {
    name: 'Amina',
    date: fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' }),
    time: '10:00',
    salon: form.salonName || 'Kiraz Look',
  })
  const backupAge = settings.lastBackup ? Math.floor((Date.now() - settings.lastBackup) / 864e5) : null
  const backupLate = backupAge === null || backupAge > 7

  return (
    <Page title={t('settings')} back noNav>
      <SectionTitle>{t('appearance')}</SectionTitle>
      <div className="space-y-2">
        <Segmented
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: `☀ ${t('light')}` },
            { value: 'dark', label: `☾ ${t('dark')}` },
          ]}
        />
        <Segmented
          value={lang}
          onChange={setLang}
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'ar', label: 'العربية' },
          ]}
        />
      </div>

      <SectionTitle>{t('salon')}</SectionTitle>
      <Card>
        <Field label={t('salonName')}>
          <Input value={form.salonName} onChange={(e) => set('salonName', e.target.value)} />
        </Field>
        <Field label={t('phone')}>
          <Input type="tel" dir="ltr" value={form.salonPhone} onChange={(e) => set('salonPhone', e.target.value)} />
        </Field>
        <Field label={t('address')}>
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </Card>

      <SectionTitle>{t('hours')}</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('openTime')}>
            <Input type="time" value={form.openTime} onChange={(e) => set('openTime', e.target.value)} />
          </Field>
          <Field label={t('closeTime')}>
            <Input type="time" value={form.closeTime} onChange={(e) => set('closeTime', e.target.value)} />
          </Field>
        </div>
        <Field label={t('slotStep')}>
          <Select value={form.slotStep} onChange={(e) => set('slotStep', Number(e.target.value))}>
            {[15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <SectionTitle>{t('reminderTpl')}</SectionTitle>
      <Card>
        <Textarea rows={4} value={tpl} onChange={(e) => set('reminderTpl', e.target.value)} />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
          <span dir="ltr">{t('reminderVars')}</span>
          {form.reminderTpl && (
            <button onClick={() => set('reminderTpl', '')} className="font-semibold text-rose">
              {t('resetDefault')}
            </button>
          )}
        </div>
        <div className="mt-3 text-xs font-semibold uppercase text-muted">{t('preview')}</div>
        <div className="mt-1 rounded-2xl rounded-ss-sm bg-emerald-50 p-3 text-sm text-emerald-800">{preview}</div>
      </Card>

      {(dirty || savedAt > 0) && (
        <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-4 bg-cream/95 px-4 pb-3 pt-2 backdrop-blur">
          <Button className="w-full" onClick={save} disabled={!dirty}>
            {dirty ? (
              t('save')
            ) : (
              <>
                <Icon name="check" size={18} /> {t('saved')}
              </>
            )}
          </Button>
        </div>
      )}

      <SectionTitle>{t('backup')}</SectionTitle>
      <Card>
        <div className={cls('mb-3 flex items-center gap-2 rounded-xl p-2.5 text-sm', backupLate ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800')}>
          <Icon name={backupLate ? 'alert' : 'check'} size={18} />
          <span>
            {t('lastBackup')} :{' '}
            <b>{settings.lastBackup ? `${fmtDate(new Date(settings.lastBackup).toISOString().slice(0, 10), { day: 'numeric', month: 'short' })} (${t('daysAgo', { n: backupAge! })})` : t('never')}</b>
          </span>
        </div>
        <p className="mb-4 text-sm text-muted">{t('backupHint')}</p>
        <Button className="mb-2 w-full" onClick={doExport} disabled={busy}>
          <Icon name="download" size={20} /> {t('exportData')}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="upload" size={20} /> {t('importData')}
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => (doImport(e.target.files?.[0]), (e.target.value = ''))} />
      </Card>

      {counts && (
        <>
          <SectionTitle>{t('data')}</SectionTitle>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(
              [
                ['clients', counts.clients],
                ['appointments', counts.appts],
                ['transactions', counts.payments],
                ['photos', counts.photos],
              ] as const
            ).map(([k, v]) => (
              <Card key={k} className="!p-2">
                <div className="font-bold">{v}</div>
                <div className="truncate text-[10px] text-muted first-letter:uppercase">{k === 'photos' ? 'Photos' : t(k)}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-center text-xs text-muted">{t('installHint')}</p>
      <p className="mt-1 text-center font-display text-muted">Kiraz Look · v2</p>
    </Page>
  )
}
