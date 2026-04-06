export function waiverSentHtml(data: {
  participantName: string;
  signerName: string;
  eventName: string;
  isMinor: boolean;
}): string {
  const minorNote = data.isMinor
    ? `<p style="color: #666; font-size: 14px;">As the guardian of <strong>${data.participantName}</strong>, your signature is required.</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Waiver Required</h1>
  <p>Hi ${data.signerName},</p>
  <p>A waiver is required for participation in <strong>${data.eventName}</strong>.</p>
  ${minorNote}
  <p>You should receive a separate email from DocuSeal with the waiver document to sign.</p>
  <p style="color: #666; font-size: 14px;">Registration will be confirmed once the waiver is signed and any required payment is completed.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Kiai Hub — Kendo Event Management</p>
</body>
</html>`.trim();
}
