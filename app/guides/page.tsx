import type { Metadata } from 'next'
import GuidesPage from './GuidesPage'

export const metadata: Metadata = {
  title: 'Help & Guides — Prokol Health',
  description:
    'Step-by-step guides for coaches and clients on using Prokol. Covering onboarding, training programs, meal plans, autoflows, food logging, and more.',
}

export default function Page() {
  return <GuidesPage />
}
