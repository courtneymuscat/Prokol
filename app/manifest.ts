import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getBrandingFromHeaders } from '@/lib/branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headersList = await headers()
  const branding = getBrandingFromHeaders(headersList)

  if (!branding.isWhiteLabel) {
    return {
      name: 'Prokol',
      short_name: 'Prokol',
      description: 'Track your nutrition and progress',
      start_url: '/dashboard',
      display: 'standalone',
      background_color: '#EEF4F0',
      theme_color: '#1D9E75',
      orientation: 'portrait',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    }
  }

  // Prefer the dedicated square app icon; fall back to the favicon (lower
  // resolution, but still the org's own branding rather than Prokol's).
  // The same file is reused for both declared sizes — no resizing pipeline
  // exists, so this just serves whatever the org uploaded as-is.
  const icon = branding.appIconUrl ?? branding.faviconUrl
  const icons = icon
    ? [
        { src: icon, sizes: '192x192', type: 'image/png' },
        { src: icon, sizes: '512x512', type: 'image/png' },
      ]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ]

  return {
    name: branding.appName,
    short_name: branding.appName,
    description: `Track your nutrition and progress with ${branding.appName}`,
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#EEF4F0',
    theme_color: branding.brandColour,
    orientation: 'portrait',
    icons,
  }
}
