// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { siteConfig } from "@/config/site";

interface JsonLdProps {
  type: "website" | "software" | "organization" | "faq" | "all";
}

export function JsonLd({ type }: JsonLdProps) {
  const schemas: Record<string, object> = {};

  // Website Schema
  if (type === "website" || type === "all") {
    schemas.website = {
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
    };
  }

  // Software Application Schema
  if (type === "software" || type === "all") {
    schemas.software = {
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
    };
  }

  // Organization Schema
  if (type === "organization" || type === "all") {
    schemas.organization = {
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
    };
  }

  // FAQ Schema
  if (type === "faq" || type === "all") {
    schemas.faq = {
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
    };
  }

  const schemaArray = Object.values(schemas);

  return (
    <>
      {schemaArray.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

// Breadcrumb Schema for internal pages
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Article Schema for blog posts
export function ArticleJsonLd({
  title,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified,
  authorName,
}: {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description,
    url: url,
    image: imageUrl,
    datePublished: datePublished,
    dateModified: dateModified,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "Cothink LLC",
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/logo.png`,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
