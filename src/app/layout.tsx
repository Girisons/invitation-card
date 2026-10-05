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
  title: "Arpit's 40th & Diwali Bash — A Personal Invitation",
  description: 'You have received a personal invitation — Friday, 23 October 2026, Jaipur.',
  openGraph: {
    title: "Arpit's 40th & Diwali Bash",
    description: 'A personal invitation for you — Friday, 23 October 2026, Jaipur.',
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
    description: 'A personal invitation for you — Friday, 23 October 2026, Jaipur.',
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
