import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ code: string }>
}

export default async function TeaserPage({ params }: Props) {
  const { code } = await params
  redirect(`/i/${code}`)
}
