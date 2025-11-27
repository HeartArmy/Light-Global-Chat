const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Since models are in TypeScript, we need to create the schema directly
const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: false,
    default: '',
    maxlength: 5000,
  },
  userName: {
    type: String,
    required: true,
    maxlength: 30,
  },
  userCountry: {
    type: String,
    required: true,
    length: 2,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  attachments: {
    type: Array,
    default: [],
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  reactions: {
    type: Array,
    default: [],
  },
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: false,
});

// Index for efficient querying by timestamp
messageSchema.index({ timestamp: -1 });

// Prevent model recompilation in development
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// List messages with filtering options
async function listMessages(options = {}) {
  const filter = {};
  
  // Apply filters
  if (options.userName) filter.userName = new RegExp(options.userName, 'i');
  if (options.userCountry) filter.userCountry = options.userCountry.toUpperCase();
  if (options.content) filter.content = new RegExp(options.content, 'i');
  if (options.fromDate) filter.timestamp = { $gte: new Date(options.fromDate) };
  if (options.toDate) filter.timestamp = { ...filter.timestamp, $lte: new Date(options.toDate) };
  
  const messages = await Message.find(filter)
    .sort({ timestamp: -1 })
    .limit(options.limit || 20)
    .select('_id userName userCountry content timestamp')
    .lean();
  
  return messages;
}

// Delete messages by various criteria
async function deleteMessages(options = {}) {
  
  const filter = {};
  
  // Apply filters
  if (options.userName) filter.userName = new RegExp(options.userName, 'i');
  if (options.userCountry) filter.userCountry = options.userCountry.toUpperCase();
  if (options.content) filter.content = new RegExp(options.content, 'i');
  if (options.fromDate) filter.timestamp = { $gte: new Date(options.fromDate) };
  if (options.toDate) filter.timestamp = { ...filter.timestamp, $lte: new Date(options.toDate) };
  if (options.ids) filter._id = { $in: options.ids };
  
  console.log('🔍 Finding messages to delete...');
  const messagesToDelete = await Message.find(filter)
    .select('_id userName userCountry content timestamp')
    .lean();
  
  console.log(`📋 Found ${messagesToDelete.length} messages to delete:`);
  
  if (messagesToDelete.length === 0) {
    console.log('❌ No messages found matching the criteria.');
    return 0;
  }
  
  // Show first 10 messages as preview
  const preview = messagesToDelete.slice(0, 10);
  preview.forEach((msg, index) => {
    console.log(`${index + 1}. [${msg._id}] ${msg.userName} (${msg.userCountry}): "${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}"`);
  });
  
  if (messagesToDelete.length > 10) {
    console.log(`... and ${messagesToDelete.length - 10} more messages`);
  }
  
  // Ask for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    readline.question(`⚠️  Are you sure you want to delete ${messagesToDelete.length} messages? (y/N): `, resolve);
  });
  
  readline.close();
  
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('❌ Deletion cancelled.');
    return 0;
  }
  
  console.log('🗑️  Deleting messages...');
  const result = await Message.deleteMany(filter);
  
  console.log(`✅ Successfully deleted ${result.deletedCount} messages`);
  return result.deletedCount;
}

// Main CLI interface
async function main() {
  await connectDB();
  
  // Handle npm argument parsing - npm passes extra args, so we need to skip them
  const args = process.argv.slice(2);
  
  // Skip npm-specific arguments that get passed through
  const filteredArgs = args.filter(arg => !arg.startsWith('--'));
  
  if (filteredArgs.length === 0) {
    console.log(`
📝 Bulk Message Deletion Tool

Usage:
  npm run delete-messages [command] [options]

Commands:
  list        List messages matching criteria
  delete      Delete messages matching criteria

Options for list/delete:
  --user "name"       Filter by username (partial match, case insensitive)
  --country "US"      Filter by 2-letter country code
  --content "text"    Filter by content (partial match, case insensitive)
  --from "2024-01-01" Filter by date (YYYY-MM-DD format)
  --to "2024-12-31"   Filter by date (YYYY-MM-DD format)
  --limit 20          Limit number of results (default: 20)
  --ids "id1,id2,id3"  Delete specific message IDs (comma-separated)

Examples:
  # List recent messages from user "sarah"
  npm run delete-messages list --user "sarah" --limit 10

  # Delete all messages from country "US"
  npm run delete-messages delete --country "US"

  # Delete messages containing "test" from 2024
  npm run delete-messages delete --content "test" --from "2024-01-01" --to "2024-12-31"

  # Delete specific message IDs
  npm run delete-messages delete --ids "60d5f7f3b54764421b7156c1,60d5f7f3b54764421b7156c2"
`);
    process.exit(0);
  }
  
  const command = filteredArgs[0];
  const options = {};
  
  // Parse the original args (including -- flags) but skip npm-specific ones
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      const nextArg = args[i + 1];
      
      if (key === 'ids') {
        options[key] = nextArg ? nextArg.split(',').map(id => id.trim()) : [];
        i++; // Skip next argument
      } else if (key === 'limit' || key === 'from' || key === 'to') {
        options[key] = nextArg;
        i++; // Skip next argument
      } else {
        options[key] = nextArg || true;
        if (nextArg && !nextArg.startsWith('--')) i++; // Skip next argument if it's not another flag
      }
    }
  }
  
  try {
    if (command === 'list') {
      const messages = await listMessages(options);
      console.log(`\n📋 Found ${messages.length} messages:`);
      messages.forEach((msg, index) => {
        console.log(`${index + 1}. [${msg._id}] ${msg.userName} (${msg.userCountry}): "${msg.content}"`);
        console.log(`   Time: ${new Date(msg.timestamp).toISOString()}\n`);
      });
    } else if (command === 'delete') {
      await deleteMessages(options);
    } else {
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "list" or "delete" commands');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔓 Disconnected from MongoDB');
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { listMessages, deleteMessages };