import { useEffect, useState } from 'react'

export const useCanHover = () => {
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  })

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')

    const handleChange = (event: MediaQueryListEvent) => {
      setCanHover(event.matches)
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return canHover
}
