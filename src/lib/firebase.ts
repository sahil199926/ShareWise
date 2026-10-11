import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
  type UserCredential,
} from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: import.meta.env.FIREBASE_PROJECT_ID?.trim() ?? '',
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET?.trim() ?? '',
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: import.meta.env.FIREBASE_APP_ID?.trim() ?? '',
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

const profileFromCredential = (result: UserCredential) => {
  const googleProfile = result.user.providerData.find(
    (item) => item.providerId === 'google.com',
  )
  const email = result.user.email?.trim().toLowerCase() ?? ''
  const googleId = googleProfile?.uid ?? result.user.uid
  const photoUrl = result.user.photoURL ?? googleProfile?.photoURL ?? ''

  if (!email || !googleId) {
    throw new Error('Google did not return an account')
  }

  return {
    email,
    googleId,
    avatarUrl: photoUrl.startsWith('https://') ? photoUrl : '',
  }
}

export const signInWithGooglePopup = async () => {
  const firebaseAuth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  const result = await signInWithPopup(firebaseAuth, provider)
  const profile = profileFromCredential(result)
  await signOut(firebaseAuth).catch(() => undefined)
  return profile
}

export const signInWithGoogleIdToken = async (idToken: string) => {
  const firebaseAuth = getFirebaseAuth()
  const credential = GoogleAuthProvider.credential(idToken)
  const result = await signInWithCredential(firebaseAuth, credential)
  const profile = profileFromCredential(result)
  await signOut(firebaseAuth).catch(() => undefined)
  return profile
}

export const readGoogleIdToken = (idToken: string) => {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Google did not return an account')

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = JSON.parse(atob(normalized)) as {
    email?: string
    sub?: string
    picture?: string
  }
  const email = json.email?.trim().toLowerCase() ?? ''
  const googleId = json.sub?.trim() ?? ''
  const picture = json.picture?.trim() ?? ''

  if (!email || !googleId) {
    throw new Error('Google did not return an account')
  }

  return {
    email,
    googleId,
    avatarUrl: picture.startsWith('https://') ? picture : '',
  }
}
