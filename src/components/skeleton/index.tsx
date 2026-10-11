type SkeletonProps = {
  className?: string
}

export const Skeleton = ({ className = '' }: SkeletonProps) => {
  return <span className={`skeleton ${className}`} />
}

export const StatCardSkeleton = () => {
  return (
    <div className="glass-card p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-32" />
    </div>
  )
}

export const DebtCardSkeleton = () => {
  return (
    <article className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-4 w-4/5" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-6 h-3 w-28" />
    </article>
  )
}

export const DebtGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <DebtCardSkeleton key={index} />
      ))}
    </div>
  )
}

export const PeopleTableSkeleton = () => {
  return (
    <div className="table-shell">
      <div className="grid grid-cols-4 gap-4 border-b border-white/60 px-4 py-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, row) => (
        <div
          key={row}
          className="grid grid-cols-4 items-center gap-4 border-b border-white/40 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export const ChartCardSkeleton = ({ tall = false }: { tall?: boolean }) => {
  return (
    <div className="glass-card p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-5 w-40" />
      <Skeleton
        className={`mt-6 w-full rounded-3xl ${tall ? 'h-44' : 'h-36'}`}
      />
    </div>
  )
}

export const ProfileFieldsSkeleton = () => {
  return (
    <div className="space-y-4 pb-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between border-b border-divider py-4"
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

const PageSkeleton = () => {
  return (
    <div className="page-shell">
      <div className="border-b border-white/50 bg-white/45 px-4 py-6 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <div className="mx-auto mt-6 max-w-7xl">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-3 h-4 w-64" />
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="mt-8">
          <DebtGridSkeleton />
        </div>
      </main>
    </div>
  )
}

export default PageSkeleton
