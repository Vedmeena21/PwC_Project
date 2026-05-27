import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, BookOpen, Settings, Users, LogOut, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useManageBadge } from '@/hooks/useApi'

// ── Sidebar nav items ─────────────────────────────────────────────────────────
// Manage is only rendered for admins (conditional below).
const BASE_NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/invoices', label: 'Invoices',  icon: FileText },
  { to: '/rulebook', label: 'Rulebook',  icon: BookOpen },
  { to: '/settings', label: 'Settings',  icon: Settings },
]

function NavItem({ to, label, icon: Icon, end, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-orange-50 text-[#D04A02]'
            : 'text-[#464646] hover:text-[#2D2D2D] hover:bg-gray-50'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#EB8C00] rounded-r-full" />
          )}
          <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-[#EB8C00]' : 'text-gray-400')} />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

// ── Profile chip ──────────────────────────────────────────────────────────────
function ProfileChip({ onSignout }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref  = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = (user?.name || user?.email || '?')[0].toUpperCase()
  const label    = user?.name || user?.email || ''
  const roleTag  = user?.role === 'admin' ? 'Admin' : 'User'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
      >
        {/* Avatar circle — PwC orange */}
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ backgroundColor: '#EB8C00' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#2D2D2D] text-xs font-semibold truncate">{label}</p>
          <p className="text-gray-400 text-xs">{roleTag}</p>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => { setOpen(false); onSignout() }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const manageBadge = useManageBadge(isAdmin)

  function handleSignout() {
    logout()
    navigate('/login', { replace: true })
  }

  const nav = isAdmin
    ? [...BASE_NAV, { to: '/manage', label: 'Manage', icon: Users, badge: manageBadge }]
    : BASE_NAV

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-30 border-r border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          {/* PwC wordmark */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-baseline">
              <span className="text-[#2D2D2D] text-xl font-black tracking-tight leading-none">Pw</span>
              <span className="text-[#EB8C00] text-xl font-black tracking-tight leading-none">C</span>
            </div>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <div>
              <p className="text-[#2D2D2D] text-[10px] font-bold leading-tight">Invoice Approval</p>
              <p className="text-gray-400 text-[9px] leading-tight">Automation System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon, end, badge }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={end} badge={badge} />
          ))}
        </nav>

        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
          <ProfileChip onSignout={handleSignout} />
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <span className="text-[#2D2D2D] text-lg font-black tracking-tight">Pw</span>
          <span className="text-[#EB8C00] text-lg font-black tracking-tight -ml-1">C</span>
          <span className="text-[#2D2D2D] text-sm font-medium ml-1">Invoice Approval</span>
        </div>
        <button onClick={handleSignout} className="text-gray-400 hover:text-red-500 transition-colors p-1">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 flex">
        {nav.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors duration-150',
                isActive ? 'text-[#EB8C00]' : 'text-gray-400'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors', isActive && 'bg-orange-50')}>
                  <Icon className="w-4 h-4" />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
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
