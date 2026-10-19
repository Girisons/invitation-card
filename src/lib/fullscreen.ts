// Utility for cross-browser, cross-device Fullscreen management (including iOS Safari fallback)

interface FsDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitCurrentFullScreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
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

// Track simulated/theater fullscreen for iPhone iOS Safari where Apple blocks HTMLElement.requestFullscreen
let iosFallbackFullscreen = false

function notifyFullscreenChange() {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event('customfullscreenchange'))
  }
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
  if (iosFallbackFullscreen) return true

  // PWA / Standalone mode
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
    setTimeout(() => {
      try { window.scrollTo(0, 1) } catch {}
    }, 100)
    setTimeout(() => {
      try { window.scrollTo(0, 1) } catch {}
    }, 300)
  } catch {}
}

export function enterFullscreen(element?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false
  if (isCurrentlyFullscreen()) return true

  const docEl = document.documentElement as FsElement | null
  const el = (element as FsElement | null) || docEl

  // IMPORTANT FOR SAFARI: Call requestFullscreen / webkitRequestFullscreen SYNCHRONOUSLY
  // inside the click handler without any preceding await, otherwise Safari invalidates the user gesture!
  const targets: FsElement[] = []
  if (docEl) targets.push(docEl)
  if (el && el !== docEl) targets.push(el)
  if (document.body) targets.push(document.body as FsElement)

  for (const target of targets) {
    try {
      if (typeof target.webkitRequestFullscreen === 'function') {
        const res = target.webkitRequestFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
        iosFallbackFullscreen = true
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
      if (typeof target.webkitRequestFullScreen === 'function') {
        const res = target.webkitRequestFullScreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
        iosFallbackFullscreen = true
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
      if (typeof target.requestFullscreen === 'function') {
        const res = target.requestFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
        iosFallbackFullscreen = true
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
      if (typeof target.mozRequestFullScreen === 'function') {
        target.mozRequestFullScreen()
        iosFallbackFullscreen = true
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
      if (typeof target.msRequestFullscreen === 'function') {
        target.msRequestFullscreen()
        iosFallbackFullscreen = true
        collapseAddressBar()
        notifyFullscreenChange()
        return true
      }
    } catch {
      // Continue to next target or fallback
    }
  }

  // iPhone iOS Safari fallback (where HTMLElement.requestFullscreen does not exist):
  // Activate edge-to-edge widescreen theater mode + scroll 1px to minimize Safari toolbar
  iosFallbackFullscreen = true
  collapseAddressBar()
  notifyFullscreenChange()
  return true
}

export function exitFullscreen(): boolean {
  if (typeof document === 'undefined') return false

  iosFallbackFullscreen = false
  const doc = document as FsDocument

  try {
    if (isNativeFullscreen()) {
      if (typeof doc.webkitExitFullscreen === 'function') {
        const res = doc.webkitExitFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
      } else if (typeof doc.webkitCancelFullScreen === 'function') {
        doc.webkitCancelFullScreen()
      } else if (typeof doc.exitFullscreen === 'function') {
        const res = doc.exitFullscreen()
        if (res && typeof (res as Promise<void>).catch === 'function') {
          ;(res as Promise<void>).catch(() => {})
        }
      } else if (typeof doc.mozCancelFullScreen === 'function') {
        doc.mozCancelFullScreen()
      } else if (typeof doc.msExitFullscreen === 'function') {
        doc.msExitFullscreen()
      }
    }
  } catch (err) {
    console.log('Exit fullscreen handled:', err)
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
