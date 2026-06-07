export const formatShareAmount = (value: number) => {
  if (value === 0) return '0'

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export const formatParticipantBalance = (name: string, pending: number) => {
  if (pending < 0) {
    return `${name} gets ${formatShareAmount(Math.abs(pending))}`
  }

  if (pending > 0) {
    return `${name} will give ${formatShareAmount(pending)}`
  }

  return `${name} settled`
}

export const buildShareMetaDescription = (
  users: string[],
  pending: Record<string, number>,
  maxLength = 200,
) => {
  const parts = users.map((user) =>
    formatParticipantBalance(user, pending[user] ?? 0),
  )

  let description = parts.join(' · ')

  if (description.length <= maxLength) {
    return description
  }

  const compact = parts
    .slice(0, Math.max(2, users.length))
    .reduce((current, part) => {
      const next = current ? `${current} · ${part}` : part
      return next.length <= maxLength - 1 ? next : current
    }, '')

  return compact ? `${compact}…` : `${parts[0]}…`
}

export const buildShareMetaTitle = (sheetName: string) =>
  `${sheetName} — ShareWise`

export const buildShareCopyMessage = ({
  sheetName,
  shareUrl,
  users,
  pending,
  ownerName,
}: {
  sheetName: string
  shareUrl: string
  users: string[]
  pending: Record<string, number>
  ownerName?: string
}) => {
  const balanceLines = users.map((user) => {
    const amount = pending[user] ?? 0

    if (amount < 0) {
      return `• ${user} — Gets ${formatShareAmount(Math.abs(amount))}`
    }

    if (amount > 0) {
      return `• ${user} — Will give ${formatShareAmount(amount)}`
    }

    return `• ${user} — Settled`
  })

  const lines = [sheetName, shareUrl, '', 'Balances:', ...balanceLines]

  if (ownerName) {
    lines.push(
      '',
      `Note: Money transfer/receivable will be handled by ${ownerName}.`,
    )
  }

  return lines.join('\n')
}
