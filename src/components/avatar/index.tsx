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
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`avatar-photo ${className}`}
      />
    )
  }

  return (
    <span className={`avatar-ring ${className}`}>{getInitials(name)}</span>
  )
}

export default Avatar
