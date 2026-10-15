export function handleSheetSyncRequest(
  body: unknown,
  env?: Record<string, string | undefined>,
  headers?: Record<string, string | string[] | undefined>,
): Promise<{ status: number; body: Record<string, unknown> }>
