import nodemailer from 'nodemailer';
import connectDB from '@/lib/mongodb';
import Notification from '@/models/Notification';

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

const ONE_HOUR = 60 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

// Check if enough time has passed since last notification
async function canSendNotification(type: 'email' | 'telegram'): Promise<boolean> {
  try {
    await connectDB();
    const cooldown = type === 'email' ? ONE_HOUR : FIVE_MINUTES;
    
    const notification = await Notification.findOne({ type });
    
    if (!notification) {
      return true;
    }
    
    const timeSinceLastSent = Date.now() - notification.lastSentAt.getTime();
    return timeSinceLastSent >= cooldown;
  } catch (error) {
    console.error(`Error checking ${type} cooldown:`, error);
    return false;
  }
}

// Update last sent time in database
async function updateNotificationTime(type: 'email' | 'telegram'): Promise<void> {
  try {
    await connectDB();
    await Notification.findOneAndUpdate(
      { type },
      { lastSentAt: new Date() },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Error updating ${type} notification time:`, error);
  }
}

// Send Telegram notification
async function sendTelegramNotification(
  userName: string,
  content: string,
  timestamp: Date,
  countryCode: string,
  ipAddress: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('Telegram credentials not configured, skipping notification');
    return;
  }

  const getCountryFlag = (code: string) => {
    if (code === 'XX' || !code) return '🌍';
    const codePoints = code.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397);
    return String.fromCodePoint(...codePoints);
  };

  const flag = getCountryFlag(countryCode);
  const formattedTime = timestamp.toUTCString();

  const message = `🌐 *New Message in Global Chat*\n\n` +
    `👤 *From:* ${userName} ${flag}\n` +
    `🌍 *Country:* ${countryCode}\n` +
    `🌐 *IP:* \`${ipAddress}\`\n` +
    `🕐 *Time:* ${formattedTime}\n\n` +
    `💬 *Message:*\n${content}\n\n` +
    `🔗 [View in chat room](${process.env.NEXT_PUBLIC_SITE_URL})`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
    } else {
      console.log('Telegram notification sent successfully');
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

export async function sendNewMessageNotification(
  userName: string, 
  content: string, 
  timestamp: Date,
  countryCode: string,
  ipAddress: string
) {
  // Don't send notifications if the message is from Arham
  if (userName.toLowerCase() === 'arham') {
    console.log('Skipping notifications for message from Arham');
    return;
  }

  // Send Telegram notification (5-minute cooldown)
  const canSendTelegram = await canSendNotification('telegram');
  if (canSendTelegram) {
    await sendTelegramNotification(userName, content, timestamp, countryCode, ipAddress);
    await updateNotificationTime('telegram');
  } else {
    console.log('Telegram cooldown active, skipping notification');
  }

  // Email notifications disabled - only using Telegram
  // const canSendEmail = await canSendNotification('email');
  // if (!canSendEmail) {
  //   console.log('Email cooldown active, skipping notification');
  //   return;
  // }

  // // Get country flag emoji
  // const getCountryFlag = (code: string) => {
  //   if (code === 'XX' || !code) return '🌍';
  //   const codePoints = code.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397);
  //   return String.fromCodePoint(...codePoints);
  // };

  // const flag = getCountryFlag(countryCode);
  // const formattedTime = timestamp.toUTCString();
  // const localTime = timestamp.toLocaleString('en-US', { 
  //   weekday: 'short', 
  //   year: 'numeric', 
  //   month: 'short', 
  //   day: 'numeric', 
  //   hour: '2-digit', 
  //   minute: '2-digit',
  //   second: '2-digit',
  //   timeZoneName: 'short'
  // });

  // try {
  //   await transporter.sendMail({
  //     from: process.env.SMTP_USER,
  //     to: process.env.NOTIFY_EMAIL_TO,
  //     subject: `${flag} New message from ${userName} in Global Chat`,
  //     text: `${userName} ${flag} sent a message:\n\n${content}\n\nSent at: ${formattedTime}\nCountry: ${countryCode}\n\nCheck it out at: ${process.env.NEXT_PUBLIC_SITE_URL}`,
  //     html: `
  //       <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  //         <h2 style="color: #007aff;">🌐 New Message in Global Chat</h2>
  //         <div style="background: #f5f5f7; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
  //           <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${userName} ${flag}</p>
  //           <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">
  //             <strong>Time (UTC):</strong> ${formattedTime}
  //           </p>
  //           <p style="margin: 0; font-size: 13px; color: #666;">
  //             <strong>Time (Local):</strong> ${localTime}
  //           </p>
  //           <p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">
  //             <strong>Country:</strong> ${countryCode} ${flag}
  //           </p>
  //         </div>
  //         <div style="background: #ffffff; padding: 16px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #007aff;">
  //           <p style="margin: 0; white-space: pre-wrap; color: #000;">${content}</p>
  //         </div>
  //         <p>
  //           <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="display: inline-block; background: #007aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">
  //             View in chat room →
  //           </a>
  //         </p>
  //         <p style="font-size: 12px; color: #999; margin-top: 24px;">
  //           You're receiving this because someone posted in the Global Chat Room. Notifications are sent at most once every 2 hours.
  //         </p>
  //       </div>
  //     `,
  //   });

  //   await updateNotificationTime('email');
  //   console.log('Email notification sent successfully');
  // } catch (error) {
  //   console.error('Failed to send email notification:', error);
  // }
}
