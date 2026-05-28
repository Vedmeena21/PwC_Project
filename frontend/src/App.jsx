import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
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

// Wraps all authenticated pages: checks login then renders Layout + child page
function AuthLayout() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<AuthLayout />}>
              <Route index                element={<Dashboard />} />
              <Route path="invoices"      element={<Invoices />} />
              <Route path="invoices/:id"  element={<InvoiceDetail />} />
              <Route path="rulebook"      element={<Rulebook />} />
              <Route path="settings"      element={<Settings />} />
              <Route path="manage"        element={<ProtectedRoute adminOnly><Manage /></ProtectedRoute>} />
              <Route path="*"             element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
