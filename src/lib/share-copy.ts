import { formatRupee } from './debt-utils'

type ShareTotals = {
  name: string
  openOwe: number
  openReceive: number
  openOweCount: number
  openReceiveCount: number
}

const debtWord = (count: number) => (count === 1 ? 'debt' : 'debts')

export const shareCopy = (person: ShareTotals) => {
  const name = person.name || 'This person'
  const title = `${name} · Karja Tracker`
  const give =
    person.openOweCount === 0
      ? `${name} has nothing left to give.`
      : `${name} will give ${formatRupee(person.openOwe)} across ${person.openOweCount} open ${debtWord(person.openOweCount)}.`
  const receive =
    person.openReceiveCount === 0
      ? 'Nothing is coming in.'
      : `Will get ${formatRupee(person.openReceive)} across ${person.openReceiveCount} open ${debtWord(person.openReceiveCount)}.`

  return {
    title,
    description: `${give} ${receive}`,
  }
}

export const setShareMeta = (title: string, description: string) => {
  const previousTitle = document.title
  const meta = document.querySelector('meta[name="description"]')
  const previousDescription = meta?.getAttribute('content') ?? ''

  document.title = title
  meta?.setAttribute('content', description)

  return () => {
    document.title = previousTitle
    meta?.setAttribute('content', previousDescription)
  }
}
