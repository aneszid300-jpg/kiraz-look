import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Client, type Service } from './db'

export function useClientMap() {
  return useLiveQuery(async () => new Map((await db.clients.toArray()).map((c) => [c.id, c])), [], new Map<string, Client>())
}

export function useServices() {
  return useLiveQuery(() => db.services.orderBy('name').toArray(), [], [] as Service[])
}

export function useServiceMap() {
  const services = useServices()
  return new Map(services.map((s) => [s.id, s]))
}

export function groupBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    m.set(k, [...(m.get(k) ?? []), x])
  }
  return m
}

export interface SalonSettings {
  salonName: string
  salonPhone: string
  address: string
  openTime: string
  closeTime: string
  slotStep: number
  reminderTpl: string // empty = default translated message
  lastBackup?: number
}

export const DEFAULT_SETTINGS: SalonSettings = {
  salonName: 'Kiraz Look',
  salonPhone: '',
  address: '',
  openTime: '09:00',
  closeTime: '19:00',
  slotStep: 30,
  reminderTpl: '',
}

export function useSettings(): [SalonSettings, (patch: Partial<SalonSettings>) => Promise<void>] {
  const row = useLiveQuery(() => db.settings.get('salon'), [])
  const value = { ...DEFAULT_SETTINGS, ...((row?.value as Partial<SalonSettings>) ?? {}) }
  const update = async (patch: Partial<SalonSettings>) => {
    const cur = (await db.settings.get('salon'))?.value as Partial<SalonSettings> | undefined
    await db.settings.put({ key: 'salon', value: { ...DEFAULT_SETTINGS, ...cur, ...patch } })
  }
  return [value, update]
}
