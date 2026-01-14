// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import React from "react";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { Toaster } from "@/components/ui/toaster";
import { siteConfig } from "@/config/site";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [...siteConfig.authors],
  creator: siteConfig.creator,
  publisher: siteConfig.publisher,

  // Canonical URL
  alternates: {
    canonical: "/",
  },

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VoxNexus - Open Source AI Voice Agent Platform",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/og-image.png"],
    creator: "@voxnexus",
    site: "@voxnexus",
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },

  // Manifest
  manifest: "/manifest.webmanifest",

  // Verification (add your verification codes)
  verification: {
    google: "your-google-verification-code",
    // yandex: 'your-yandex-verification-code',
    // yahoo: 'your-yahoo-verification-code',
  },

  // App Links
  appLinks: {
    web: {
      url: siteConfig.url,
      should_fallback: true,
    },
  },

  // Category
  category: "technology",

  // Classification
  classification: "Business Software",

  // Other
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": siteConfig.name,
    "format-detection": "telephone=no",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#0a0a0a",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS Prefetch for API endpoints */}
        <link rel="dns-prefetch" href="https://api.openai.com" />
        <link rel="dns-prefetch" href="https://api.anthropic.com" />
        <link rel="dns-prefetch" href="https://api.deepgram.com" />

        {/* RSS Feed */}
        <link rel="alternate" type="application/rss+xml" title="VoxNexus Updates" href="/feed.xml" />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <AnalyticsTracker />
          {children}
          <Toaster />
        </SessionProvider>
        
        {/* JSON-LD Structured Data - using next/Script for proper loading */}
        <Script
          id="jsonld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: siteConfig.name,
              description: siteConfig.description,
              url: siteConfig.url,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            })
          }}
        />
        
        <Script
          id="jsonld-software"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: siteConfig.name,
              description: siteConfig.description,
              url: siteConfig.url,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Linux, Docker, Windows, macOS",
              offers: [
                {
                  "@type": "Offer",
                  name: siteConfig.pricing.free.name,
                  price: siteConfig.pricing.free.price,
                  priceCurrency: siteConfig.pricing.free.currency,
                  description: siteConfig.pricing.free.description,
                },
                {
                  "@type": "Offer",
                  name: siteConfig.pricing.pro.name,
                  price: siteConfig.pricing.pro.price,
                  priceCurrency: siteConfig.pricing.pro.currency,
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: siteConfig.pricing.pro.price,
                    priceCurrency: siteConfig.pricing.pro.currency,
                    unitText: "MONTH",
                  },
                  description: siteConfig.pricing.pro.description,
                },
                {
                  "@type": "Offer",
                  name: siteConfig.pricing.agency.name,
                  price: siteConfig.pricing.agency.price,
                  priceCurrency: siteConfig.pricing.agency.currency,
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: siteConfig.pricing.agency.price,
                    priceCurrency: siteConfig.pricing.agency.currency,
                    unitText: "MONTH",
                  },
                  description: siteConfig.pricing.agency.description,
                },
              ],
              softwareVersion: "1.0.0",
              datePublished: "2026-01-01",
              author: {
                "@type": "Organization",
                name: "Cothink LLC",
                url: "https://cothink.io",
              },
              publisher: {
                "@type": "Organization",
                name: "Cothink LLC",
                url: "https://cothink.io",
              },
              license: "https://www.apache.org/licenses/LICENSE-2.0",
              isAccessibleForFree: true,
              featureList: [
                "AI Voice Agents",
                "Local TTS with Kokoro",
                "SIP Telephony Integration",
                "OpenAI and Anthropic LLM Support",
                "Local LLM via Ollama",
                "Knowledge Base RAG",
                "Webhook Integrations",
                "Real-time Voice Processing",
                "Multi-tenant Architecture",
                "White-label Support",
              ],
              screenshot: `${siteConfig.url}/screenshots/dashboard.png`,
              softwareRequirements: "Docker, PostgreSQL, Redis",
              storageRequirements: "4GB RAM minimum",
              memoryRequirements: "4GB RAM minimum",
              processorRequirements: "2 CPU cores minimum",
            })
          }}
        />
        
        <Script
          id="jsonld-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Cothink LLC",
              url: "https://cothink.io",
              logo: `${siteConfig.url}/logo.png`,
              description:
                "Building open source AI infrastructure for voice and conversational applications.",
              foundingDate: "2024",
              founders: [
                {
                  "@type": "Person",
                  name: "Alberto Fernandez",
                  url: "https://linkedin.com/in/afernandez1983",
                },
              ],
              sameAs: [
                siteConfig.links.github,
                siteConfig.links.twitter,
                siteConfig.links.linkedin,
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: "support@voxnexus.pro",
              },
            })
          }}
        />
        
        <Script
          id="jsonld-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: siteConfig.faq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            })
          }}
        />
      </body>
    </html>
  );
}
