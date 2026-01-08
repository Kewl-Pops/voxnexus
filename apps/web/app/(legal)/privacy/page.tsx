// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | VoxNexus",
  description: "Privacy Policy for VoxNexus AI Voice Platform",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-slate-400 text-lg">Last Updated: January 8, 2026</p>

      <p>
        This Privacy Policy describes how Cothink LLC ("Company," "we," "us," or
        "our") collects, uses, and shares information when you use VoxNexus (the
        "Service"). By using VoxNexus, you agree to the collection and use of
        information in accordance with this policy.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Account Information</h3>
      <p>When you create an account, we collect:</p>
      <ul>
        <li>Email address</li>
        <li>Name (optional)</li>
        <li>Password (stored securely using bcrypt hashing)</li>
        <li>Organization name and details</li>
        <li>Billing information (processed by Stripe)</li>
      </ul>

      <h3>1.2 Voice and Audio Data</h3>
      <p>
        When you use our AI voice agent features, we may process the following:
      </p>
      <ul>
        <li>
          <strong>Voice recordings</strong> from calls handled by your AI Agents
        </li>
        <li>
          <strong>Transcriptions</strong> generated from speech-to-text
          processing
        </li>
        <li>
          <strong>AI-generated audio</strong> from text-to-speech synthesis
        </li>
        <li>
          <strong>Conversation logs</strong> including messages between users
          and AI Agents
        </li>
      </ul>

      <h3>1.3 Configuration Data</h3>
      <p>We store the configurations you create, including:</p>
      <ul>
        <li>AI Agent settings and system prompts</li>
        <li>SIP/VoIP credentials (encrypted at rest)</li>
        <li>API keys for third-party integrations (encrypted at rest)</li>
        <li>Knowledge base documents and embeddings</li>
        <li>Webhook configurations</li>
      </ul>

      <h3>1.4 Usage and Analytics Data</h3>
      <p>We automatically collect:</p>
      <ul>
        <li>Usage metrics (API calls, minutes used, agent activity)</li>
        <li>Log data (IP addresses, browser type, access times)</li>
        <li>Performance metrics and error logs</li>
        <li>Feature usage patterns</li>
      </ul>

      <h3>1.5 Cookies and Tracking</h3>
      <p>
        We use essential cookies for authentication and session management. We
        may use analytics tools to understand how users interact with our
        Service.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>
          <strong>Provide the Service:</strong> Process voice calls, run AI
          agents, store configurations, and deliver core functionality
        </li>
        <li>
          <strong>Improve the Service:</strong> Analyze usage patterns, fix
          bugs, and enhance features
        </li>
        <li>
          <strong>Customer Support:</strong> Respond to inquiries and resolve
          issues
        </li>
        <li>
          <strong>Billing:</strong> Process payments and manage subscriptions
        </li>
        <li>
          <strong>Security:</strong> Detect fraud, abuse, and security threats
        </li>
        <li>
          <strong>Communications:</strong> Send service updates, security
          alerts, and (with consent) marketing communications
        </li>
        <li>
          <strong>Legal Compliance:</strong> Comply with applicable laws and
          regulations
        </li>
      </ul>

      <h3>2.1 AI Model Training</h3>
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 my-4">
        <p className="mb-0">
          <strong>Note:</strong> We do NOT use your voice recordings or
          conversation data to train our own AI models. Your data is processed
          by third-party AI providers (see Section 3) according to their
          respective policies.
        </p>
      </div>

      <h2>3. Third-Party Service Providers</h2>
      <p>
        We share data with the following categories of third-party processors to
        provide the Service:
      </p>

      <h3>3.1 AI and Machine Learning Providers</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2">Provider</th>
            <th className="text-left py-2">Purpose</th>
            <th className="text-left py-2">Data Shared</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-800">
            <td className="py-2">OpenAI</td>
            <td className="py-2">LLM / Conversation AI</td>
            <td className="py-2">Text prompts, conversation context</td>
          </tr>
          <tr className="border-b border-slate-800">
            <td className="py-2">Anthropic</td>
            <td className="py-2">LLM / Conversation AI</td>
            <td className="py-2">Text prompts, conversation context</td>
          </tr>
          <tr className="border-b border-slate-800">
            <td className="py-2">Deepgram</td>
            <td className="py-2">Speech-to-Text</td>
            <td className="py-2">Audio recordings</td>
          </tr>
          <tr className="border-b border-slate-800">
            <td className="py-2">Groq</td>
            <td className="py-2">Fast Speech-to-Text</td>
            <td className="py-2">Audio recordings</td>
          </tr>
          <tr className="border-b border-slate-800">
            <td className="py-2">Cartesia</td>
            <td className="py-2">Text-to-Speech</td>
            <td className="py-2">Text for synthesis</td>
          </tr>
          <tr className="border-b border-slate-800">
            <td className="py-2">ElevenLabs</td>
            <td className="py-2">Text-to-Speech</td>
            <td className="py-2">Text for synthesis</td>
          </tr>
        </tbody>
      </table>

      <h3>3.2 Telephony Providers</h3>
      <ul>
        <li>
          <strong>LiveKit:</strong> Real-time audio/video infrastructure
        </li>
        <li>
          <strong>Your SIP Provider:</strong> Call routing and telephony (you
          provide your own)
        </li>
      </ul>

      <h3>3.3 Infrastructure and Business Services</h3>
      <ul>
        <li>
          <strong>Stripe:</strong> Payment processing
        </li>
        <li>
          <strong>Cloud hosting providers:</strong> Data storage and compute
        </li>
        <li>
          <strong>Analytics services:</strong> Usage analytics
        </li>
      </ul>

      <h2>4. Data Retention</h2>
      <h3>4.1 Your Data Ownership</h3>
      <p>
        <strong>You own your data.</strong> Voice recordings, conversation logs,
        configurations, and other Content you create belong to you.
      </p>

      <h3>4.2 Retention Periods</h3>
      <ul>
        <li>
          <strong>Account data:</strong> Retained while your account is active,
          deleted upon request or account closure
        </li>
        <li>
          <strong>Conversation logs:</strong> Retained for 90 days by default
          (configurable)
        </li>
        <li>
          <strong>Voice recordings:</strong> Retained for 30 days by default
          (configurable)
        </li>
        <li>
          <strong>Usage logs:</strong> Retained for 1 year for billing and
          analytics
        </li>
        <li>
          <strong>Backup data:</strong> May persist in backups for up to 30 days
          after deletion
        </li>
      </ul>

      <h3>4.3 Data Export</h3>
      <p>
        You may request an export of your data at any time by contacting us at
        alberto@cothink.pro.
      </p>

      <h2>5. Data Security</h2>
      <p>We implement industry-standard security measures including:</p>
      <ul>
        <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
        <li>Secure password hashing (bcrypt)</li>
        <li>API key encryption for stored credentials</li>
        <li>Regular security audits and updates</li>
        <li>Access controls and logging</li>
      </ul>
      <p>
        However, no system is 100% secure. You are responsible for maintaining
        the security of your account credentials.
      </p>

      <h2>6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>
          <strong>Access:</strong> Request a copy of your personal data
        </li>
        <li>
          <strong>Rectification:</strong> Correct inaccurate data
        </li>
        <li>
          <strong>Erasure:</strong> Request deletion of your data ("right to be
          forgotten")
        </li>
        <li>
          <strong>Portability:</strong> Receive your data in a structured format
        </li>
        <li>
          <strong>Objection:</strong> Object to certain processing activities
        </li>
        <li>
          <strong>Restriction:</strong> Limit how we use your data
        </li>
      </ul>
      <p>
        To exercise these rights, contact us at alberto@cothink.pro. We will
        respond within 30 days.
      </p>

      <h2>7. California Privacy Rights (CCPA)</h2>
      <p>If you are a California resident, you have the right to:</p>
      <ul>
        <li>
          Know what personal information we collect and how it is used
        </li>
        <li>Request deletion of your personal information</li>
        <li>Opt out of the "sale" of personal information</li>
        <li>Non-discrimination for exercising your privacy rights</li>
      </ul>
      <p>
        <strong>We do not sell your personal information.</strong>
      </p>

      <h2>8. European Privacy Rights (GDPR)</h2>
      <p>If you are in the European Economic Area (EEA), we process your data based on:</p>
      <ul>
        <li>
          <strong>Contract:</strong> To provide the Service you requested
        </li>
        <li>
          <strong>Legitimate Interest:</strong> For security, fraud prevention,
          and service improvement
        </li>
        <li>
          <strong>Consent:</strong> For optional features like marketing
          communications
        </li>
      </ul>
      <p>
        You may lodge a complaint with your local data protection authority if
        you believe we have violated your rights.
      </p>

      <h2>9. International Data Transfers</h2>
      <p>
        Your data may be transferred to and processed in the United States and
        other countries where our service providers operate. We ensure
        appropriate safeguards are in place for such transfers, including
        Standard Contractual Clauses where applicable.
      </p>

      <h2>10. Children's Privacy</h2>
      <p>
        VoxNexus is not intended for users under 18 years of age. We do not
        knowingly collect personal information from children. If we learn we
        have collected data from a child, we will delete it promptly.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of material changes by email or through the Service. Your continued use
        of VoxNexus after changes constitutes acceptance of the updated policy.
      </p>

      <h2>12. Contact Us</h2>
      <p>For privacy-related inquiries, please contact:</p>
      <p>
        <strong>Cothink LLC</strong>
        <br />
        Email: alberto@cothink.pro
        <br />
        Website: https://voxnexus.pro
      </p>

      <div className="mt-12 pt-8 border-t border-slate-700">
        <p className="text-slate-500 text-sm">
          By using VoxNexus, you acknowledge that you have read and understood
          this Privacy Policy.
        </p>
      </div>
    </>
  );
}
