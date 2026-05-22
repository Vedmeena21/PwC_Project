import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Toast context ─────────────────────────────────────────────────────────────
// Provides a toast(options) function to any component in the tree.
// Usage: const toast = useToast(); toast({ type: 'success', message: '...' })
const ToastContext = createContext(null)

// Visual config per toast type
const ICONS  = { success: CheckCircle, error: XCircle, info: AlertCircle }
const COLORS = {
  success: 'border-green-200 bg-green-50',
  error:   'border-red-200 bg-red-50',
  info:    'border-blue-200 bg-blue-50',
}
const ICON_COLORS = { success: 'text-green-600', error: 'text-red-600', info: 'text-blue-600' }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  // Add a toast and auto-remove after `duration` ms
  const toast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast stack — fixed bottom-right, pointer-events-none on container
          so toasts don't block page clicks when empty */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto animate-slide-up max-w-sm',
                COLORS[t.type]
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', ICON_COLORS[t.type])} />
              <p className="text-sm text-slate-800 flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
