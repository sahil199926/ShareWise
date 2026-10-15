import { useEffect, useState } from 'react'
import { listLeaderboardFaces } from '../services/users.service'
import { useAuth } from './use-auth'

export const usePeopleFaces = (emails: string[]) => {
  const { activeGroup } = useAuth()
  const key = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ]
    .sort()
    .join('\n')
  const [faces, setFaces] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!key || !activeGroup) return

    let cancelled = false

    listLeaderboardFaces(activeGroup.id, key.split('\n'))
      .then((next) => {
        if (!cancelled) setFaces(next)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [activeGroup, key])

  return faces
}
