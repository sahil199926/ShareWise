import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from 'motion/react'

type ModalProps = {
  isOpen: boolean
  children: ReactNode
  panelClassName?: string
  overlayClassName?: string
  variant?: 'dialog' | 'responsive-sheet'
  onClose?: () => void
}

const OPEN_EASE = [0.22, 1, 0.36, 1] as const
const MOBILE_QUERY = '(max-width: 639px)'

const subscribeToMobile = (onChange: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches
const getServerMobileSnapshot = () => false

const Modal = ({
  isOpen,
  children,
  panelClassName = '',
  overlayClassName = '',
  variant = 'responsive-sheet',
  onClose,
}: ModalProps) => {
  const reduceMotion = useReducedMotion()
  const dragControls = useDragControls()
  const isMobile = useSyncExternalStore(
    subscribeToMobile,
    getMobileSnapshot,
    getServerMobileSnapshot,
  )
  const isSheet = variant === 'responsive-sheet' && isMobile

  const finishDrag = (_event: PointerEvent, info: PanInfo) => {
    if (!isSheet || !onClose) return
    if (info.offset.y > 96 || info.velocity.y > 650) onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={`modal-overlay ${isSheet ? 'modal-overlay-sheet' : ''} ${overlayClassName}`.trim()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`modal-panel ${isSheet ? 'modal-panel-sheet' : ''} ${panelClassName}`.trim()}
            drag={isSheet ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.72 }}
            onDragEnd={finishDrag}
            initial={
              reduceMotion
                ? { opacity: 1 }
                : isSheet
                  ? { opacity: 1, y: '100%' }
                  : { opacity: 0, y: 16, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : isSheet
                  ? { opacity: 1, y: '100%' }
                  : { opacity: 0, y: 10, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: isSheet ? 0.38 : 0.32, ease: OPEN_EASE }
            }
          >
            {isSheet ? (
              <button
                type="button"
                className="modal-drawer-handle-zone"
                aria-label="Drag down to close"
                onPointerDown={(event) => dragControls.start(event)}
                onClick={onClose}
              >
                <span className="modal-drawer-handle" aria-hidden="true" />
              </button>
            ) : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default Modal
