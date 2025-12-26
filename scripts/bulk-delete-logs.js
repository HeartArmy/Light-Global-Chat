const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Since models are in TypeScript, we need to create the schema directly
const logSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['error', 'warn', 'info', 'debug'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  route: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  userId: {
    type: String,
    default: null,
  },
  sessionId: {
    type: String,
    default: null,
  },
}, {
  timestamps: false,
});

// Index for efficient querying by timestamp and level
logSchema.index({ timestamp: -1 });
logSchema.index({ level: 1, timestamp: -1 });

// Prevent model recompilation in development
const Log = mongoose.models.Log || mongoose.model('Log', logSchema);

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

// Delete all logs except the latest 100
async function deleteOldLogs() {
  try {
    console.log('🔍 Finding total number of logs...');
    
    // Get total count of logs
    const totalLogs = await Log.countDocuments();
    console.log(`📊 Total logs in database: ${totalLogs}`);
    
    if (totalLogs <= 100) {
      console.log('✅ No logs to delete. Database already has 100 or fewer logs.');
      return 0;
    }
    
    // Find the 100th most recent log to determine the cutoff point
    const latestLogs = await Log.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .select('_id timestamp')
      .lean();
    
    if (latestLogs.length < 100) {
      console.log('⚠️  Fewer than 100 logs found. No logs will be deleted.');
      return 0;
    }
    
    // Get the timestamp of the 100th log (oldest in the top 100)
    const cutoffTimestamp = latestLogs[latestLogs.length - 1].timestamp;
    
    console.log(`⏰ Cutoff timestamp (100th most recent log): ${cutoffTimestamp.toISOString()}`);
    
    // Find all logs older than the cutoff timestamp
    const logsToDelete = await Log.find({
      timestamp: { $lt: cutoffTimestamp }
    }).sort({ timestamp: 1 }).select('_id level message route timestamp').lean();
    
    console.log(`📋 Found ${logsToDelete.length} logs to delete (older than cutoff):`);
    
    if (logsToDelete.length === 0) {
      console.log('❌ No logs found older than the cutoff timestamp.');
      return 0;
    }
    
    // Show first 10 logs as preview
    const preview = logsToDelete.slice(0, 10);
    preview.forEach((log, index) => {
      console.log(`${index + 1}. [${log._id}] ${log.level.toUpperCase()} ${log.route}: "${log.message.substring(0, 100)}${log.message.length > 100 ? '...' : ''}"`);
      console.log(`   Time: ${new Date(log.timestamp).toISOString()}\n`);
    });
    
    if (logsToDelete.length > 10) {
      console.log(`... and ${logsToDelete.length - 10} more logs`);
    }
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question(`⚠️  Are you sure you want to delete ${logsToDelete.length} logs (keeping latest 100)? (y/N): `, resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled.');
      return 0;
    }
    
    console.log('🗑️  Deleting old logs...');
    const result = await Log.deleteMany({
      timestamp: { $lt: cutoffTimestamp }
    });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} logs`);
    console.log(`📊 Remaining logs: ${totalLogs - result.deletedCount}`);
    
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    throw error;
  }
}

// Alternative function: Delete all logs (use with caution)
async function deleteAllLogs() {
  try {
    console.log('🔍 Counting total logs...');
    const totalLogs = await Log.countDocuments();
    console.log(`📊 Total logs in database: ${totalLogs}`);
    
    if (totalLogs === 0) {
      console.log('✅ No logs to delete.');
      return 0;
    }
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question(`⚠️  ⚠️  ⚠️  WARNING: This will delete ALL ${totalLogs} logs! Are you sure? (type 'yes' to confirm): `, resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled.');
      return 0;
    }
    
    console.log('🗑️  Deleting ALL logs...');
    const result = await Log.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} logs`);
    
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    throw error;
  }
}

// Main CLI interface
async function main() {
  await connectDB();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📝 Bulk Log Deletion Tool

Usage:
  node scripts/bulk-delete-logs.js [command]

Commands:
  keep-latest-100    Delete all logs except the latest 100 entries
  delete-all         Delete ALL logs (use with caution!)

Examples:
  # Keep only the latest 100 logs
  node scripts/bulk-delete-logs.js keep-latest-100

  # Delete all logs (dangerous!)
  node scripts/bulk-delete-logs.js delete-all
`);
    process.exit(0);
  }
  
  const command = args[0];
  
  try {
    if (command === 'keep-latest-100') {
      await deleteOldLogs();
    } else if (command === 'delete-all') {
      await deleteAllLogs();
    } else {
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "keep-latest-100" or "delete-all" commands');
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

module.exports = { deleteOldLogs, deleteAllLogs };