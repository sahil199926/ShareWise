export function isShareCrawler(userAgent: string | undefined): boolean

export function buildSharePreview(input: {
  kind: 'leaderboard' | 'share'
  email: string | undefined
  origin: string
  env: Record<string, string>
}): Promise<string>
