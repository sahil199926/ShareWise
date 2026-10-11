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

export const shareCopy = (person) => {
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

  return {
    title,
    description: `${give} ${receive}`,
  }
}

const loadDebts = async (env) => {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (!supabaseUrl || !supabaseKey) return []

  const response = await fetch(
    `${supabaseUrl}/rest/v1/debts?select=debtor_email,debtor_name,creditor_email,creditor_name,amount,status`,
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

export const buildSharePreview = async ({ kind, email, origin, env }) => {
  const safeEmail = decodeEmail(email)
  const debts = await loadDebts(env)
  const person = summarize(debts, safeEmail, kind === 'share')
  const copy = person.name
    ? shareCopy(person)
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
