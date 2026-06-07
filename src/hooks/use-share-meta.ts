import { useEffect } from 'react'
import {
  buildShareMetaDescription,
  buildShareMetaTitle,
} from '../../lib/share-meta'
import { APP_DESCRIPTION, APP_NAME, LOGO_SRC } from '../constants/brand'
import type { ExpenseSheetData } from '../types/expense-sheet'
import { getShareSheetUrl } from '../lib/sheet-urls'

const META_TAGS = [
  'description',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'twitter:title',
  'twitter:description',
  'twitter:image',
] as const

const getMetaSelector = (key: (typeof META_TAGS)[number]) => {
  if (key === 'description') {
    return 'meta[name="description"]'
  }

  const property = key.startsWith('twitter:') ? 'name' : 'property'
  return `meta[${property}="${key}"]`
}

const setMetaContent = (key: (typeof META_TAGS)[number], value: string) => {
  const selector = getMetaSelector(key)
  let element = document.querySelector(selector)

  if (!element) {
    element = document.createElement('meta')
    if (key === 'description') {
      element.setAttribute('name', 'description')
    } else if (key.startsWith('twitter:')) {
      element.setAttribute('name', key)
    } else {
      element.setAttribute('property', key)
    }
    document.head.appendChild(element)
  }

  element.setAttribute('content', value)
}

export const useShareMeta = (
  sheetId: string,
  sheetData: ExpenseSheetData | null,
) => {
  useEffect(() => {
    if (!sheetData) return

    const previousTitle = document.title
    const previousMeta = Object.fromEntries(
      META_TAGS.map((key) => {
        const element = document.querySelector(getMetaSelector(key))
        return [key, element?.getAttribute('content') ?? '']
      }),
    )

    const title = buildShareMetaTitle(sheetData.name)
    const description = buildShareMetaDescription(
      sheetData.users,
      sheetData.summary.pending,
    )
    const shareUrl = getShareSheetUrl(sheetId)
    const imageUrl = `${window.location.origin}${LOGO_SRC}`

    document.title = title
    setMetaContent('description', description)
    setMetaContent('og:title', title)
    setMetaContent('og:description', description)
    setMetaContent('og:url', shareUrl)
    setMetaContent('og:image', imageUrl)
    setMetaContent('twitter:title', title)
    setMetaContent('twitter:description', description)
    setMetaContent('twitter:image', imageUrl)

    return () => {
      document.title = previousTitle || APP_NAME

      META_TAGS.forEach((key) => {
        const value = previousMeta[key]
        if (value) {
          setMetaContent(key, value)
          return
        }

        document.querySelector(getMetaSelector(key))?.remove()
      })

      if (!previousMeta.description) {
        setMetaContent('description', APP_DESCRIPTION)
      }
    }
  }, [sheetData, sheetId])
}
