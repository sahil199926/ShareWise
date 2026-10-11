import { Link } from 'react-router-dom'
import { APP_NAME } from '../../constants/brand'

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

const KarjaMark = ({ className }: { className: string }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="14" fill="#14532d" />
      <circle cx="24" cy="24" r="15" fill="#16a34a" />
      <circle
        cx="24"
        cy="24"
        r="12.25"
        fill="none"
        stroke="#fde68a"
        strokeWidth="1.4"
      />
      <path
        d="M16.8 16.2h14.6M16.8 20.4h12.6M21 16.2v6.1c0 3.5 2.5 5.4 7.4 5M18.2 26.8 30.6 35.6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const Logo = ({
  size = 'md',
  showName = true,
  linkTo,
  className = '',
}: LogoProps) => {
  const content = (
    <>
      <KarjaMark className={SIZE_CLASSES[size]} />
      {showName ? (
        <span className="text-base font-semibold tracking-tight text-high sm:text-lg">
          {APP_NAME}
        </span>
      ) : null}
    </>
  )

  const wrapperClass =
    `inline-flex min-w-0 items-center gap-2.5 ${className}`.trim()

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className={`${wrapperClass} transition hover:opacity-90`}
        aria-label={APP_NAME}
      >
        {content}
      </Link>
    )
  }

  return <div className={wrapperClass}>{content}</div>
}

export default Logo
