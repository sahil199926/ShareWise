import { initializeApp, type FirebaseApp } from '@firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from '@firebase/auth'

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
let persistenceReady: Promise<void> | null = null

export const getFirebaseAuth = () => {
  if (!firebaseReady) {
    throw new Error(
      'Add the Firebase web app config to .env, then restart the app.',
    )
  }

  if (!auth) {
    const app: FirebaseApp = initializeApp(config)
    auth = getAuth(app)
    persistenceReady = setPersistence(auth, browserLocalPersistence)
  }

  return auth
}

export const signInWithGooglePopup = async () => {
  const firebaseAuth = getFirebaseAuth()
  await persistenceReady
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  return signInWithPopup(firebaseAuth, provider)
}

export const getFirebaseAccessToken = async () => {
  if (!firebaseReady) return null
  const firebaseAuth = getFirebaseAuth()
  await persistenceReady
  return firebaseAuth.currentUser?.getIdToken() ?? null
}

export const subscribeToFirebaseUser = (
  listener: (user: User | null) => void,
) => {
  const firebaseAuth = getFirebaseAuth()
  void persistenceReady?.catch(() => undefined)
  return onAuthStateChanged(firebaseAuth, listener)
}

export const signOutFromFirebase = async () => {
  if (!firebaseReady) return
  await signOut(getFirebaseAuth())
}
