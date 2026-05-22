import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, BookOpen, Settings, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/invoices', label: 'Invoices',  icon: FileText },
  { to: '/rulebook', label: 'Rulebook',  icon: BookOpen },
  { to: '/settings', label: 'Settings',  icon: Settings },
]

export default function Sidebar() {
  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-gradient-to-b from-slate-950 to-slate-900 flex-col z-30 border-r border-slate-800/50">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/70">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Invoice Approval</p>
            <p className="text-slate-500 text-xs">Automation System</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-full" />
                  )}
                  <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive && 'text-brand-400')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-slate-600 text-xs">v1.0.0 · PwC Project</p>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-slate-950 flex items-center px-4 z-30 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-white text-sm font-semibold">Invoice Approval</p>
        </div>
      </header>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-950 border-t border-slate-800 z-30 flex">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors duration-150',
                isActive ? 'text-white' : 'text-slate-500'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('w-8 h-8 flex items-center justify-center rounded-lg transition-colors', isActive && 'bg-slate-800')}>
                  <Icon className="w-4 h-4" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
