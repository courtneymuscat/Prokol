import Link from 'next/link'
import PricingCards from './pricing/PricingCards'
import LandingContent from './LandingContent'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">NutriCoach</span>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#coach-platform" className="hover:text-gray-900 transition-colors">For Coaches</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold px-4 py-2 rounded-xl text-gray-900 transition-colors hover:opacity-90"
              style={{ backgroundColor: '#FFD885' }}
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Audience-aware content (toggle + hero + features + how it works + CTA) */}
      <LandingContent />

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-lg">Start free. Upgrade when you&apos;re ready. Cancel anytime.</p>
          </div>
          <PricingCards currentTier={null} currentUserType={null} />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span className="font-bold text-white">NutriCoach</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-gray-300 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-300 transition-colors">Pricing</a>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Log in</Link>
            <Link href="/signup" className="hover:text-gray-300 transition-colors">Sign up</Link>
          </div>
          <span>© {new Date().getFullYear()} NutriCoach. All rights reserved.</span>
        </div>
      </footer>

    </div>
  )
}
