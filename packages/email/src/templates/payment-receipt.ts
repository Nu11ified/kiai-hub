export function paymentReceiptHtml(data: {
  participantName: string;
  eventName: string;
  amountFormatted: string;
  currency: string;
  paidAt: string;
  receiptUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Payment Receipt</h1>
  <p>Hi ${data.participantName},</p>
  <p>We've received your payment for <strong>${data.eventName}</strong>.</p>
  <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px; color: #666;">Amount Paid</p>
    <p style="margin: 0; font-size: 24px; font-weight: bold;">${data.amountFormatted} ${data.currency.toUpperCase()}</p>
    <p style="margin: 8px 0 0; color: #666; font-size: 14px;">Paid on ${data.paidAt}</p>
  </div>
  ${data.receiptUrl ? `<p><a href="${data.receiptUrl}" style="color: #2563eb;">View full receipt</a></p>` : ""}
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Kiai Hub — Kendo Event Management</p>
</body>
</html>`.trim();
}
