import { useEffect, useRef } from 'react'

type ExpenseCommentTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const ExpenseCommentTextarea = ({
  value,
  onChange,
  placeholder,
}: ExpenseCommentTextareaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const element = ref.current
    if (!element) return

    element.style.height = 'auto'
    element.style.height = `${Math.max(element.scrollHeight, 36)}px`
  }

  useEffect(() => {
    resize()
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onInput={resize}
      className="expense-cell-textarea"
    />
  )
}

export default ExpenseCommentTextarea
