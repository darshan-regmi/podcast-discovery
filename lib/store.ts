'use client'

type Listener = () => void

const listeners = new Set<Listener>()
let version = 0

export function getVersion(): number {
  return version
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notify(): void {
  version += 1
  listeners.forEach(listener => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', notify)
}
