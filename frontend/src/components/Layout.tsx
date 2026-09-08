import { NavLink, Outlet } from 'react-router-dom'
import { FileText, Briefcase, ListChecks, Eye, Home } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/builder', label: 'Resume Builder', icon: FileText },
  { to: '/jobs', label: 'Job Analysis', icon: Briefcase },
  { to: '/verify', label: 'Verification Queue', icon: ListChecks },
  { to: '/preview', label: 'Preview', icon: Eye },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3">
          <span className="mr-6 text-lg font-bold text-slate-900">ResumeBuilder</span>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
