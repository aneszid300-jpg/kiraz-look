import Dexie, { type EntityTable } from 'dexie'

export type Status = 'confirmed' | 'arrived' | 'done' | 'cancelled' | 'noshow'
export type PayMethod = 'cash' | 'ccp' | 'baridimob'

export interface Client {
  id: string
  name: string
  phone: string
  birthday?: string // YYYY-MM-DD
  colorFormula?: string
  allergies?: string
  preferences?: string
  createdAt: number
}

export interface Photo {
  id: string
  clientId: string
  kind: 'before' | 'after'
  blob: Blob
  date: string
  createdAt: number
}

export interface Service {
  id: string
  name: string
  category: string
  price: number
  duration: number // minutes
  active: boolean
}

export interface Appointment {
  id: string
  clientId: string
  date: string // YYYY-MM-DD
  start: string // HH:mm
  duration: number
  serviceIds: string[]
  status: Status
  note?: string
  paymentId?: string
  createdAt: number
}

export interface PaymentItem {
  name: string
  price: number
}

export interface Payment {
  id: string
  date: string
  time: string
  clientId?: string
  appointmentId?: string
  bridalId?: string
  items: PaymentItem[]
  subtotal: number
  discount: number
  amount: number // after discount
  method: PayMethod
  createdAt: number
}

export interface Product {
  id: string
  name: string
  category: string
  qty: number
  minQty: number
  unit: string
  cost?: number
}

export interface Expense {
  id: string
  date: string
  category: string
  amount: number
  method?: PayMethod // undefined = cash (older rows)
  note?: string
  createdAt: number
}

/** One row per day the cash drawer was opened */
export interface CashDay {
  date: string
  opening: number
  closing?: number // counted cash at close
  closedAt?: number
}

/** Manual drawer movement that is neither a sale nor an expense */
export interface CashMove {
  id: string
  date: string
  time: string
  type: 'in' | 'out'
  amount: number
  label: string
  createdAt: number
}

export interface Bridal {
  id: string
  clientId: string
  eventDate: string
  trialDate?: string
  items: PaymentItem[]
  total: number
  note?: string
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('kiraz-look') as Dexie & {
  clients: EntityTable<Client, 'id'>
  photos: EntityTable<Photo, 'id'>
  services: EntityTable<Service, 'id'>
  appointments: EntityTable<Appointment, 'id'>
  payments: EntityTable<Payment, 'id'>
  products: EntityTable<Product, 'id'>
  expenses: EntityTable<Expense, 'id'>
  bridals: EntityTable<Bridal, 'id'>
  settings: EntityTable<Setting, 'key'>
  cashDays: EntityTable<CashDay, 'date'>
  cashMoves: EntityTable<CashMove, 'id'>
}

db.version(1).stores({
  clients: 'id, name, phone, createdAt',
  photos: 'id, clientId, createdAt',
  services: 'id, category, name',
  appointments: 'id, date, clientId, status',
  payments: 'id, date, clientId, appointmentId, bridalId',
  products: 'id, name, category',
  expenses: 'id, date, category',
  bridals: 'id, clientId, eventDate',
  settings: 'key',
})

db.version(2).stores({
  cashDays: 'date',
  cashMoves: 'id, date',
})

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const DEFAULT_SERVICES: [string, string, number, number][] = [
  ['Brushing', 'Coiffure', 800, 30],
  ['Coupe', 'Coiffure', 1000, 30],
  ['Coupe + Brushing', 'Coiffure', 1500, 60],
  ['Chignon', 'Coiffure', 3000, 60],
  ['Couleur racines', 'Couleur', 3000, 90],
  ['Couleur complète', 'Couleur', 5000, 120],
  ['Mèches', 'Couleur', 6000, 150],
  ['Balayage', 'Couleur', 8000, 180],
  ['Lissage protéine', 'Soins', 10000, 180],
  ['Kératine', 'Soins', 9000, 180],
  ['Soin profond', 'Soins', 1500, 30],
  ['Maquillage soirée', 'Maquillage', 3000, 60],
  ['Maquillage mariée', 'Maquillage', 12000, 120],
  ['Épilation sourcils', 'Épilation', 300, 15],
  ['Épilation visage', 'Épilation', 600, 20],
]

db.on('populate', async () => {
  await db.services.bulkAdd(
    DEFAULT_SERVICES.map(([name, category, price, duration]) => ({
      id: uid(),
      name,
      category,
      price,
      duration,
      active: true,
    })),
  )
})

// ---- Backup ----

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(b)
  })

export async function exportBackup(): Promise<Blob> {
  const photos = await db.photos.toArray()
  const data = {
    app: 'kiraz-look',
    version: 2,
    exportedAt: new Date().toISOString(),
    clients: await db.clients.toArray(),
    services: await db.services.toArray(),
    appointments: await db.appointments.toArray(),
    payments: await db.payments.toArray(),
    products: await db.products.toArray(),
    expenses: await db.expenses.toArray(),
    bridals: await db.bridals.toArray(),
    settings: await db.settings.toArray(),
    cashDays: await db.cashDays.toArray(),
    cashMoves: await db.cashMoves.toArray(),
    photos: await Promise.all(
      photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob) })),
    ),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data.app !== 'kiraz-look') throw new Error('invalid')
  const photos: Photo[] = await Promise.all(
    (data.photos ?? []).map(async (p: Photo & { blob: string }) => ({
      ...p,
      blob: await (await fetch(p.blob)).blob(),
    })),
  )
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
    await db.clients.bulkAdd(data.clients ?? [])
    await db.services.bulkAdd(data.services ?? [])
    await db.appointments.bulkAdd(data.appointments ?? [])
    await db.payments.bulkAdd(data.payments ?? [])
    await db.products.bulkAdd(data.products ?? [])
    await db.expenses.bulkAdd(data.expenses ?? [])
    await db.bridals.bulkAdd(data.bridals ?? [])
    await db.settings.bulkAdd(data.settings ?? [])
    await db.cashDays.bulkAdd(data.cashDays ?? [])
    await db.cashMoves.bulkAdd(data.cashMoves ?? [])
    await db.photos.bulkAdd(photos)
  })
}
