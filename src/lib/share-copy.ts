import { formatRupee } from './debt-utils'

type ShareTotals = {
  name: string
  openOwe: number
  openReceive: number
  openOweCount: number
  openReceiveCount: number
}

const debtWord = (count: number) => (count === 1 ? 'debt' : 'debts')

export const shareCopy = (person: ShareTotals, days?: number) => {
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
  const summary = `${give} ${receive}`

  return {
    title,
    description: days ? `For the last ${days} days, ${summary}` : summary,
  }
}

export const setShareMeta = (title: string, description: string) => {
  const previousTitle = document.title
  const meta = document.querySelector('meta[name="description"]')
  const ogTitle = document.querySelector('meta[property="og:title"]')
  const ogDescription = document.querySelector(
    'meta[property="og:description"]',
  )
  const twitterTitle = document.querySelector('meta[name="twitter:title"]')
  const twitterDescription = document.querySelector(
    'meta[name="twitter:description"]',
  )
  const previous = {
    description: meta?.getAttribute('content') ?? '',
    ogTitle: ogTitle?.getAttribute('content') ?? '',
    ogDescription: ogDescription?.getAttribute('content') ?? '',
    twitterTitle: twitterTitle?.getAttribute('content') ?? '',
    twitterDescription: twitterDescription?.getAttribute('content') ?? '',
  }

  document.title = title
  meta?.setAttribute('content', description)
  ogTitle?.setAttribute('content', title)
  ogDescription?.setAttribute('content', description)
  twitterTitle?.setAttribute('content', title)
  twitterDescription?.setAttribute('content', description)

  return () => {
    document.title = previousTitle
    meta?.setAttribute('content', previous.description)
    ogTitle?.setAttribute('content', previous.ogTitle)
    ogDescription?.setAttribute('content', previous.ogDescription)
    twitterTitle?.setAttribute('content', previous.twitterTitle)
    twitterDescription?.setAttribute('content', previous.twitterDescription)
  }
}
