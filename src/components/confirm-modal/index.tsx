import { useEffect, useRef } from 'react'
import Modal from '../modal'

type ConfirmModalProps = {
  isOpen: boolean
  title?: string
  message: string
  confirmLabel?: string
  isConfirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

const ConfirmModal = ({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!isOpen) return

    cancelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) onCancelRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isConfirming, isOpen])

  return (
    <Modal isOpen={isOpen}>
      <h2 className="text-lg font-semibold text-high">{title}</h2>
      <p className="mt-2 text-sm text-medium">{message}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={isConfirming}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-danger px-5 py-2 text-sm"
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? 'Deleting...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default ConfirmModal
