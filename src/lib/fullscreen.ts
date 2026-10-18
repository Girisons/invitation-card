// Utility for cross-browser, cross-device Fullscreen management

interface FsDocument extends Document {
  webkitFullscreenElement?: Element
  mozFullScreenElement?: Element
  msFullscreenElement?: Element
  webkitExitFullscreen?: () => Promise<void>
  mozCancelFullScreen?: () => Promise<void>
  msExitFullscreen?: () => Promise<void>
}

interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
}

export function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as FsDocument
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  )
}

export async function enterFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (isCurrentlyFullscreen()) return true

  const docEl = document.documentElement as FsElement

  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen()
      return true
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen()
      return true
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen()
      return true
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen()
      return true
    }
  } catch (err) {
    // Expected on mobile browsers when transient user activation is expired
    console.log('Fullscreen request handled:', err)
  }

  // iOS Safari fallback: scroll 1px down to minimize browser navigation bar
  try {
    window.scrollTo(0, 1)
  } catch {}

  return false
}

export async function exitFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (!isCurrentlyFullscreen()) return true

  const doc = document as FsDocument

  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen()
      return true
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
      return true
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen()
      return true
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen()
      return true
    }
  } catch (err) {
    console.log('Exit fullscreen handled:', err)
  }
  return false
}

export async function toggleFullscreen(): Promise<boolean> {
  if (isCurrentlyFullscreen()) {
    return exitFullscreen()
  } else {
    return enterFullscreen()
  }
}
