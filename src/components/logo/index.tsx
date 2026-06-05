import { Link } from 'react-router-dom'
import { APP_NAME, LOGO_ALT, LOGO_SRC } from '../../constants/brand'

type LogoSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
}

type LogoProps = {
  size?: LogoSize
  showName?: boolean
  linkTo?: string
  className?: string
}

const Logo = ({
  size = 'md',
  showName = true,
  linkTo,
  className = '',
}: LogoProps) => {
  const content = (
    <>
      <img
        src={LOGO_SRC}
        alt={LOGO_ALT}
        className={`${SIZE_CLASSES[size]} shrink-0 rounded-lg object-contain`}
      />
      {showName ? (
        <span className="text-base font-semibold tracking-tight text-high sm:text-lg">
          {APP_NAME}
        </span>
      ) : null}
    </>
  )

  const wrapperClass = `inline-flex items-center gap-2.5 ${className}`.trim()

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className={`${wrapperClass} transition hover:opacity-90`}
      >
        {content}
      </Link>
    )
  }

  return <div className={wrapperClass}>{content}</div>
}

export default Logo
