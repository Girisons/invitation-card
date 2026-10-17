import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Inter, Cinzel, Marcellus, Great_Vibes } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-marcellus',
  display: 'swap',
})

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://khandelwalinvite.vercel.app'),
  title: "Arpit's 40th & Diwali Bash",
  description: 'Invitation - Tap to open',
  openGraph: {
    title: "Arpit's 40th & Diwali Bash",
    description: 'Invitation - Tap to open',
    url: 'https://khandelwalinvite.vercel.app',
    siteName: "Arpit's 40th & Diwali Bash",
    images: [
      {
        url: 'https://khandelwalinvite.vercel.app/og.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: "Arpit's 40th & Diwali Bash Invitation",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Arpit's 40th & Diwali Bash",
    description: 'Invitation - Tap to open',
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
    <html lang="en" className={`${playfair.variable} ${cinzel.variable} ${marcellus.variable} ${greatVibes.variable} ${inter.variable}`}>
      <body className="bg-[#050D1A] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
