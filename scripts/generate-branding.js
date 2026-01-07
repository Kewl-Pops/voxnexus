#!/usr/bin/env node
/**
 * VoxNexus Branding Generator
 * Generates tagline, copy, and color palette using Gemini API
 * Generates logo and hero images using DALL-E 3
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Read API keys from uefncentral .env file directly
function loadEnvFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  return env;
}

const envVars = loadEnvFile('/var/www/uefncentral/.env');
const GEMINI_API_KEY = envVars.GEMINI_API_KEY;
const OPENAI_API_KEY = envVars.OPENAI_API_KEY;

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images');
const CONTENT_FILE = path.join(__dirname, '..', 'generated-content.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Call Gemini API for text generation
 */
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    })
  });

  const data = await response.json();

  if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('Gemini API error: ' + JSON.stringify(data));
}

/**
 * Call DALL-E 3 for image generation
 */
async function callDallE(prompt, size = '1024x1024') {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: 'hd',
      response_format: 'url'
    })
  });

  const data = await response.json();

  if (data.data && data.data[0]?.url) {
    return data.data[0].url;
  }

  throw new Error('DALL-E API error: ' + JSON.stringify(data));
}

/**
 * Download image from URL
 */
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🚀 VoxNexus Branding Generator\n');
  console.log('=' .repeat(50));

  // Phase 1: Generate branding content with Gemini
  console.log('\n📝 Phase 1: Generating branding content with Gemini...\n');

  const brandingPrompt = `You are a world-class brand strategist. Create branding for "VoxNexus" - an open-core AI voice agent platform.

Business Model:
- Open-source core platform (self-hostable, MIT license)
- Hosted SaaS version for businesses who want managed service
- Target: Developers building voice AI apps AND businesses wanting ready-to-use voice agents
- Think: "The Vercel/Supabase for AI Voice Agents"

Generate the following in valid JSON format:

{
  "tagline": "A punchy 5-8 word tagline",
  "taglineAlternatives": ["2 more tagline options"],
  "heroHeadline": "Compelling headline for the hero section (max 10 words)",
  "heroSubheadline": "2-3 sentence description of the value proposition",
  "features": [
    {"title": "Feature name", "description": "One sentence description", "icon": "lucide icon name"}
  ],
  "ctaPrimary": "Primary call-to-action button text",
  "ctaSecondary": "Secondary CTA text",
  "colorPalette": {
    "primary": "#hexcode - description",
    "secondary": "#hexcode - description",
    "accent": "#hexcode - description",
    "background": "#hexcode",
    "foreground": "#hexcode",
    "rationale": "Why these colors work for the brand"
  },
  "brandVoice": "2-3 sentences describing the brand personality",
  "socialProofHeadline": "Headline for testimonials/logos section"
}

Make it modern, developer-friendly, but also approachable for business users. The voice AI space is technical but the product makes it accessible.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.`;

  let brandingContent;
  try {
    const geminiResponse = await callGemini(brandingPrompt);
    // Clean up response - remove markdown code blocks if present
    let cleanJson = geminiResponse.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    brandingContent = JSON.parse(cleanJson);
    console.log('✅ Branding content generated!\n');
    console.log('Tagline:', brandingContent.tagline);
    console.log('Hero:', brandingContent.heroHeadline);
    console.log('Colors:', brandingContent.colorPalette.primary);
  } catch (error) {
    console.error('❌ Gemini error:', error.message);
    // Fallback content
    brandingContent = {
      tagline: "Voice AI, Simplified",
      taglineAlternatives: ["Build Voice Agents in Minutes", "The Open Platform for Voice AI"],
      heroHeadline: "Build AI Voice Agents Without the Complexity",
      heroSubheadline: "VoxNexus is the open-source platform for creating intelligent voice agents. Self-host for full control, or let us handle the infrastructure with our managed cloud.",
      features: [
        { title: "Open Source Core", description: "MIT licensed, fully customizable, runs anywhere", icon: "code" },
        { title: "Plugin Architecture", description: "Swap LLMs, STT, and TTS providers with one config change", icon: "puzzle" },
        { title: "Real-Time Voice", description: "Sub-second latency powered by LiveKit", icon: "zap" },
        { title: "Managed Cloud", description: "Skip the ops - we handle scaling, updates, and uptime", icon: "cloud" }
      ],
      ctaPrimary: "Start Building Free",
      ctaSecondary: "View Documentation",
      colorPalette: {
        primary: "#7C3AED",
        secondary: "#1E1B4B",
        accent: "#10B981",
        background: "#0F0F0F",
        foreground: "#FAFAFA",
        rationale: "Purple conveys innovation and AI, green accent for growth/success"
      },
      brandVoice: "Technical but approachable. We speak developer, but we don't gatekeep. Confident without being arrogant.",
      socialProofHeadline: "Trusted by developers and teams worldwide"
    };
    console.log('⚠️ Using fallback branding content');
  }

  // Save content to file
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(brandingContent, null, 2));
  console.log(`\n💾 Content saved to: ${CONTENT_FILE}`);

  // Phase 2: Generate images with DALL-E 3
  console.log('\n🎨 Phase 2: Generating images with DALL-E 3...\n');

  // Generate Logo
  console.log('Generating logo...');
  try {
    const logoPrompt = `Design a modern, minimalist logo mark for "VoxNexus" - an AI voice agent platform.

Requirements:
- Abstract geometric design incorporating sound waves or voice visualization
- Modern tech aesthetic, suitable for dark and light backgrounds
- NO text or letters in the logo - just the symbol/icon
- Clean lines, professional, memorable
- Colors: Purple (#7C3AED) and white, with optional teal accent
- Style: Similar to Vercel, Linear, or Notion logo simplicity
- Must work at small sizes (favicon) and large sizes

The logo should evoke: voice, AI, connection, innovation`;

    const logoUrl = await callDallE(logoPrompt, '1024x1024');
    await downloadImage(logoUrl, path.join(OUTPUT_DIR, 'logo.png'));
    console.log('✅ Logo saved to public/images/logo.png');
  } catch (error) {
    console.error('❌ Logo generation error:', error.message);
  }

  // Generate Hero Background
  console.log('Generating hero background...');
  try {
    const heroPrompt = `Create an abstract, futuristic background image for a tech landing page.

Requirements:
- Dark background (#0F0F0F base)
- Subtle glowing sound wave patterns and voice visualization elements
- Purple (#7C3AED) and teal (#10B981) accent colors
- Abstract neural network or connection patterns
- Gradient mesh with subtle depth
- Modern, clean, not busy or cluttered
- Professional SaaS/tech company aesthetic
- NO text, NO logos, NO people

Style: Premium tech, similar to Linear.app or Vercel hero backgrounds`;

    const heroUrl = await callDallE(heroPrompt, '1792x1024');
    await downloadImage(heroUrl, path.join(OUTPUT_DIR, 'hero-bg.png'));
    console.log('✅ Hero background saved to public/images/hero-bg.png');
  } catch (error) {
    console.error('❌ Hero background generation error:', error.message);
  }

  // Generate OG Image
  console.log('Generating social sharing image...');
  try {
    const ogPrompt = `Create a social media preview image (Open Graph) for VoxNexus.

Requirements:
- Dark purple/black gradient background
- Central abstract logo element (glowing sound wave/voice icon)
- Modern, sleek tech aesthetic
- Space on left side for text overlay (will add "VoxNexus" text later)
- Professional, premium feel
- NO text in the image itself
- Dimensions suitable for social sharing

Style: Modern SaaS announcement graphic`;

    const ogUrl = await callDallE(ogPrompt, '1792x1024');
    await downloadImage(ogUrl, path.join(OUTPUT_DIR, 'og-image.png'));
    console.log('✅ OG image saved to public/images/og-image.png');
  } catch (error) {
    console.error('❌ OG image generation error:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Branding generation complete!');
  console.log(`\nGenerated files:`);
  console.log(`  📄 ${CONTENT_FILE}`);
  console.log(`  🖼️  ${OUTPUT_DIR}/logo.png`);
  console.log(`  🖼️  ${OUTPUT_DIR}/hero-bg.png`);
  console.log(`  🖼️  ${OUTPUT_DIR}/og-image.png`);
}

main().catch(console.error);
