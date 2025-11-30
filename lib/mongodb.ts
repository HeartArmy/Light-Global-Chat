import Log from '@/models/Log';
import mongoose from 'mongoose';

// === CONSOLE LOGGING PATCHING ===
// Helper function to convert arguments to string
function argsToString(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    return JSON.stringify(arg);
  }).join(' ');
}

// Helper function to extract route from call stack
function extractRouteFromStack(): string {
  const stack = new Error().stack;
  if (!stack) return 'unknown';
  
  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/\/(app|pages)\/([^/]+)/);
    if (match) {
      const [, type, path] = match;
      if (type === 'app') {
        if (path.startsWith('api/')) {
          return `/api/${path.split('/')[1]}`;
        }
        return `/${path}`;
      }
    }
  }
  return 'unknown';
}

// Save log to MongoDB
async function saveToMongoDB(level: string, message: string, args: any[] = []) {
  console.log('🔍 saveToMongoDB called:', level, message.substring(0, 50));
  try {
    await connectDB();
    
    const logEntry = new Log({
      level,
      message,
      meta: {
        originalArgs: args,
        timestamp: new Date(),
      },
      route: extractRouteFromStack(),
    });

    await logEntry.save();
    console.log('✅ Log saved to MongoDB:', level);
  } catch (error) {
    console.error('❌ Failed to save log to MongoDB:', error);
  }
}

// Patch console methods
const originalLog = console.log;
console.log = (...args) => {
  const message = argsToString(args);
  saveToMongoDB('info', message, args);
  originalLog(...args);
};

const originalError = console.error;
console.error = (...args) => {
  const message = argsToString(args);
  saveToMongoDB('error', message, args);
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args) => {
  const message = argsToString(args);
  saveToMongoDB('warn', message, args);
  originalWarn(...args);
};

const originalInfo = console.info;
console.info = (...args) => {
  const message = argsToString(args);
  saveToMongoDB('info', message, args);
  originalInfo(...args);
};

const originalDebug = console.debug;
console.debug = (...args) => {
  const message = argsToString(args);
  saveToMongoDB('debug', message, args);
  originalDebug(...args);
};

console.log('✅ MongoDB console patching loaded!');

// === MONGODB CONNECTION ===
const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
