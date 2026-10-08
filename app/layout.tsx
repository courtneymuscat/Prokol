import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import InstallPrompt from "@/app/components/InstallPrompt";
import ServiceWorkerRegistration from "@/app/components/ServiceWorkerRegistration";
import ClientBottomNav from "@/app/components/ClientBottomNav";
import PushSetup from "@/app/components/PushSetup";
import AppRefresh from "@/app/components/AppRefresh";
import { BrandingProvider } from "@/app/components/BrandingProvider";
import { getBrandingFromHeaders, DEFAULT_BRANDING } from "@/lib/branding";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Resolves the minimum profile fields the bottom nav needs to render the
// correct tab set on the very first paint. Returns nulls for logged-out
// requests so the layout still works on public routes.
async function loadNavContext(): Promise<{ sex: string | null; tier: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { sex: null, tier: null }

    const [profileResult, coachRelResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('sex, subscription_tier')
        .eq('id', session.user.id)
        .single(),
      supabase
        .from('coach_clients')
        .select('id')
        .eq('client_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle(),
    ])
    const profile = profileResult.data as { sex: string | null; subscription_tier: string | null } | null
    // An active coach relationship beats the stored tier — profiles can lag
    // behind seat assignment briefly.
    const tier = coachRelResult.data ? 'coached' : (profile?.subscription_tier ?? null)
    return { sex: profile?.sex ?? null, tier }
  } catch {
    return { sex: null, tier: null }
  }
}

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const branding = getBrandingFromHeaders(headersList)
  return {
    title: branding.appName,
    description: `Track your nutrition and progress with ${branding.appName}`,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      // This is what iOS's "Add to Home Screen" name field actually reads.
      // Used to also be hand-written as a <meta> tag directly in the root
      // layout's JSX <head> below — a duplicate of this same tag, which is
      // exactly the kind of conflict that silently dropped the white-label
      // favicon link in this same file (see the icons comment below). Moved
      // fully into the Metadata API so there's only ever one copy.
      title: branding.appName,
    },
    icons: {
      // Also used to be a hand-written <link> in the JSX <head> — same
      // duplicate-tag issue, this time dropping org branding from both the
      // browser-tab favicon and the home-screen icon depending on which
      // copy won the merge.
      icon: branding.faviconUrl ?? '/icons/prokol-icon.svg',
      apple: branding.appIconUrl ?? branding.faviconUrl ?? '/icons/icon-180.png',
    },
    openGraph: {
      title: branding.appName,
    },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let branding = DEFAULT_BRANDING
  try {
    const headersList = await headers()
    branding = getBrandingFromHeaders(headersList)
  } catch {
    // headers() not available during static rendering — use defaults
  }

  const navContext = await loadNavContext()

  const cssVars = `
    :root {
      --brand-primary: ${branding.brandColour};
      --brand-secondary: ${branding.brandColourSecondary};
      --brand-text: ${branding.brandColourText};
    }
  `.trim()

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", inter.variable, "font-sans", geist.variable)}
    >
      <head>
        {/*
          Only the CSS custom properties live here now — everything else
          (icons, apple-mobile-web-app-title, etc.) moved into
          generateMetadata above. A hand-written <head> alongside the
          Metadata API's own output is exactly what caused the white-label
          favicon/title tags to silently lose to a duplicate before.
        */}
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body className="min-h-full flex flex-col">
        <BrandingProvider branding={branding}>
          {children}
          <ClientBottomNav initialSex={navContext.sex} initialTier={navContext.tier} />
          <PushSetup />
          <InstallPrompt />
          <ServiceWorkerRegistration />
          <AppRefresh />
        </BrandingProvider>
      </body>
    </html>
  );
}
