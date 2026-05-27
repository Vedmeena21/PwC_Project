import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute   from '@/components/auth/ProtectedRoute'
import Layout           from '@/components/layout/Layout'
import Login            from '@/pages/Login'
import Dashboard        from '@/pages/Dashboard'
import Invoices         from '@/pages/Invoices'
import InvoiceDetail    from '@/pages/InvoiceDetail'
import Rulebook         from '@/pages/Rulebook'
import Settings         from '@/pages/Settings'
import Manage           from '@/pages/Manage'
import { ToastProvider } from '@/components/ui/Toast'

// ── App ───────────────────────────────────────────────────────────────────────
// Root component. AuthProvider wraps everything so any component can call
// useAuth(). Protected routes redirect to /login when unauthenticated.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — all wrapped in Layout */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/"               element={<Dashboard />} />
                      <Route path="/invoices"       element={<Invoices />} />
                      <Route path="/invoices/:id"   element={<InvoiceDetail />} />
                      <Route path="/rulebook"       element={<Rulebook />} />
                      <Route path="/settings"       element={<Settings />} />
                      {/* Admin only */}
                      <Route
                        path="/manage"
                        element={
                          <ProtectedRoute adminOnly>
                            <Manage />
                          </ProtectedRoute>
                        }
                      />
                      {/* Catch-all */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
