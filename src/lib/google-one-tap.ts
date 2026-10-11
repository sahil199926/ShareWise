export const googleClientId = import.meta.env.GOOGLE_CLIENT_ID?.trim() ?? ''

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    context?: 'signin' | 'signup' | 'use'
    itp_support?: boolean
  }) => void
  prompt: () => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.googleIdentity = 'true'
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Google sign-in failed to load'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

export const promptGoogleOneTap = async (
  onCredential: (idToken: string) => void,
) => {
  if (!googleClientId) return false

  await loadGoogleIdentity()

  const identity = window.google?.accounts.id
  if (!identity) return false

  identity.initialize({
    client_id: googleClientId,
    callback: (response) => {
      if (response.credential) onCredential(response.credential)
    },
    auto_select: false,
    cancel_on_tap_outside: false,
    context: 'signin',
    itp_support: true,
  })

  identity.prompt()
  return true
}

export const cancelGoogleOneTap = () => {
  window.google?.accounts.id.cancel()
}
