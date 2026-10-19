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
