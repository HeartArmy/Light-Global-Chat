import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

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

const TWO_HOURS = 2 * 60 * 60 * 1000;
const COOLDOWN_FILE = path.join(process.cwd(), '.email-cooldown');

// Get last email sent time from file
function getLastEmailSent(): number {
  try {
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = fs.readFileSync(COOLDOWN_FILE, 'utf-8');
      return parseInt(data) || 0;
    }
  } catch (error) {
    console.error('Error reading cooldown file:', error);
  }
  return 0;
}

// Save last email sent time to file
function saveLastEmailSent(timestamp: number): void {
  try {
    fs.writeFileSync(COOLDOWN_FILE, timestamp.toString());
  } catch (error) {
    console.error('Error writing cooldown file:', error);
  }
}

export async function sendNewMessageNotification(
  userName: string, 
  content: string, 
  timestamp: Date,
  countryCode: string
) {
  // Check if 2 hours have passed since last email
  const now = Date.now();
  const lastEmailSent = getLastEmailSent();
  if (now - lastEmailSent < TWO_HOURS) {
    const remainingMinutes = Math.ceil((TWO_HOURS - (now - lastEmailSent)) / 60000);
    console.log(`Email cooldown active, skipping notification. ${remainingMinutes} minutes remaining.`);
    return;
  }

  // Don't send email if the message is from Arham
  if (userName.toLowerCase() === 'arham') {
    return;
  }

  // Get country flag emoji
  const getCountryFlag = (code: string) => {
    if (code === 'XX' || !code) return '🌍';
    const codePoints = code.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397);
    return String.fromCodePoint(...codePoints);
  };

  const flag = getCountryFlag(countryCode);
  const formattedTime = timestamp.toUTCString();
  const localTime = timestamp.toLocaleString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL_TO,
      subject: `${flag} New message from ${userName} in Global Chat`,
      text: `${userName} ${flag} sent a message:\n\n${content}\n\nSent at: ${formattedTime}\nCountry: ${countryCode}\n\nCheck it out at: ${process.env.NEXT_PUBLIC_SITE_URL}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007aff;">🌐 New Message in Global Chat</h2>
          <div style="background: #f5f5f7; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${userName} ${flag}</p>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">
              <strong>Time (UTC):</strong> ${formattedTime}
            </p>
            <p style="margin: 0; font-size: 13px; color: #666;">
              <strong>Time (Local):</strong> ${localTime}
            </p>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">
              <strong>Country:</strong> ${countryCode} ${flag}
            </p>
          </div>
          <div style="background: #ffffff; padding: 16px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #007aff;">
            <p style="margin: 0; white-space: pre-wrap; color: #000;">${content}</p>
          </div>
          <p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="display: inline-block; background: #007aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
              View in chat room →
            </a>
          </p>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">
            You're receiving this because someone posted in the Global Chat Room. Notifications are sent at most once every 2 hours.
          </p>
        </div>
      `,
    });

    saveLastEmailSent(now);
    console.log('Email notification sent successfully');
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}
