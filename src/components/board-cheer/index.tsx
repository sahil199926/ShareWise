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
    { emoji: '😍', label: 'Paying early? So damn hot' },
    { emoji: '🤩', label: 'Generosity looks sexy on you' },
    { emoji: '🤑', label: 'Rich and generous… dangerous combo' },
    { emoji: '😆', label: 'OMG you overpay like a boss' },
    { emoji: '💚', label: 'Your wallet has main character energy' },
    { emoji: '😘', label: 'Most generous and most tempting' },
    { emoji: '🥳', label: 'Always tipping more… keep spoiling us' },
    { emoji: '😊', label: 'Love how you never hold back' },
    { emoji: '🔥', label: 'Paying in advance? Instantly hotter' },
    { emoji: '💅', label: 'Big tipper energy. Respect.' },
    { emoji: '🫦', label: 'Generosity this thick should be illegal' },
    { emoji: '😉', label: 'You give extra… and I notice' },
    { emoji: '💋', label: 'Spoiling friends never looked this good' },
    { emoji: '😏', label: 'Always overpaying. My favorite type' },
    { emoji: '✨', label: 'Rich, kind, and dangerously attractive' },
    { emoji: '🥵', label: 'Early payments make me weak' },
    { emoji: '😈', label: 'Too generous… it’s almost unfair' },
    { emoji: '🖤', label: 'Wallet this open should come with a warning' },
    { emoji: '💥', label: 'You drop cash like it’s nothing. Hot.' },
    { emoji: '🫶', label: 'Giving more just hits different' },
    { emoji: '😌', label: 'Quietly overpaying… sexy as hell' },
    { emoji: '🌶️', label: 'Spicy levels of generosity' },
    { emoji: '💫', label: 'You make being rich look irresistible' },
    { emoji: '🥂', label: 'Cheers to the one who always covers more' },
    { emoji: '👑', label: 'King/Queen of overpaying. Bow down.' },
    { emoji: '💸', label: 'Money leaves you faster than my self-control' },
    { emoji: '👀', label: 'Watching you tip big is a whole mood' },
    { emoji: '🫠', label: 'Melting over how freely you give' },
    { emoji: '💖', label: 'Generous hearts are my weakness' },
    { emoji: '🔥', label: 'Paying first and paying more? Obsessed.' },
    { emoji: '😋', label: 'That advance payment hit different' },
    { emoji: '🫦', label: 'Keep spoiling. I like it.' },
    { emoji: '😉', label: 'You never shortchange… in any way' },
    { emoji: '✨', label: 'Luxury generosity. My favorite kink.' },
    { emoji: '😈', label: 'Too rich and too kind. Dangerous.' },
    { emoji: '💕', label: 'Your wallet has no chill and I love it' },
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
    { emoji: '🪦', label: 'RIP to your integrity' },
    { emoji: '🤡', label: 'Clown with my money' },
    { emoji: '🚩', label: 'Broke red flag' },
    { emoji: '🫠', label: 'My money is melting' },
    { emoji: '🔔', label: 'Daily freeloader alert' },
    { emoji: '📢', label: 'PAY ME, DEADBEAT' },
    { emoji: '🧠', label: 'Remember the loan, parasite?' },
    { emoji: '🦥', label: 'Slowest payer alive' },
    { emoji: '🎭', label: 'CEO of excuses' },
    { emoji: '🏃', label: 'Running from the debt' },
    { emoji: '🫡', label: 'Salute to your audacity' },
    { emoji: '🕵️', label: 'Still hunting my money' },
    { emoji: '📉', label: 'Friendship crashing hard' },
    { emoji: '💀', label: 'Thought it was a donation?' },
    { emoji: '🤝', label: 'Deal is dead' },
    { emoji: '📅', label: 'Another day, another excuse' },
    { emoji: '🧾', label: 'Receipts never forget' },
    { emoji: '🐸', label: 'Hop back with my cash' },
    { emoji: '🛌', label: 'Sleeping on my money' },
    { emoji: '🎪', label: 'Excuse circus star' },
    { emoji: '🥷', label: 'Ninja after borrowing' },
    { emoji: '🫥', label: 'Online, never paying' },
    { emoji: '🧛', label: 'Wallet vampire' },
    { emoji: '⚰️', label: 'Friendship is dead' },
    { emoji: '🔍', label: 'Last seen: my money' },
    { emoji: '📞', label: 'Lender wants a word' },
    { emoji: '🧍', label: 'Still waiting, trash' },
    { emoji: '🤑', label: 'My money looks good on you' },
    { emoji: '🧊', label: 'Colder than your replies' },
    { emoji: '🪤', label: 'Caught in debt trap' },
    { emoji: '👻', label: 'Ghosting with my cash' },
    { emoji: '🥇', label: 'Gold in dodging payments' },
    { emoji: '🧮', label: 'Math says you still owe' },
    { emoji: '💅', label: 'Pay me. Now.' },
    { emoji: '🙏', label: 'Universe, return my money' },
    { emoji: '🚨', label: 'Payment emergency' },
    { emoji: '🤏', label: 'Even a little would help' },
    { emoji: '📍', label: 'Excuses stop here' },
    { emoji: '🐢', label: 'Repayment loading forever' },
    { emoji: '🍿', label: 'Waiting for the payment' },
    { emoji: '🪙', label: 'Spare change misses me' },
    { emoji: '😏', label: 'Nice spending my money' },
    { emoji: '📜', label: 'Debt lore continues' },
    { emoji: '🔒', label: 'Trust revoked' },
    { emoji: '👑', label: 'King of unpaid balances' },
    { emoji: '🧨', label: 'Patience at 0%' },
    { emoji: '🎤', label: 'Less talk, more transfer' },
    { emoji: '💳', label: 'Excuses rejected' },
    { emoji: '🪄', label: 'Make my money reappear' },
    { emoji: '🏆', label: 'Champ of “tomorrow”' },
  ],
}

const WORD: Record<BoardId, string> = {
  receivers: 'text-[#15803d]',
  contributors: 'text-[#166534]',
  owed: 'text-[#4338ca]',
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
      const displayDuration =
        Math.min(
          4.2,
          2.1 + Math.max(0, (cheer.label?.length ?? 0) - 10) * 0.065,
        ) + randomBetween(0, 0.3)

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
          duration: displayDuration,
        },
      ])

      timer = setTimeout(
        popCheer,
        displayDuration * 1000 + randomBetween(450, 1200),
      )
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
              <span
                className={`text-xs font-semibold sm:text-sm ${WORD[board]}`}
              >
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
