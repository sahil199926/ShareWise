export function isShareCrawler(userAgent: string | undefined): boolean

export function buildSharePreview(input: {
  token: string | undefined
  origin: string
  env: Record<string, string>
}): Promise<string>
