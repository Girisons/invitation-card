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
  webkitRequestFullscreen?: (options?: unknown) => Promise<void>
  mozRequestFullScreen?: (options?: unknown) => Promise<void>
  msRequestFullscreen?: (options?: unknown) => Promise<void>
}

export function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as FsDocument
  if (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  ) {
    return true
  }

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
    }, 150)
    setTimeout(() => {
      try { window.scrollTo(0, 1) } catch {}
    }, 400)
  } catch {}
}

export async function enterFullscreen(element?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (isCurrentlyFullscreen()) return true

  const targets: FsElement[] = []
  if (element) targets.push(element as FsElement)
  if (document.documentElement) targets.push(document.documentElement as FsElement)
  if (document.body) targets.push(document.body as FsElement)

  for (const target of targets) {
    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: 'hide' } as unknown as FullscreenOptions)
        collapseAddressBar()
        return true
      }
    } catch {
      // Try without options if navigationUI wasn't supported
      try {
        if (target.requestFullscreen) {
          await target.requestFullscreen()
          collapseAddressBar()
          return true
        }
      } catch {}
    }

    try {
      if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen({ navigationUI: 'hide' })
        collapseAddressBar()
        return true
      }
    } catch {
      try {
        if (target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen()
          collapseAddressBar()
          return true
        }
      } catch {}
    }

    try {
      if (target.mozRequestFullScreen) {
        await target.mozRequestFullScreen()
        collapseAddressBar()
        return true
      }
    } catch {}

    try {
      if (target.msRequestFullscreen) {
        await target.msRequestFullscreen()
        collapseAddressBar()
        return true
      }
    } catch {}
  }

  // iOS Safari fallback: scroll 1px down to minimize browser navigation bar
  collapseAddressBar()

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

export async function toggleFullscreen(element?: HTMLElement | null): Promise<boolean> {
  if (isCurrentlyFullscreen()) {
    return exitFullscreen()
  } else {
    return enterFullscreen(element)
  }
}
