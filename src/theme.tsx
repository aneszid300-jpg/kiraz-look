import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const read = (): Theme => {
  try {
    const v = localStorage.getItem('theme')
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const apply = (t: Theme) => {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#1d1517' : '#fbf6f3')
}

apply(read())

const listeners = new Set<(t: Theme) => void>()

export function setTheme(t: Theme) {
  try {
    localStorage.setItem('theme', t)
  } catch {
    /* ignore */
  }
  apply(t)
  listeners.forEach((l) => l(t))
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [t, set] = useState<Theme>(read)
  useEffect(() => {
    listeners.add(set)
    return () => void listeners.delete(set)
  }, [])
  return [t, setTheme]
}
