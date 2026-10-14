import {
  EXPENSE_SPLIT_METHOD,
  type ExpenseCalculation,
  type ExpenseCalculationInput,
  type ExpensePerson,
} from '../types/expense'

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/
const PERCENT_PATTERN = /^\d+(?:\.\d{1,2})?$/

const parseScaledNumber = (value: string, scale: number, pattern: RegExp) => {
  const normalized = value.trim()
  if (!pattern.test(normalized)) return null

  const [whole, fraction = ''] = normalized.split('.')
  const fractionDigits = String(scale).length - 1
  const padded = fraction.padEnd(fractionDigits, '0')
  const result = Number(whole) * scale + Number(padded || 0)

  return Number.isSafeInteger(result) ? result : null
}

export const moneyToPaise = (value: string) =>
  parseScaledNumber(value, 100, MONEY_PATTERN)

const MONEY_DRAFT = /^\d*\.?\d{0,2}$/

const draftMoneyPaise = (value: string) => {
  const raw = value.trim()
  if (raw === '' || raw === '.') return 0
  const body = raw.endsWith('.') ? raw.slice(0, -1) : raw
  if (!body) return 0
  return moneyToPaise(body)
}

export const fitsMoneyCap = (
  people: ExpensePerson[],
  values: Record<string, string>,
  personId: string,
  nextValue: string,
  capRupees: number,
) => {
  const raw = nextValue.trim()
  if (raw !== '' && !MONEY_DRAFT.test(raw)) return false

  const nextPaise = draftMoneyPaise(raw)
  if (nextPaise === null) return false

  const capPaise = Math.round(capRupees * 100)
  const currentRaw = (values[personId] ?? '').trim()
  const currentPaise = draftMoneyPaise(currentRaw) ?? 0
  const others = people.reduce((sum, person) => {
    if (person.id === personId) return sum
    const current = draftMoneyPaise(values[person.id] ?? '')
    return sum + (current ?? 0)
  }, 0)

  if (others + nextPaise > capPaise) return false

  const alreadyFull = others + currentPaise >= capPaise
  if (
    alreadyFull &&
    nextPaise >= currentPaise &&
    raw.length > currentRaw.length
  ) {
    return false
  }

  return true
}

const percentageToBasisPoints = (value: string) =>
  parseScaledNumber(value, 100, PERCENT_PATTERN)

const rupees = (paise: number) => paise / 100

const amountMap = (people: ExpensePerson[], values: number[]) =>
  Object.fromEntries(
    people.map((person, index) => [person.id, rupees(values[index])]),
  )

const allocateEqualShares = (totalPaise: number, count: number) => {
  const base = Math.floor(totalPaise / count)
  const remainder = totalPaise - base * count

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  )
}

const allocatePercentageShares = (
  totalPaise: number,
  percentages: number[],
) => {
  const raw = percentages.map((percentage) => totalPaise * percentage)
  const shares = raw.map((value) => Math.floor(value / 10_000))
  const remainder = totalPaise - shares.reduce((sum, value) => sum + value, 0)

  const remainderOrder = raw
    .map((value, index) => ({ index, fraction: value % 10_000 }))
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    )

  for (let index = 0; index < remainder; index += 1) {
    shares[remainderOrder[index].index] += 1
  }

  return shares
}

const readMoneyValues = (
  people: ExpensePerson[],
  values: Record<string, string>,
  label: string,
) => {
  return people.map((person) => {
    const raw = values[person.id]?.trim() || '0'
    const parsed = moneyToPaise(raw)
    if (parsed === null) {
      throw new Error(
        `${label} for ${person.name} must use at most 2 decimals.`,
      )
    }
    return parsed
  })
}

export const calculateExpense = ({
  total,
  people,
  paidAmounts,
  splitMethod,
  splitValues,
}: ExpenseCalculationInput): ExpenseCalculation => {
  const totalPaise = moneyToPaise(total)
  if (totalPaise === null || totalPaise <= 0) {
    throw new Error('Enter an expense amount greater than ₹0.')
  }
  if (people.length < 2) {
    throw new Error('Select at least 2 people involved in this expense.')
  }

  const paidPaise = readMoneyValues(people, paidAmounts, 'Payment')
  const paidTotal = paidPaise.reduce((sum, value) => sum + value, 0)
  if (paidTotal !== totalPaise) {
    throw new Error(
      `Payments must add up to ₹${rupees(totalPaise).toFixed(2)}.`,
    )
  }

  let owedPaise: number[]

  if (splitMethod === EXPENSE_SPLIT_METHOD.EQUAL) {
    owedPaise = allocateEqualShares(totalPaise, people.length)
  } else if (splitMethod === EXPENSE_SPLIT_METHOD.AMOUNT) {
    owedPaise = readMoneyValues(people, splitValues, 'Share')
    const shareTotal = owedPaise.reduce((sum, value) => sum + value, 0)
    if (shareTotal !== totalPaise) {
      throw new Error(
        `Split amounts must add up to ₹${rupees(totalPaise).toFixed(2)}.`,
      )
    }
  } else {
    const percentages = people.map((person) => {
      const raw = splitValues[person.id]?.trim() || '0'
      const parsed = percentageToBasisPoints(raw)
      if (parsed === null) {
        throw new Error(
          `Percentage for ${person.name} must use at most 2 decimals.`,
        )
      }
      return parsed
    })
    const percentageTotal = percentages.reduce((sum, value) => sum + value, 0)
    if (percentageTotal !== 10_000) {
      throw new Error('Split percentages must add up to exactly 100%.')
    }
    owedPaise = allocatePercentageShares(totalPaise, percentages)
  }

  const receivers: Array<{ index: number; amount: number }> = []
  const debtors: Array<{ index: number; amount: number }> = []

  people.forEach((_person, index) => {
    const balance = paidPaise[index] - owedPaise[index]
    if (balance > 0) receivers.push({ index, amount: balance })
    if (balance < 0) debtors.push({ index, amount: Math.abs(balance) })
  })

  const debts: ExpenseCalculation['debts'] = []
  let debtorIndex = 0
  let receiverIndex = 0

  while (debtorIndex < debtors.length && receiverIndex < receivers.length) {
    const debtor = debtors[debtorIndex]
    const receiver = receivers[receiverIndex]
    const amount = Math.min(debtor.amount, receiver.amount)
    const debtorPerson = people[debtor.index]
    const creditorPerson = people[receiver.index]

    if (amount > 0) {
      debts.push({
        debtorId: debtorPerson.id,
        debtorName: debtorPerson.name,
        debtorEmail: debtorPerson.email,
        creditorId: creditorPerson.id,
        creditorName: creditorPerson.name,
        creditorEmail: creditorPerson.email,
        amount: rupees(amount),
      })
    }

    debtor.amount -= amount
    receiver.amount -= amount
    if (debtor.amount === 0) debtorIndex += 1
    if (receiver.amount === 0) receiverIndex += 1
  }

  return {
    totalAmount: rupees(totalPaise),
    paidAmounts: amountMap(people, paidPaise),
    owedAmounts: amountMap(people, owedPaise),
    debts,
  }
}
