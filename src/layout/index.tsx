import { useEffect, useState } from 'react'
import { useLocation, useRoutes } from 'react-router-dom'
import { motion } from 'motion/react'
import BlindsTransition, {
  BLINDS_COVER_MS,
} from '../components/blinds-transition'
import { routes } from '../routes'

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const Layout = () => {
  const location = useLocation()
  const [shown, setShown] = useState(location)
  const [blindsPhase, setBlindsPhase] = useState<'cover' | 'reveal' | null>(
    null,
  )
  const element = useRoutes(routes, shown)

  useEffect(() => {
    if (location.key === shown.key) return

    if (location.pathname === shown.pathname || prefersReducedMotion()) {
      const timer = window.setTimeout(() => setShown(location), 0)
      return () => window.clearTimeout(timer)
    }

    const coverTimer = window.setTimeout(() => setBlindsPhase('cover'), 0)
    const timer = window.setTimeout(() => {
      setShown(location)
      setBlindsPhase('reveal')
    }, BLINDS_COVER_MS)

    return () => {
      window.clearTimeout(coverTimer)
      window.clearTimeout(timer)
    }
  }, [location, shown.key, shown.pathname])

  return (
    <div className="min-h-screen">
      <motion.div
        key={shown.pathname}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        {element}
      </motion.div>
      {blindsPhase ? <BlindsTransition phase={blindsPhase} /> : null}
    </div>
  )
}

export default Layout
