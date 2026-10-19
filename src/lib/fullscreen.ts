// Utility for cross-browser, cross-device Fullscreen management

interface FsDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitCurrentFullScreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
  mozFullScreenEnabled?: boolean
  msFullscreenEnabled?: boolean
  webkitExitFullscreen?: () => void | Promise<void>
  webkitCancelFullScreen?: () => void | Promise<void>
  mozCancelFullScreen?: () => void | Promise<void>
  msExitFullscreen?: () => void | Promise<void>
}

interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => void | Promise<void>
  webkitRequestFullScreen?: () => void | Promise<void>
  mozRequestFullScreen?: () => void | Promise<void>
  msRequestFullscreen?: () => void | Promise<void>
}

function notifyFullscreenChange() {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event('customfullscreenchange'))
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isIPhone(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPod/i.test(navigator.userAgent)
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  // Apple iOS (iPhone & iPad Safari) does not hide browser tabs/address bar via DOM Fullscreen API
  if (isIOS() || isIPhone()) return false

  const doc = document as FsDocument
  const docEl = document.documentElement as FsElement

  return Boolean(
    doc.fullscreenEnabled ||
    doc.webkitFullscreenEnabled ||
    doc.mozFullScreenEnabled ||
    doc.msFullscreenEnabled ||
    (docEl && typeof docEl.requestFullscreen === 'function')
  )
}

export function isNativeFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as FsDocument
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.webkitCurrentFullScreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  )
}

export function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  if (isNativeFullscreen()) return true

  // Standalone PWA / Home Screen installed app mode
  if (typeof window !== 'undefined') {
    if (
      ('standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches
    ) {
      return true
    }
  }

  return false
}

export function collapseAddressBar() {
  if (typeof window === 'undefined') return
  try {
    window.scrollTo(0, 1)
  } catch {}
}

export function enterFullscreen(element?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false
  if (isCurrentlyFullscreen()) return true

  const docEl = document.documentElement as FsElement | null
  const el = (element as FsElement | null) || docEl

  const targets: FsElement[] = []
  if (el) targets.push(el)
  if (docEl && docEl !== el) targets.push(docEl)
  if (document.body && document.body !== el) targets.push(document.body as FsElement)

  for (const target of targets) {
    try {
      if (typeof target.requestFullscreen === 'function') {
        const res = target.requestFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
      if (typeof target.webkitRequestFullscreen === 'function') {
        const res = target.webkitRequestFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
      if (typeof target.webkitRequestFullScreen === 'function') {
        const res = target.webkitRequestFullScreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
    } catch {
      // Continue to next target
    }
  }

  collapseAddressBar()
  return false
}

export function exitFullscreen(): boolean {
  if (typeof document === 'undefined') return false

  const doc = document as FsDocument

  try {
    if (isNativeFullscreen()) {
      if (typeof doc.exitFullscreen === 'function') {
        const res = doc.exitFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        const res = doc.webkitExitFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
      } else if (typeof doc.webkitCancelFullScreen === 'function') {
        doc.webkitCancelFullScreen()
      } else if (typeof doc.mozCancelFullScreen === 'function') {
        doc.mozCancelFullScreen()
      } else if (typeof doc.msExitFullscreen === 'function') {
        doc.msExitFullscreen()
      }
    }
  } catch (err) {
    console.log('Exit fullscreen error:', err)
  }

  notifyFullscreenChange()
  return true
}

export function toggleFullscreen(element?: HTMLElement | null): boolean {
  if (isCurrentlyFullscreen()) {
    return exitFullscreen()
  } else {
    return enterFullscreen(element)
  }
}
