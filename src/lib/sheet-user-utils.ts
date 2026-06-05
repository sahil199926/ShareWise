export const findSheetUserName = (
  sheetUsers: string[],
  authUserName: string,
): string | null => {
  const normalized = authUserName.trim().toLowerCase()

  return (
    sheetUsers.find((user) => user.trim().toLowerCase() === normalized) ?? null
  )
}
