import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.API_URL ?? 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})
