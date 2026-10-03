import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-gray-600 mb-4">
        That page does not exist.
      </p>
      <Link href="/" className="text-sm font-medium text-blue-600">
        Back to episodes
      </Link>
    </main>
  )
}
