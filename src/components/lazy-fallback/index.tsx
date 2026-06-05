import Logo from '../logo'

const LazyFallback = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-app">
      <Logo size="lg" />
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-divider border-t-brand" />
    </div>
  )
}

export default LazyFallback
