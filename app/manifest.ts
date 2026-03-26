import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutriCoach',
    short_name: 'NutriCoach',
    description: 'Track your nutrition and progress',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FFFBF0',
    theme_color: '#FFD885',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
