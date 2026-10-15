import { useState } from 'react'

type AvatarProps = {
  name: string
  avatarUrl?: string | null
  className?: string
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const Avatar = ({ name, avatarUrl, className = '' }: AvatarProps) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`avatar-photo ${className}`}
        onError={() => setFailedUrl(avatarUrl)}
      />
    )
  }

  return <span className={`avatar-ring ${className}`}>{getInitials(name)}</span>
}

export default Avatar
