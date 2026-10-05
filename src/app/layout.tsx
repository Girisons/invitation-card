import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://khandelwalinvite.vercel.app'),
  title: '\u200B',
  description: '\u200B',
  openGraph: {
    title: '\u200B',
    description: '\u200B',
    url: 'https://khandelwalinvite.vercel.app',
    siteName: '',
    images: [
      {
        url: 'https://khandelwalinvite.vercel.app/og.jpg',
        width: 720,
        height: 1280,
        type: 'image/jpeg',
        alt: 'Save the Date',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '\u200B',
    description: '\u200B',
    images: ['https://khandelwalinvite.vercel.app/og.jpg'],
  },
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050D1A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="bg-[#050D1A] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
