import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { BoardId } from '../../lib/leaderboard'

type Cheer = {
  emoji: string
  label?: string
}

type FloatingCheer = Cheer & {
  id: number
  left: number
  top: number
  driftX: number
  driftY: number
  rotation: number
  duration: number
}

const CHEERS: Record<BoardId, Cheer[]> = {
  receivers: [
    { emoji: '😍' },
    { emoji: '🤩', label: 'You are great' },
    { emoji: '🤑' },
    { emoji: '😆', label: 'OMG' },
    { emoji: '💚' },
    { emoji: '😘', label: 'Most rich' },
    { emoji: '🥳' },
    { emoji: '😊', label: 'Love' },
  ],
  contributors: [
    { emoji: '😎' },
    { emoji: '🙏', label: 'Thank you' },
    { emoji: '👏' },
    { emoji: '😁', label: 'Legend' },
    { emoji: '😇' },
    { emoji: '🤝', label: 'Paid back' },
    { emoji: '💚' },
  ],
  owed: [
    { emoji: '🙄', label: 'Still waiting...' },
    { emoji: '👀', label: 'Seen the reminder?' },
    { emoji: '💸', label: 'Money has left the chat' },
    { emoji: '⏳', label: 'Any day now...' },
    { emoji: '🥱', label: 'This debt is getting old' },
    { emoji: '😈', label: 'Professional borrower' },
    { emoji: '🐌', label: 'Slowest payment ever' },
  ],
}

const WORD: Record<BoardId, string> = {
  receivers: 'text-[#15803d]',
  contributors: 'text-[#166534]',
  owed: 'text-[#c2410c]',
}

type BoardCheerProps = {
  board: BoardId
}

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min)

const BoardCheer = ({ board }: BoardCheerProps) => {
  const reduce = useReducedMotion()
  const [floatingCheers, setFloatingCheers] = useState<FloatingCheer[]>([])

  useEffect(() => {
    if (reduce) return

    let nextId = 0
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false

    const popCheer = () => {
      if (cancelled) return

      const cheer =
        CHEERS[board][Math.floor(Math.random() * CHEERS[board].length)]
      const id = nextId++

      setFloatingCheers((current) => [
        ...current,
        {
          ...cheer,
          id,
          left: randomBetween(4, 84),
          top: randomBetween(5, 91),
          driftX: randomBetween(-38, 38),
          driftY: randomBetween(-48, 36),
          rotation: randomBetween(-16, 16),
          duration: randomBetween(1.9, 2.8),
        },
      ])

      timer = setTimeout(popCheer, randomBetween(700, 1900))
    }

    timer = setTimeout(popCheer, randomBetween(300, 1100))

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [board, reduce])

  if (reduce) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden
    >
      <AnimatePresence>
        {floatingCheers.map((item) => (
          <motion.span
            key={item.id}
            className="absolute inline-flex items-center gap-1.5 whitespace-nowrap"
            style={{ left: `${item.left}%`, top: `${item.top}%` }}
            initial={{ opacity: 0, scale: 0.25, x: 0, y: 8, rotate: 0 }}
            animate={{
              opacity: [0, 1, 0.95, 0],
              scale: [0.25, 1.18, 1, 0.85],
              x: [0, item.driftX * 0.2, item.driftX * 0.7, item.driftX],
              y: [8, item.driftY * 0.25, item.driftY * 0.65, item.driftY],
              rotate: [
                0,
                item.rotation * 0.2,
                item.rotation * 0.65,
                item.rotation,
              ],
            }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{
              duration: item.duration,
              ease: ['easeOut', 'easeInOut', 'easeIn'],
              times: [0, 0.18, 0.72, 1],
            }}
            onAnimationComplete={() => {
              setFloatingCheers((current) =>
                current.filter((cheer) => cheer.id !== item.id),
              )
            }}
          >
            <span className="text-3xl leading-none drop-shadow-sm">
              {item.emoji}
            </span>
            {item.label ? (
              <span className={`text-sm font-semibold ${WORD[board]}`}>
                {item.label}
              </span>
            ) : null}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default BoardCheer
