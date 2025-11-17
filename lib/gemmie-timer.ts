import redis from '@/lib/redis';

// Key for tracking the last message timestamp
const LAST_MESSAGE_KEY = 'gemmie:last-message-timestamp';
// Key for tracking whether a QStash job is already scheduled
const JOB_SCHEDULED_KEY = 'gemmie:job-scheduled';
// Key for storing messages that arrive during the cooldown
const GEMMIE_MESSAGE_QUEUE_KEY = 'gemmie:message-queue';

// Time in seconds for the delay before Gemmie responds (15 seconds)
const GEMMIE_DELAY = 15;

/**
 * Resets the Gemmie response timer when a user sends a message
 * If a job is already scheduled, it will be cancelled and rescheduled
 */
export async function resetGemmieTimer(userName: string, userMessage: string, userCountry: string): Promise<void> {
  console.log('⏰ Resetting Gemmie timer...');
  
  // Get the current timestamp
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  
  // Store the current timestamp
  await redis.set(LAST_MESSAGE_KEY, now);
  
  // Check if there's already a scheduled job
  const jobScheduled = await redis.get(JOB_SCHEDULED_KEY);
  
  // If there was a previously scheduled job, we need to cancel and reschedule
  // In QStash, we'd need to use message IDs to cancel, but for simplicity
  // we'll just rely on the timestamp check in the handler
  
  // Schedule the delayed response using QStash
  await scheduleDelayedResponse(userName, userMessage, userCountry);
  
  console.log('✅ Gemmie timer reset and response scheduled');
}

/**
 * Adds a message to the Gemmie queue if a response is already scheduled
 */
export async function queueGemmieMessage(userName: string, userMessage: string, userCountry: string): Promise<void> {
  console.log('📝 Adding message to Gemmie queue:', userName);
  
  const messageData = {
    userName,
    userMessage,
    userCountry,
    timestamp: Math.floor(Date.now() / 1000),
  };

  await redis.lpush(GEMMIE_MESSAGE_QUEUE_KEY, JSON.stringify(messageData));
  console.log('✅ Message queued for Gemmie response.');
}

/**
 * Retrieves all messages from the Gemmie queue and clears it
 */
export async function getAndClearGemmieQueue(): Promise<any[]> {
  console.log('📂 Retrieving and clearing Gemmie message queue...');
  
  // Use RPOP to get messages in chronological order (oldest first)
  const messagesJson = await redis.lrange(GEMMIE_MESSAGE_QUEUE_KEY, 0, -1);
  const messages = messagesJson.map(msg => JSON.parse(msg));
  
  // Clear the queue after retrieving messages
  await redis.del(GEMMIE_MESSAGE_QUEUE_KEY);
  
  console.log(`🗑️ Cleared ${messages.length} messages from Gemmie queue.`);
  return messages;
}

/**
 * Schedules the delayed Gemmie response via QStash
 */
async function scheduleDelayedResponse(userName: string, userMessage: string, userCountry: string): Promise<void> {
  // Import QStash here to avoid circular dependencies
  const qstash = await import('@/lib/qstash');
  console.log('🚀 Attempting to schedule QStash message for:', userName, 'with delay:', GEMMIE_DELAY, 's');

  // Get the absolute URL for the delayed processing endpoint
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const endpoint = `${baseUrl}/api/gemmie/process`;
  console.log('📬 QStash target endpoint:', endpoint);

  const payload = {
    userName,
    userMessage,
    userCountry
  };
  console.log('📦 QStash payload:', JSON.stringify(payload));

  try {
    // Send message to QStash with 15 second delay
    const response = await qstash.default.publishJSON({
      url: endpoint,
      body: payload,
      delay: GEMMIE_DELAY, // Delay in seconds
    });
    console.log('✅ QStash publish successful. Response:', response);

    if (response && response.messageId) {
      // Store the message ID so we can potentially track/cancel it later if needed
      await redis.set(JOB_SCHEDULED_KEY, response.messageId);
      console.log('📍 Stored QStash message ID in Redis:', response.messageId);
    } else {
      console.error('❌ QStash response did not contain a messageId:', response);
      // Optionally, clear the job scheduled key or handle this error
      await redis.del(JOB_SCHEDULED_KEY);
    }
  } catch (qstashError) {
    console.error('❌ QStash publish failed:', qstashError);
    // Ensure we don't leave a stale job scheduled key
    await redis.del(JOB_SCHEDULED_KEY);
    throw qstashError; // Re-throw to be caught by the caller
  }
}

/**
 * Checks if enough time has passed since the last message to trigger Gemmie response
 */
export async function shouldTriggerGemmieResponse(): Promise<boolean> {
  const lastMessageTimestamp = await redis.get(LAST_MESSAGE_KEY);
  
  if (!lastMessageTimestamp) {
    return true; // If no timestamp exists, it's safe to trigger
  }
  
  const now = Math.floor(Date.now() / 1000);
  const timePassed = now - Number(lastMessageTimestamp);
  
  // Return true if at least 15 seconds have passed
  return timePassed >= GEMMIE_DELAY;
}
