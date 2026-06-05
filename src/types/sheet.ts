export type SheetItem = {
  id: string
  name: string
  ownerEmail: string
  ownerName: string
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type SheetListResult = {
  sheets: SheetItem[]
  pagination: PaginationMeta
}

export type MasterUserOption = {
  name: string
  email: string
}

export type CreateSheetInput = {
  name: string
  users: string[]
  items: string[]
}
