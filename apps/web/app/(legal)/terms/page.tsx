// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | VoxNexus",
  description: "Terms of Service for VoxNexus AI Voice Platform",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-slate-400 text-lg">
        Last Updated: January 8, 2026
      </p>

      <div className="my-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-400 font-semibold m-0">
          IMPORTANT: Please read these Terms carefully before using VoxNexus. By
          accessing or using our Service, you agree to be bound by these Terms.
          If you do not agree, do not use the Service.
        </p>
      </div>

      <h2>1. Definitions</h2>
      <ul>
        <li>
          <strong>"Company," "we," "us," or "our"</strong> refers to Cothink
          LLC, a Florida limited liability company, operating VoxNexus.
        </li>
        <li>
          <strong>"Service"</strong> refers to the VoxNexus platform, including
          the web application, APIs, AI voice agents, telephony integrations,
          and all related software and services.
        </li>
        <li>
          <strong>"User," "you," or "your"</strong> refers to any individual or
          entity accessing or using the Service.
        </li>
        <li>
          <strong>"Content"</strong> refers to any data, text, audio, voice
          recordings, configurations, or other materials uploaded, generated, or
          transmitted through the Service.
        </li>
        <li>
          <strong>"AI Agent"</strong> refers to any artificial intelligence
          voice agent created, configured, or deployed using the Service.
        </li>
      </ul>

      <h2>2. Acceptance of Terms</h2>
      <p>
        By creating an account, accessing, or using VoxNexus, you acknowledge
        that you have read, understood, and agree to be bound by these Terms of
        Service and our Privacy Policy. These Terms constitute a legally binding
        agreement between you and Cothink LLC.
      </p>
      <p>
        We reserve the right to modify these Terms at any time. Continued use of
        the Service after changes constitutes acceptance of the modified Terms.
      </p>

      <h2>3. Description of Service</h2>
      <p>
        VoxNexus is an AI-powered voice agent platform that enables users to
        create, configure, and deploy conversational AI agents for telephony and
        real-time voice applications. The Service includes:
      </p>
      <ul>
        <li>Web-based dashboard for agent configuration</li>
        <li>Integration with SIP/VoIP telephony systems</li>
        <li>Speech-to-text and text-to-speech capabilities</li>
        <li>Large Language Model (LLM) integrations</li>
        <li>Knowledge base and RAG (Retrieval-Augmented Generation) features</li>
        <li>API access for programmatic control</li>
      </ul>

      <h2 className="text-red-400">4. Acceptable Use Policy</h2>
      <div className="border-l-4 border-red-500 pl-4 my-6">
        <p>
          <strong className="text-red-400">
            YOU MUST NOT USE VOXNEXUS FOR ANY ILLEGAL, HARMFUL, OR UNETHICAL
            PURPOSES.
          </strong>{" "}
          Violation of this policy will result in immediate termination of your
          account and may be reported to law enforcement.
        </p>
      </div>

      <h3>4.1 Prohibited Uses</h3>
      <p>You expressly agree NOT to use the Service to:</p>

      <h4 className="text-red-400">Voice Cloning & Deepfakes</h4>
      <ul>
        <li>
          Clone, synthesize, or impersonate any person's voice{" "}
          <strong>without their explicit written consent</strong>
        </li>
        <li>
          Create "deepfake" audio content designed to deceive or mislead others
        </li>
        <li>
          Impersonate public figures, celebrities, or any third party without
          authorization
        </li>
        <li>
          Generate synthetic voice content for defamation, harassment, or fraud
        </li>
      </ul>

      <h4 className="text-red-400">Fraud & Scam Calls</h4>
      <ul>
        <li>
          Conduct robocalls, telemarketing, or automated calls without proper
          consent and compliance with TCPA, TSR, and applicable regulations
        </li>
        <li>Engage in phishing, vishing, or social engineering attacks</li>
        <li>Impersonate banks, government agencies, or other institutions</li>
        <li>
          Conduct financial fraud, identity theft, or any deceptive practices
        </li>
        <li>Make threats or demands for money, cryptocurrency, or assets</li>
      </ul>

      <h4 className="text-red-400">Harassment & Abuse</h4>
      <ul>
        <li>Harass, stalk, threaten, or intimidate any person</li>
        <li>
          Make repeated unwanted calls to individuals who have requested no
          contact
        </li>
        <li>Transmit hate speech, discriminatory content, or abuse</li>
        <li>Target vulnerable populations including minors and the elderly</li>
      </ul>

      <h4 className="text-red-400">Other Prohibited Activities</h4>
      <ul>
        <li>Violate any local, state, national, or international law</li>
        <li>Infringe on intellectual property rights of others</li>
        <li>Transmit malware, viruses, or malicious code</li>
        <li>Attempt to bypass security measures or access restrictions</li>
        <li>Resell or redistribute the Service without authorization</li>
        <li>Use the Service in any manner that could damage our reputation</li>
      </ul>

      <h3>4.2 Compliance Responsibility</h3>
      <p>
        <strong>
          You are solely responsible for ensuring your use of VoxNexus complies
          with all applicable laws and regulations,
        </strong>{" "}
        including but not limited to:
      </p>
      <ul>
        <li>Telephone Consumer Protection Act (TCPA)</li>
        <li>Telemarketing Sales Rule (TSR)</li>
        <li>General Data Protection Regulation (GDPR)</li>
        <li>California Consumer Privacy Act (CCPA)</li>
        <li>All-party consent laws for call recording</li>
        <li>Any other applicable telecommunications regulations</li>
      </ul>

      <h2 className="text-yellow-400">
        5. AI Disclaimer & Limitation of Liability
      </h2>
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 my-6">
        <h3 className="text-yellow-400 mt-0">
          IMPORTANT: AI SYSTEMS MAY PRODUCE INCORRECT OR HARMFUL OUTPUT
        </h3>
        <p>
          <strong>
            VoxNexus uses artificial intelligence and large language models
            (LLMs) that may "hallucinate," produce factually incorrect
            information, give inappropriate advice, or generate unexpected
            responses.
          </strong>
        </p>
        <p className="mb-0">
          <strong className="text-yellow-400">
            COTHINK LLC IS NOT RESPONSIBLE FOR:
          </strong>
        </p>
        <ul className="mt-2">
          <li>
            Any advice, information, or statements made by AI Agents created
            using the Service
          </li>
          <li>
            Decisions made by you or third parties based on AI-generated content
          </li>
          <li>Financial, legal, medical, or professional advice from AI Agents</li>
          <li>
            Any damages, losses, or harm resulting from AI hallucinations or
            errors
          </li>
          <li>Actions taken by end-users who interact with your AI Agents</li>
        </ul>
      </div>
      <p>
        You acknowledge that AI technology is experimental and evolving. You
        agree to implement appropriate safeguards, human oversight, and
        disclaimers when deploying AI Agents for any purpose.
      </p>

      <h2 className="text-red-400">6. Telephony Disclaimer</h2>
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 my-6">
        <h3 className="text-red-400 mt-0">
          CRITICAL: VOXNEXUS IS NOT A TELEPHONE SERVICE
        </h3>
        <p>
          <strong className="text-red-400">
            VOXNEXUS DOES NOT PROVIDE E911 OR EMERGENCY CALLING SERVICES.
          </strong>
        </p>
        <p>
          <strong>
            YOU CANNOT AND MUST NOT ATTEMPT TO CALL 911 OR ANY EMERGENCY SERVICES
            USING VOXNEXUS.
          </strong>{" "}
          VoxNexus is a software platform for AI voice agents and is NOT a
          replacement for traditional telephone service.
        </p>
        <p className="mb-0">
          Cothink LLC shall not be liable for any failure to connect to emergency
          services, including but not limited to 911, police, fire, or medical
          services. You must maintain a separate means of accessing emergency
          services.
        </p>
      </div>

      <h3>6.1 No Guaranteed Uptime</h3>
      <p>
        VoxNexus telephony integrations depend on third-party providers
        (SIP/VoIP carriers) and infrastructure that may experience outages,
        latency, or failures. We do not guarantee:
      </p>
      <ul>
        <li>Continuous, uninterrupted service availability</li>
        <li>Call quality or audio fidelity</li>
        <li>Successful call completion or connection</li>
        <li>Compatibility with all telephony systems</li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <h3>7.1 Our Intellectual Property</h3>
      <p>
        VoxNexus, including its source code, design, trademarks, and
        documentation, is the property of Cothink LLC or its licensors. The
        open-source components are licensed under the Apache 2.0 License.
      </p>

      <h3>7.2 Your Content</h3>
      <p>
        You retain ownership of Content you upload or create using the Service.
        By using VoxNexus, you grant us a limited license to process your Content
        solely to provide the Service.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <div className="bg-slate-800 rounded-lg p-6 my-6 border border-slate-700">
        <p className="font-mono text-sm mb-0">
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES
          OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
          IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, TITLE, AND NON-INFRINGEMENT.
        </p>
        <p className="font-mono text-sm mt-4 mb-0">
          COTHINK LLC DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
        </p>
        <p className="font-mono text-sm mt-4 mb-0">
          THE SERVICE MAY BE IN BETA OR DEVELOPMENT AND MAY CONTAIN BUGS,
          ERRORS, AND INCOMPLETE FEATURES.
        </p>
      </div>

      <h2 className="text-yellow-400">9. Limitation of Liability</h2>
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 my-6">
        <p>
          <strong>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, COTHINK LLC SHALL
            NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
            OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </strong>
        </p>
        <ul>
          <li>Loss of profits, revenue, or business opportunities</li>
          <li>Loss of data or Content</li>
          <li>Business interruption</li>
          <li>Damages arising from AI-generated content or errors</li>
          <li>Damages arising from telephony failures or outages</li>
          <li>Third-party claims against you</li>
        </ul>
        <p className="font-bold text-yellow-400">
          IN NO EVENT SHALL COTHINK LLC'S TOTAL LIABILITY EXCEED THE GREATER OF:
          (A) THE AMOUNT YOU PAID TO US IN THE SIX (6) MONTHS PRECEDING THE
          CLAIM, OR (B) ONE HUNDRED DOLLARS ($100 USD).
        </p>
        <p className="mb-0">
          This limitation applies regardless of the theory of liability (contract,
          tort, strict liability, or otherwise) and even if we have been advised
          of the possibility of such damages.
        </p>
      </div>

      <h2 className="text-red-400">10. Indemnification</h2>
      <div className="border-l-4 border-red-500 pl-4 my-6">
        <p>
          <strong>
            YOU AGREE TO INDEMNIFY, DEFEND, AND HOLD HARMLESS COTHINK LLC, ITS
            OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES FROM AND
            AGAINST ANY AND ALL CLAIMS, DAMAGES, LOSSES, LIABILITIES, COSTS, AND
            EXPENSES (INCLUDING REASONABLE ATTORNEYS' FEES) ARISING FROM:
          </strong>
        </p>
        <ul>
          <li>Your use of the Service</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any law or regulation</li>
          <li>Your infringement of any third-party rights</li>
          <li>Content you create, upload, or transmit</li>
          <li>AI Agents you deploy and their interactions with third parties</li>
          <li>Any claims made by recipients of calls from your AI Agents</li>
        </ul>
        <p className="mb-0">
          This indemnification obligation shall survive termination of your
          account and these Terms.
        </p>
      </div>

      <h2>11. Account Termination</h2>
      <p>
        We reserve the right to suspend or terminate your account at any time,
        with or without cause, and with or without notice. Upon termination:
      </p>
      <ul>
        <li>Your right to access the Service immediately ceases</li>
        <li>We may delete your Content and data</li>
        <li>You remain liable for any outstanding fees</li>
        <li>Sections 5-10 of these Terms survive termination</li>
      </ul>

      <h2>12. Governing Law & Dispute Resolution</h2>
      <p>
        These Terms shall be governed by the laws of the State of Florida, USA,
        without regard to conflict of law principles.
      </p>
      <p>
        Any disputes arising from these Terms or the Service shall be resolved
        through binding arbitration in accordance with the rules of the American
        Arbitration Association, conducted in Florida. You waive any right to a
        jury trial or to participate in a class action.
      </p>

      <h2>13. Severability</h2>
      <p>
        If any provision of these Terms is found to be unenforceable, the
        remaining provisions shall continue in full force and effect.
      </p>

      <h2>14. Entire Agreement</h2>
      <p>
        These Terms, together with our Privacy Policy, constitute the entire
        agreement between you and Cothink LLC regarding the Service.
      </p>

      <h2>15. Contact Information</h2>
      <p>For questions about these Terms, please contact:</p>
      <p>
        <strong>Cothink LLC</strong>
        <br />
        Email: alberto@cothink.pro
        <br />
        Website: https://voxnexus.pro
      </p>

      <div className="mt-12 pt-8 border-t border-slate-700">
        <p className="text-slate-500 text-sm">
          By using VoxNexus, you acknowledge that you have read, understood, and
          agree to be bound by these Terms of Service.
        </p>
      </div>
    </>
  );
}
