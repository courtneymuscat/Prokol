import Link from 'next/link'
import { InquiryButton } from '@/app/components/InquiryForm'

// Shared nav + footer for Courtney's personal pages (/about, /work-with-me).
// Deliberately NOT the same component as LandingPage's nav/footer — those
// are inline in that file and tightly coupled to its own scroll/mobile-menu
// state — but reuses the same wordmark, link style, and footer link-list
// shape so the pages still read as part of prokol.io, just personal-led
// rather than product-led.

const INK = '#211A17'
const INK_SOFT = 'rgba(33,26,23,0.6)'

export function PersonalNav({ active }: { active: 'about' | 'work' }) {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-sm" style={{ background: 'rgba(246,243,239,0.88)', borderBottom: '1px solid rgba(33,26,23,0.08)' }}>
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <svg width="26" height="26" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" rx="108" fill="#1D9E75" />
            <path fill="white" fillRule="evenodd" d="M138,108 L138,404 L214,404 L214,306 L283,306 Q382,306 382,207 Q382,108 283,108 Z M214,178 L277,178 Q310,178 310,207 Q310,236 277,236 L214,236 Z" />
          </svg>
          <span className="text-sm font-bold" style={{ color: INK }}>Prokol<span style={{ color: 'var(--nc-primary)' }}>.</span></span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/about" style={{ color: active === 'about' ? INK : INK_SOFT, textDecoration: 'none' }}>About</Link>
          <Link href="/dashboard" style={{ color: INK_SOFT, textDecoration: 'none' }}>The Platform</Link>
          <Link href="/work-with-me" style={{ color: active === 'work' ? INK : INK_SOFT, textDecoration: 'none' }}>Work With Me</Link>
          <InquiryButton className="px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ background: '#1D9E75' }}>
            Get in touch
          </InquiryButton>
        </div>
      </div>
    </nav>
  )
}

export function PersonalFooter() {
  return (
    <footer className="px-6 py-10" style={{ borderTop: '1px solid rgba(33,26,23,0.08)' }}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs" style={{ color: INK_SOFT }}>© {new Date().getFullYear()} Courtney Muscat · Built on <Link href="/" style={{ color: INK_SOFT, textDecoration: 'underline' }}>Prokol</Link></p>
        <a href="mailto:info@prokol.io" className="text-xs font-medium" style={{ color: INK_SOFT, textDecoration: 'none' }}>info@prokol.io</a>
      </div>
    </footer>
  )
}
