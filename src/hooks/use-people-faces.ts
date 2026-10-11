import { useEffect, useState } from 'react'
import { listLeaderboardFaces } from '../services/users.service'

export const usePeopleFaces = (emails: string[]) => {
  const key = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ]
    .sort()
    .join('\n')
  const [faces, setFaces] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!key) return

    let cancelled = false

    listLeaderboardFaces(key.split('\n'))
      .then((next) => {
        if (!cancelled) setFaces(next)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [key])

  return faces
}
