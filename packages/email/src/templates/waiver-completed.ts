export function waiverCompletedHtml(data: {
  participantName: string;
  eventName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Waiver Signed</h1>
  <p>Hi ${data.participantName},</p>
  <p>Your waiver for <strong>${data.eventName}</strong> has been received and confirmed.</p>
  <p style="color: #666; font-size: 14px;">If you have questions, contact the event organizer.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Kiai Hub — Kendo Event Management</p>
</body>
</html>`.trim();
}
