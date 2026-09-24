import type { Post, ProductLink } from '../../entities/post/model/types'
import { canonicalSiteOrigin } from './seo-config'

type Gtag = (...args: unknown[]) => void
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

let initialized = false

export function hasAnalyticsMeasurementId() {
  return /^G-[A-Z0-9]+$/.test(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '')
}

export function initializeAnalytics() {
  if (typeof window === 'undefined' || !hasAnalyticsMeasurementId()) return false
  if (/^\/(?:blog\/)?secret(?:\/|$)/.test(window.location.pathname)) return false

  const debug = import.meta.env.VITE_GA_DEBUG === 'true'
  const productionHost = new URL(canonicalSiteOrigin(import.meta.env.VITE_SITE_URL)).hostname
  if (!debug && (import.meta.env.DEV || window.location.hostname !== productionHost)) return false
  if (initialized) return true

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
  window.dataLayer = window.dataLayer || []
  // gtag.js expects an Arguments object in the queue, as in Google's snippet.
  window.gtag = window.gtag || function () { window.dataLayer!.push(arguments) }
  window.gtag('js', new Date())
  // GA4 Enhanced Measurement owns page_view, including History API changes.
  // Do not also emit manual page_view events or install a second GA tag in GTM.
  window.gtag('config', measurementId, {
    ...(debug ? { debug_mode: true } : {}),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.append(script)
  initialized = true
  return true
}

function sendEvent(name: string, parameters: Record<string, unknown>) {
  // Analytics must never block product navigation, including embedded browsers.
  try {
    if (initializeAnalytics()) window.gtag?.('event', name, parameters)
  } catch { /* Browsing remains available if measurement is blocked. */ }
}

function item(post: Post) {
  return { item_id: post.id, item_name: post.title, item_category: post.category, quantity: 1 }
}

export function trackProductClick(post: Post, list = 'storefront') {
  sendEvent('select_item', { item_list_id: list, item_list_name: list, items: [item(post)] })
}

export function trackProductView(post: Post) {
  sendEvent('view_item', { items: [item(post)] })
}

export function trackAffiliateClick(post: Post, link: ProductLink) {
  sendEvent('affiliate_click', {
    item_id: post.id,
    item_name: post.title,
    link_id: link.id,
    mall: link.mall,
    // Keep affiliate URLs/query parameters out of custom analytics events.
    transport_type: 'beacon',
  })
}
