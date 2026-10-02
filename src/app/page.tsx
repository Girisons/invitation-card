import { redirect } from 'next/navigation'

// Root redirects — no public home page
export default function Home() {
  redirect('/i/DEMO1')
}
