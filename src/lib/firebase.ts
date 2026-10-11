import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? '',
}

export const firebaseReady = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
)

let auth: Auth | null = null

const getFirebaseAuth = () => {
  if (!firebaseReady) {
    throw new Error(
      'Add the Firebase web app config to .env, then restart the app.',
    )
  }

  if (!auth) {
    const app: FirebaseApp = initializeApp(config)
    auth = getAuth(app)
  }

  return auth
}

export const signInWithGooglePopup = async () => {
  const firebaseAuth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  const result = await signInWithPopup(firebaseAuth, provider)
  const email = result.user.email?.trim().toLowerCase() ?? ''
  const googleId =
    result.user.providerData.find((item) => item.providerId === 'google.com')
      ?.uid ?? result.user.uid

  await signOut(firebaseAuth).catch(() => undefined)

  if (!email || !googleId) {
    throw new Error('Google did not return an account')
  }

  return { email, googleId }
}
