import { motion } from 'motion/react'

const STRIPS = [
  '#14532d',
  '#166534',
  '#15803d',
  '#22c55e',
  '#15803d',
  '#166534',
  '#14532d',
  '#052e16',
] as const

type BlindsTransitionProps = {
  phase: 'cover' | 'reveal'
}

const BlindsTransition = ({ phase }: BlindsTransitionProps) => {
  const isCovering = phase === 'cover'

  return (
    <div
      className={`fixed inset-0 z-[80] flex ${
        isCovering ? '' : 'pointer-events-none'
      }`}
      aria-hidden="true"
    >
      {STRIPS.map((color, index) => (
        <motion.div
          key={color + index}
          className="h-full flex-1"
          initial={false}
          animate={{
            scaleY: isCovering ? 1 : 0,
            originY: isCovering ? 0 : 1,
          }}
          transition={{
            duration: 0.45,
            delay: index * 0.035,
            ease: [0.76, 0, 0.24, 1],
          }}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

export const BLINDS_COVER_MS = 450 + STRIPS.length * 35

export default BlindsTransition
