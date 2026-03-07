/**
 * Email Service - Resend integration for transactional emails
 *
 * Supports Resend as primary email provider, with nodemailer fallback.
 * Set RESEND_API_KEY to use Resend, or SMTP_* vars for nodemailer.
 */

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using Resend (preferred) or nodemailer (fallback)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, html, from } = options;

  // Try Resend first
  const resend = getResendClient();
  if (resend) {
    try {
      const sender = from || process.env.RESEND_FROM || "onboarding@resend.dev";
      await resend.emails.send({
        from: sender,
        to,
        subject,
        html,
      });
      console.log(`[Email] Sent via Resend to ${to}`);
      return true;
    } catch (error) {
      console.error("[Email] Resend error:", error);
      // Fall through to nodemailer
    }
  }

  // Fallback to nodemailer if SMTP is configured
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: from || process.env.SMTP_FROM || "noreply@tradingbot.com",
        to,
        subject,
        html,
      });
      console.log(`[Email] Sent via SMTP to ${to}`);
      return true;
    } catch (error) {
      console.error("[Email] SMTP error:", error);
      return false;
    }
  }

  // No email provider configured
  console.warn("[Email] No email provider configured. Set RESEND_API_KEY or SMTP_* vars.");
  return false;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 40px; border: 1px solid #334155;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f8fafc; font-size: 24px; margin: 0;">Trading Bot</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 8px;">Recuperacion de contrasena</p>
        </div>

        <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6;">
          Hola,
        </p>
        <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6;">
          Has solicitado restablecer tu contrasena. Haz clic en el siguiente boton para crear una nueva:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Restablecer Contrasena
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          O copia y pega este enlace en tu navegador:
        </p>
        <p style="color: #60a5fa; font-size: 14px; word-break: break-all; background-color: #0f172a; padding: 12px; border-radius: 6px;">
          ${resetUrl}
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155;">
          <p style="color: #64748b; font-size: 13px; margin: 0;">
            Este enlace expirara en <strong>1 hora</strong>. Si no solicitaste este email, puedes ignorarlo de forma segura.
          </p>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            Trading Bot SaaS - Refocus Agency
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Restablecer contrasena - Trading Bot",
    html,
  });
}
