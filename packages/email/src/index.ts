import { Resend } from "resend";

let client: Resend | null = null;

export function getEmailClient(apiKey: string): Resend {
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

const DEFAULT_FROM = "Kiai Hub <noreply@kiaihub.com>";

export { registrationConfirmedHtml } from "./templates/registration-confirmed.js";
export { paymentReceiptHtml } from "./templates/payment-receipt.js";
export { waiverSentHtml } from "./templates/waiver-sent.js";
export { waiverCompletedHtml } from "./templates/waiver-completed.js";

export async function sendEmail(apiKey: string, options: SendEmailOptions) {
  const resend = getEmailClient(apiKey);
  const { to, subject, html, from = DEFAULT_FROM, replyTo } = options;

  return resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo,
  });
}
