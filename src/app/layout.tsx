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
  title: 'Arpit @ 40 × Diwali — A Personal Invitation',
  description: 'You have received a personal invitation.',
  openGraph: {
    title: 'Arpit @ 40 × Diwali',
    description: 'A personal invitation for you — 23 October 2026, Jaipur.',
    images: ['/og.jpg'],
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
