const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Try loading environment variables from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('⚠️  No .env.local or .env file found. Will try to use environment variables directly.');
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is not defined.');
  console.error('Please make sure MONGODB_URI is set in .env.local or .env');
  process.exit(1);
}

// Define the Message schema directly since the app uses TypeScript and we want standard JS execution
const attachmentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  url: { type: String, required: true },
  name: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  userName: { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  userName: { type: String, required: true },
  userCountry: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  attachments: { type: [attachmentSchema], default: [] },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  reactions: { type: [reactionSchema], default: [] },
  edited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
}, { timestamps: false });

messageSchema.index({ timestamp: 1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// Helper for deterministic color mapping for usernames to make the chat readable
function getUsernameColor(username) {
  const colors = [
    '\x1b[32m', // Green
    '\x1b[33m', // Yellow
    '\x1b[34m', // Blue
    '\x1b[35m', // Magenta
    '\x1b[36m', // Cyan
    '\x1b[92m', // Bright Green
    '\x1b[93m', // Bright Yellow
    '\x1b[94m', // Bright Blue
    '\x1b[95m', // Bright Magenta
    '\x1b[96m', // Bright Cyan
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Helper to convert 2-letter country code to emoji flag
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '🌐';
  }
}

// ANSI Escape Codes for formatting
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const UNDERLINE = '\x1b[4m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

async function main() {
  const args = process.argv.slice(2);
  // Default to 2026-01-03 as specified in the request
  let targetDateStr = '2026-01-03';
  let sortOrder = 1; // 1 for ascending (chronological), -1 for descending
  let useUTC = false;

  // Simple argument parsing
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' || args[i] === '-d') {
      targetDateStr = args[i + 1];
      i++;
    } else if (args[i] === '--desc') {
      sortOrder = -1;
    } else if (args[i] === '--asc') {
      sortOrder = 1;
    } else if (args[i] === '--utc') {
      useUTC = true;
    } else if (!args[i].startsWith('-')) {
      targetDateStr = args[i];
    }
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    console.error(`❌ ${RED}${BOLD}Error:${RESET} Invalid date format "${targetDateStr}". Please use YYYY-MM-DD.`);
    process.exit(1);
  }

  const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  if (isNaN(startOfDay.getTime())) {
    console.error(`❌ ${RED}${BOLD}Error:${RESET} Invalid date "${targetDateStr}".`);
    process.exit(1);
  }

  console.log(`🌐 Connecting to MongoDB...`);
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`✅ Connected successfully.`);
  } catch (error) {
    console.error(`❌ ${RED}${BOLD}MongoDB Connection Error:${RESET}`, error.message);
    process.exit(1);
  }

  try {
    console.log(`🔍 Fetching messages for UTC day ${BOLD}${targetDateStr}${RESET}...`);
    
    const messages = await Message.find({
      timestamp: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .sort({ timestamp: sortOrder })
    .populate('replyTo', 'userName')
    .lean();

    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    const tzDisplay = useUTC ? 'UTC' : localTz;

    console.log(`\n================================================================================`);
    console.log(`💬  ${BOLD}CHAT HISTORY FOR ${targetDateStr}${RESET}  (Total: ${messages.length} messages | Timezone: ${tzDisplay})`);
    console.log(`================================================================================\n`);

    if (messages.length === 0) {
      console.log(`   ${DIM}No messages found for this day.${RESET}\n`);
    } else {
      messages.forEach(msg => {
        let timeStr = '';
        if (useUTC) {
          timeStr = new Date(msg.timestamp).toISOString().split('T')[1].substring(0, 8);
        } else {
          const d = new Date(msg.timestamp);
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          const seconds = String(d.getSeconds()).padStart(2, '0');
          timeStr = `${hours}:${minutes}:${seconds}`;
        }
        
        const flag = getFlagEmoji(msg.userCountry);
        const userColor = getUsernameColor(msg.userName);
        
        let header = `${DIM}[${timeStr}]${RESET} ${flag} ${userColor}${BOLD}${msg.userName}${RESET}`;
        
        if (msg.replyTo) {
          const replyTarget = typeof msg.replyTo === 'object' ? msg.replyTo.userName : 'unknown';
          header += ` ${DIM}${ITALIC}(replying to @${replyTarget})${RESET}`;
        }
        
        console.log(header);
        
        // Print message content with indent
        const contentColor = msg.userName === 'gemmie' ? MAGENTA : '';
        console.log(`   ${contentColor}${msg.content}${RESET}`);
        
        // Attachments
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach(att => {
            const sizeStr = att.size ? ` (${(att.size / 1024 / 1024).toFixed(2)} MB)` : '';
            console.log(`   ${DIM}📎 [Attachment: ${att.type} - ${att.name}${sizeStr}]${RESET}`);
            console.log(`      ${DIM}${UNDERLINE}${att.url}${RESET}`);
          });
        }
        
        // Reactions
        if (msg.reactions && msg.reactions.length > 0) {
          const reactionCounts = {};
          msg.reactions.forEach(r => {
            reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
          });
          const reactionList = Object.entries(reactionCounts)
            .map(([emoji, count]) => `${emoji} ${count > 1 ? count : ''}`)
            .join('  ');
          console.log(`   ${DIM}└─ ${reactionList}${RESET}`);
        }
        
        // Blank line between messages for readability
        console.log();
      });
    }

    console.log(`================================================================================`);
    console.log(`✨  End of logs for ${targetDateStr}`);
    console.log(`================================================================================\n`);

  } catch (error) {
    console.error(`❌ ${RED}${BOLD}Error retrieving messages:${RESET}`, error.message);
  } finally {
    await mongoose.disconnect();
    console.log(`🔌 Disconnected from MongoDB`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
