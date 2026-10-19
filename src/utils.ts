import type { Appointment } from './db'

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toISO(new Date())

export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (s: string, n: number) => {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Monday of the week containing `s` */
export const weekStart = (s: string) => {
  const d = parseISO(s)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toISO(d)
}

export const monthKey = (s: string) => s.slice(0, 7)

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const fromMin = (min: number) =>
  `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`

export const endTime = (a: Pick<Appointment, 'start' | 'duration'>) =>
  fromMin(toMin(a.start) + a.duration)

export const overlaps = (
  a: Pick<Appointment, 'start' | 'duration'>,
  b: Pick<Appointment, 'start' | 'duration'>,
) => {
  const s1 = toMin(a.start)
  const s2 = toMin(b.start)
  return s1 < s2 + b.duration && s2 < s1 + a.duration
}

export const money = (n: number) =>
  `${Math.round(n).toLocaleString('fr-DZ').replace(/ | /g, ' ')} DA`

export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h}h${pad(m)}` : `${h}h`
}

/** Algerian number -> international format for wa.me */
export const waPhone = (phone: string) => {
  let p = phone.replace(/[^\d+]/g, '')
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('00')) return p.slice(2)
  if (p.startsWith('0')) p = '213' + p.slice(1)
  return p
}

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${waPhone(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`

/** Resize image to keep IndexedDB small */
export async function compressImage(file: File, max = 1280, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality))
}

export const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

export const fillTpl = (tpl: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), tpl)
