export function registrationConfirmedHtml(data: {
  participantName: string;
  eventName: string;
  eventDate: string;
  venueName?: string;
  registrationType: string;
  teamName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Registration Confirmed</h1>
  <p>Hi ${data.participantName},</p>
  <p>You're registered for <strong>${data.eventName}</strong>!</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px 0; color: #666;">Event</td><td style="padding: 8px 0;">${data.eventName}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0;">${data.eventDate}</td></tr>
    ${data.venueName ? `<tr><td style="padding: 8px 0; color: #666;">Venue</td><td style="padding: 8px 0;">${data.venueName}</td></tr>` : ""}
    <tr><td style="padding: 8px 0; color: #666;">Type</td><td style="padding: 8px 0;">${data.registrationType}${data.teamName ? ` (${data.teamName})` : ""}</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">If you have questions, contact the event organizer.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px;">Kiai Hub — Kendo Event Management</p>
</body>
</html>`.trim();
}
