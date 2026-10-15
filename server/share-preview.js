const CRAWLER =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot|Applebot|Pinterest|vkShare|W3C_Validator/i

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const rupee = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value) || 0)

export const isShareCrawler = (userAgent) =>
  CRAWLER.test(String(userAgent ?? ''))

const loadShared = async (env, token) => {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (!supabaseUrl || !supabaseKey || !token) return null
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_shared_debts`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
  })
  return response.ok ? response.json() : null
}

export const buildSharePreview = async ({ token, origin, env }) => {
  const shared = await loadShared(env, token)
  const person = shared?.person
  const debts = Array.isArray(shared?.debts) ? shared.debts : []
  let give = 0
  let receive = 0
  for (const debt of debts) {
    const amount = Number(debt.amount) || 0
    if (debt.debtor_id === person?.id) give += amount
    if (debt.creditor_id === person?.id) receive += amount
  }
  const title = person?.name
    ? `${person.name} · Karja Tracker`
    : 'Karja Tracker'
  const description = person?.name
    ? `${person.name} will give ${rupee(give)} and receive ${rupee(receive)} in open debts.`
    : 'This private share link is invalid or has expired.'
  const pageUrl = `${origin}/share/${encodeURIComponent(String(token ?? ''))}`
  const image = `${origin}/favicon.svg`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="Karja Tracker" />
<meta property="og:title" content="${escapeHtml(title)}" /><meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" /><meta property="og:image" content="${escapeHtml(image)}" />
<meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" /><meta name="twitter:image" content="${escapeHtml(image)}" />
<link rel="canonical" href="${escapeHtml(pageUrl)}" /></head>
<body><p>${escapeHtml(title)}</p><p>${escapeHtml(description)}</p></body></html>`
}
