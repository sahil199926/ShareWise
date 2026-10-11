export function handleNotifyRequest(
  body: unknown,
  env?: NodeJS.ProcessEnv,
): Promise<{ status: number; body: { error?: string; sent?: number } }>
