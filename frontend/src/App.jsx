import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Dashboard    from '@/pages/Dashboard'
import Invoices     from '@/pages/Invoices'
import InvoiceDetail from '@/pages/InvoiceDetail'
import Rulebook     from '@/pages/Rulebook'
import Settings     from '@/pages/Settings'
import { ToastProvider } from '@/components/ui/Toast'

// ── App ───────────────────────────────────────────────────────────────────────
// Root component. Wraps everything in:
//   BrowserRouter   — client-side routing (vercel.json rewrites handle page reload)
//   ToastProvider   — global toast context available to all pages
//   Layout          — fixed sidebar + main content area
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout>
          <Routes>
            <Route path="/"               element={<Dashboard />} />
            <Route path="/invoices"       element={<Invoices />} />
            {/* :id param read by useParams() inside InvoiceDetail */}
            <Route path="/invoices/:id"   element={<InvoiceDetail />} />
            <Route path="/rulebook"       element={<Rulebook />} />
            <Route path="/settings"       element={<Settings />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  )
}
