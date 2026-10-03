import type { Metadata } from 'next'

// Saved episodes live in the visitor's localStorage, so there is nothing
// crawlable or shareable here — keep it out of the index.
export const metadata: Metadata = {
  title: 'Saved episodes',
  robots: { index: false, follow: false },
}

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
