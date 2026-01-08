import { Metadata } from "next";
import { PricingContent } from "./pricing-content";

export const metadata: Metadata = {
  title: "Pricing - Plans for Every Scale",
  description: "VoxNexus pricing plans from free self-hosted to enterprise. Start with $0/minute local TTS, scale to managed hosting with priority support.",
  keywords: [
    "AI voice agent pricing",
    "voice bot cost",
    "SIP integration pricing",
    "local TTS free",
    "self-hosted voice AI",
  ],
  openGraph: {
    title: "VoxNexus Pricing - AI Voice Agent Plans",
    description: "From free self-hosted to enterprise. Build AI voice agents starting at $0/minute.",
  },
};

// JSON-LD for pricing offers
const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "VoxNexus Pricing",
  description: "Pricing plans for VoxNexus AI Voice Agent Platform",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      {
        "@type": "Product",
        position: 1,
        name: "VoxNexus Free",
        description: "Self-hosted open source version with unlimited agents",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "Product",
        position: 2,
        name: "VoxNexus Starter",
        description: "For individuals getting started with voice AI",
        offers: {
          "@type": "Offer",
          price: "29",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          priceValidUntil: "2027-12-31",
        },
      },
      {
        "@type": "Product",
        position: 3,
        name: "VoxNexus Pro",
        description: "For growing businesses with advanced needs",
        offers: {
          "@type": "Offer",
          price: "79",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          priceValidUntil: "2027-12-31",
        },
      },
      {
        "@type": "Product",
        position: 4,
        name: "VoxNexus Business",
        description: "For teams requiring priority support and higher limits",
        offers: {
          "@type": "Offer",
          price: "199",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          priceValidUntil: "2027-12-31",
        },
      },
      {
        "@type": "Product",
        position: 5,
        name: "VoxNexus Agency",
        description: "White-label solution for agencies with sub-accounts",
        offers: {
          "@type": "Offer",
          price: "499",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          priceValidUntil: "2027-12-31",
        },
      },
    ],
  },
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />
      <PricingContent />
    </>
  );
}
