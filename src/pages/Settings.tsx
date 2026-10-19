import { useRef, useState } from 'react'
import { exportBackup, importBackup } from '../db'
import { useI18n } from '../i18n'
import { today } from '../utils'
import { Button, Card, Icon, Page, SectionTitle, Segmented } from '../components/ui'

export default function Settings() {
  const { t, lang, setLang } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const doExport = async () => {
    setBusy(true)
    try {
      const blob = await exportBackup()
      const name = `kiraz-look-${today()}.json`
      const file = new File([blob], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch(() => {})
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
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

  return (
    <Page title={t('settings')} back noNav>
      <SectionTitle>{t('language')}</SectionTitle>
      <Segmented
        value={lang}
        onChange={setLang}
        options={[
          { value: 'fr', label: 'Français' },
          { value: 'ar', label: 'العربية' },
        ]}
      />

      <SectionTitle>{t('backup')}</SectionTitle>
      <Card>
        <p className="mb-4 text-sm text-muted">{t('backupHint')}</p>
        <Button className="mb-2 w-full" onClick={doExport} disabled={busy}>
          <Icon name="download" size={20} /> {t('exportData')}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="upload" size={20} /> {t('importData')}
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => (doImport(e.target.files?.[0]), (e.target.value = ''))} />
      </Card>

      <p className="mt-6 text-center text-xs text-muted">{t('installHint')}</p>
    </Page>
  )
}
