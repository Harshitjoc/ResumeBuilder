import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rule bg-card px-12 py-16 text-center">
      <p className="eyebrow mb-2">404 · not on file</p>
      <p className="font-mono text-7xl font-semibold tracking-tight text-slate-900">404</p>
      <p className="mt-3 text-sm text-slate-500">
        That page doesn't exist — it may have been trimmed from the final draft.
      </p>
      <Link to="/" className="btn-pencil mt-6">
        <Home className="h-4 w-4" />
        Go home
      </Link>
    </div>
  )
}