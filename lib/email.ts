import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Track last email sent time
let lastEmailSent = 0;
const TWO_HOURS = 2 * 60 * 60 * 1000;

export async function sendNewMessageNotification(userName: string, content: string, messageTimestamp: Date) {
  // Check if 2 hours have passed since last email
  const now = messageTimestamp.getTime();
  if (now - lastEmailSent < TWO_HOURS) {
    console.log('Email cooldown active, skipping notification');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL_TO,
      subject: `New message in Global Chat from ${userName}`,
      text: `${userName} sent a message:\n\n${content}\n\nCheck it out at: ${process.env.NEXT_PUBLIC_SITE_URL}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007aff;">🌐 New Message in Global Chat</h2>
          <p><strong>From:</strong> ${userName}</p>
          <div style="background: #f5f5f7; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${content}</p>
          </div>
          <p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color: #007aff; text-decoration: none;">
              View in chat room →
            </a>
          </p>
        </div>
      `,
    });

    lastEmailSent = now;
    console.log('Email notification sent successfully');
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}
