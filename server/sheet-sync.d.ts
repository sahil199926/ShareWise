export function handleSheetSyncRequest(
  body: unknown,
  env?: Record<string, string | undefined>,
): Promise<{ status: number; body: Record<string, unknown> }>
