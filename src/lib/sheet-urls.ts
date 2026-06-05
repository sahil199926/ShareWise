export const getShareSheetPath = (id: string) => `/share-sheet/${id}`

export const getEditSheetPath = (id: string) => `/edit-sheet/${id}`

export const getShareSheetUrl = (id: string) => {
  if (typeof window === 'undefined') {
    return getShareSheetPath(id)
  }

  return `${window.location.origin}${getShareSheetPath(id)}`
}
