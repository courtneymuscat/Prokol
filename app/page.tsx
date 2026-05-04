import type { Metadata } from 'next'
import LandingPage from './LandingPage'

export const metadata: Metadata = {
  title: 'Prokol Health — Nutrition, Training & Health Data Coaching Platform',
  description:
    'The all-in-one coaching platform for nutritionists, personal trainers, and dietitians. Meal plans, training programs, autoflows, cycle tracking, and white-label for gyms. From $39/month.',
  openGraph: {
    title: 'Prokol Health — Coaching Platform for Coaches & Practitioners',
    description:
      'Meal plans, training, autoflows, cycle tracking, and white-label for gyms. One platform. No add-ons. From $39/month.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prokol Health — Coaching Platform',
    description: 'Everything your coaching practice needs. From $39/month.',
    images: ['/og-image.png'],
  },
}

export default function Page() {
  return <LandingPage />
}
