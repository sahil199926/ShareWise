const CRAWLER =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot|Applebot|Pinterest|vkShare|W3C_Validator/i

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const normalize = (email) =>
  String(email ?? '')
    .trim()
    .toLowerCase()

const rupee = (value) => {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

const debtWord = (count) => (count === 1 ? 'debt' : 'debts')

export const isShareCrawler = (userAgent) =>
  CRAWLER.test(String(userAgent ?? ''))

const decodeEmail = (value) => {
  let email = String(value ?? '').trim()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(email)
      if (next === email) break
      email = next
    } catch {
      break
    }
  }
  return normalize(email)
}

const emptyPerson = () => ({
  name: '',
  openOwe: 0,
  openReceive: 0,
  openOweCount: 0,
  openReceiveCount: 0,
})

const summarize = (debts, email, openOnly) => {
  const self = normalize(email)
  const person = emptyPerson()

  debts.forEach((debt) => {
    const debtor = normalize(debt.debtor_email)
    const creditor = normalize(debt.creditor_email)
    if (debtor !== self && creditor !== self) return

    if (debtor === self && debt.debtor_name)
      person.name = debt.debtor_name.trim()
    if (creditor === self && debt.creditor_name) {
      person.name = debt.creditor_name.trim()
    }

    const open = openOnly ? debt.status === 'open' : debt.status !== 'closed'
    if (!open) return

    const amount = Number(debt.amount) || 0
    if (debtor === self) {
      person.openOwe += amount
      person.openOweCount += 1
    }
    if (creditor === self) {
      person.openReceive += amount
      person.openReceiveCount += 1
    }
  })

  return person
}

export const shareCopy = (person, days) => {
  const name = person.name || 'This person'
  const title = `${name} · Karja Tracker`
  const give =
    person.openOweCount === 0
      ? `${name} has nothing left to give.`
      : `${name} will give ${rupee(person.openOwe)} across ${person.openOweCount} open ${debtWord(person.openOweCount)}.`
  const receive =
    person.openReceiveCount === 0
      ? 'Nothing is coming in.'
      : `Will get ${rupee(person.openReceive)} across ${person.openReceiveCount} open ${debtWord(person.openReceiveCount)}.`
  const summary = `${give} ${receive}`

  return {
    title,
    description: days ? `For the last ${days} days, ${summary}` : summary,
  }
}

const dayCount = (value) => {
  const count = Number(value)
  return [30, 60, 90, 180].includes(count) ? count : 30
}

const dayKey = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))

const recentKeys = (count) => {
  const keys = new Set()

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setUTCHours(12, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - offset)
    keys.add(dayKey(date.toISOString()))
  }

  return keys
}

const loadDebts = async (env) => {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (!supabaseUrl || !supabaseKey) return []

  const response = await fetch(
    `${supabaseUrl}/rest/v1/debts?select=debtor_email,debtor_name,creditor_email,creditor_name,amount,status,created_at`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  )

  if (!response.ok) return []
  const rows = await response.json()
  return Array.isArray(rows) ? rows : []
}

export const buildSharePreview = async ({ kind, email, origin, env, days }) => {
  const safeEmail = decodeEmail(email)
  const windowDays = kind === 'leaderboard' ? dayCount(days) : 0
  const debts = await loadDebts(env)
  const allowed = windowDays ? recentKeys(windowDays) : null
  const scoped = allowed
    ? debts.filter((debt) => allowed.has(dayKey(debt.created_at)))
    : debts
  const named = summarize(debts, safeEmail, kind === 'share')
  const person = summarize(scoped, safeEmail, kind === 'share')
  person.name = person.name || named.name
  const copy = person.name
    ? shareCopy(person, windowDays || undefined)
    : {
        title: 'Karja Tracker',
        description: 'Open karja for this person is not on the board yet.',
      }
  const pageUrl = `${origin}/${kind === 'share' ? 'share' : 'leaderboard'}/${encodeURIComponent(safeEmail)}`
  const image = `${origin}/favicon.svg`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escapeHtml(copy.title)}</title>
    <meta name="description" content="${escapeHtml(copy.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Karja Tracker" />
    <meta property="og:title" content="${escapeHtml(copy.title)}" />
    <meta property="og:description" content="${escapeHtml(copy.description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(copy.title)}" />
    <meta name="twitter:description" content="${escapeHtml(copy.description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  </head>
  <body>
    <p>${escapeHtml(copy.title)}</p>
    <p>${escapeHtml(copy.description)}</p>
  </body>
</html>`
}
