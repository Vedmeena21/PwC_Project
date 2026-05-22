import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      {/* Desktop: offset by sidebar width. Mobile: offset by top bar + bottom nav */}
      <main className="md:ml-60 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
