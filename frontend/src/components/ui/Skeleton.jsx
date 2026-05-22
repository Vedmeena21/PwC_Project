import { cn } from '@/lib/utils'

// Generic skeleton block — use Tailwind classes to control width/height/shape.
export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />
}

// Pre-composed skeleton for the invoice list rows.
export function InvoiceRowSkeleton({ rows = 5 }) {
  return (
    <div className="divide-y divide-slate-50">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 md:gap-4 px-5 md:px-6 py-3.5">
          <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32 max-w-[40%]" />
            <Skeleton className="h-3 w-48 max-w-[60%]" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// Pre-composed skeleton for stat cards.
export function StatCardSkeleton() {
  return (
    <div className="card p-4 md:p-5 border-l-4 border-l-transparent">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="w-9 h-9 md:w-11 md:h-11 rounded-xl flex-shrink-0" />
      </div>
    </div>
  )
}
