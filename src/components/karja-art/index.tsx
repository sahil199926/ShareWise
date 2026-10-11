import { motion } from 'motion/react'

const float = {
  y: [0, -10, 0],
  transition: {
    duration: 4.2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
}

type KarjaArtProps = {
  className?: string
}

const KarjaArt = ({ className = '' }: KarjaArtProps) => {
  return (
    <motion.svg
      viewBox="0 0 360 320"
      className={className}
      role="img"
      aria-label="Karja illustration"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <defs>
        <linearGradient id="karja-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="karja-note" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dcfce7" />
        </linearGradient>
      </defs>

      <motion.ellipse
        cx="180"
        cy="250"
        rx="110"
        ry="18"
        fill="#166534"
        opacity="0.12"
        animate={{ scaleX: [1, 0.92, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {Array.from({ length: 6 }).map((_, index) => (
        <motion.rect
          key={index}
          x={46 + index * 46}
          y="36"
          width="28"
          height="92"
          rx="10"
          fill={index % 2 === 0 ? '#166534' : '#22c55e'}
          opacity={0.9}
          style={{ transformBox: 'fill-box', transformOrigin: 'top center' }}
          animate={{ scaleY: [0.72, 1, 0.72] }}
          transition={{
            duration: 2.8,
            delay: index * 0.12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      <motion.g animate={float}>
        <rect
          x="78"
          y="148"
          width="150"
          height="96"
          rx="18"
          fill="url(#karja-note)"
          stroke="#86efac"
        />
        <rect x="96" y="168" width="78" height="8" rx="4" fill="#bbf7d0" />
        <rect x="96" y="186" width="112" height="8" rx="4" fill="#dcfce7" />
        <rect x="96" y="204" width="64" height="8" rx="4" fill="#bbf7d0" />
      </motion.g>

      <motion.g
        animate={{
          y: [8, -6, 8],
          rotate: [-6, 6, -6],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '250px 186px', transformBox: 'fill-box' }}
      >
        <circle cx="250" cy="186" r="58" fill="url(#karja-coin)" />
        <circle
          cx="250"
          cy="186"
          r="46"
          fill="none"
          stroke="#bbf7d0"
          strokeWidth="3"
        />
        <text
          x="250"
          y="198"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="42"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
        >
          ₹
        </text>
      </motion.g>

      <motion.circle
        cx="64"
        cy="210"
        r="8"
        fill="#4ade80"
        animate={{ y: [0, -14, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="308"
        cy="132"
        r="6"
        fill="#86efac"
        animate={{ y: [0, 12, 0], opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 3.6,
          delay: 0.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.svg>
  )
}

export default KarjaArt
