export type MasterUser = {
  rowId: number
  name: string
  email: string
  password: string
  type: string
  age: number | null
  score: number | null
}

export type MasterUserInput = {
  name: string
  email: string
  password: string
  type: string
  age: number | null
  score: number | null
}
