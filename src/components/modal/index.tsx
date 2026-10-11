import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

type ModalProps = {
  isOpen: boolean
  children: ReactNode
  panelClassName?: string
}

const OPEN_EASE = [0.22, 1, 0.36, 1] as const

const Modal = ({ isOpen, children, panelClassName = '' }: ModalProps) => {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`modal-panel ${panelClassName}`.trim()}
            initial={
              reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.32, ease: OPEN_EASE }
            }
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default Modal
