import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Geist, Syne, DM_Sans } from "next/font/google";
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

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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
      title: branding.appName,
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
      className={cn("h-full", "antialiased", inter.variable, geistMono.variable, "font-sans", geist.variable, syne.variable, dmSans.variable)}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {branding.faviconUrl && (
          <link rel="icon" href={branding.faviconUrl} />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <BrandingProvider branding={branding}>
          {children}
          <ClientBottomNav />
          <PushSetup />
          <InstallPrompt />
          <ServiceWorkerRegistration />
          <AppRefresh />
        </BrandingProvider>
      </body>
    </html>
  );
}
