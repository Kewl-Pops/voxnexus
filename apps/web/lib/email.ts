// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@cothink.pro";
const APP_URL = process.env.NEXTAUTH_URL || "https://voxnexus.pro";

// Check if SMTP is configured
export function isEmailConfigured(): boolean {
  return !!SMTP_HOST;
}

// Create transporter
function createTransporter() {
  const config: nodemailer.TransportOptions = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    requireTLS: SMTP_PORT === 587,
    tls: {
      rejectUnauthorized: false,
    },
  } as nodemailer.TransportOptions;

  // Add auth only if credentials are provided
  if (SMTP_USER && SMTP_PASSWORD) {
    (config as Record<string, unknown>).auth = {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    };
  }

  return nodemailer.createTransport(config);
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Send email function
async function sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("SMTP not configured, email not sent:", template.subject);
    return false;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    console.log(`Email sent to ${to}: ${template.subject}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

function getPasswordResetTemplate(resetUrl: string, userName?: string): EmailTemplate {
  const name = userName || "there";
  return {
    subject: "Reset Your VoxNexus Password",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 28px; font-weight: bold; color: #ffffff;">
                Vox<span style="color: #10b981;">Nexus</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #1e293b; border-radius: 16px; padding: 40px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">
                Reset Your Password
              </h1>

              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #94a3b8; text-align: center;">
                Hi ${name},<br><br>
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 20px; color: #64748b; text-align: center;">
                This link will expire in 1 hour.
              </p>

              <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 18px; color: #475569; text-align: center; word-break: break-all;">
                Or copy this link: ${resetUrl}
              </p>

              <p style="margin: 0; font-size: 14px; line-height: 20px; color: #64748b; text-align: center;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                &copy; 2026 Cothink LLC. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #475569;">
                <a href="${APP_URL}" style="color: #10b981; text-decoration: none;">voxnexus.pro</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
VoxNexus - Reset Your Password

Hi ${name},

We received a request to reset your password. Visit this link to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

© 2026 Cothink LLC. All rights reserved.
    `,
  };
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName?: string
): Promise<boolean> {
  const template = getPasswordResetTemplate(resetUrl, userName);
  return sendEmail(to, template);
}
