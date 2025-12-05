import redis from '@/lib/redis';

// Key for tracking the last message timestamp
const LAST_MESSAGE_KEY = 'gemmie:last-message-timestamp';
// Key for tracking whether a QStash job is already scheduled
const JOB_SCHEDULED_KEY = 'gemmie:job-scheduled';
// Key for storing messages that arrive during the cooldown
const GEMMIE_MESSAGE_QUEUE_KEY = 'gemmie:message-queue';
// Key for tracking if a Gemmie job is active
const JOB_ACTIVE_KEY = 'gemmie:job-active';
// Key for storing the URL of the single image selected for AI processing in the current burst
const GEMMIE_SELECTED_IMAGE_URL_KEY = 'gemmie:selected-image-url';
// Time in seconds for the delay before Gemmie responds (random between 10-15 seconds to match job window)
const GEMMIE_DELAY = 5; // Fixed short thinking delay before AI (typing added after)

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
  
  // Clear the selected image URL for the new message burst
  await redis.del(GEMMIE_SELECTED_IMAGE_URL_KEY);
  console.log('🗑️ Cleared previously selected image URL for new message burst.');

  // Check if there's already a scheduled job and cancel it
  const jobScheduled = await redis.get(JOB_SCHEDULED_KEY);
  if (jobScheduled) {
    try {
      const response = await fetch(`https://qstash.upstash.com/v2/messages/${jobScheduled}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.QSTASH_TOKEN!}`,
        },
      });
      if (response.ok) {
        console.log(`✅ Cancelled previous QStash job: ${jobScheduled}`);
      } else {
        console.error(`❌ Failed to cancel QStash job ${jobScheduled}: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error cancelling previous QStash job ${jobScheduled}:`, error);
    }
    await redis.del(JOB_SCHEDULED_KEY);
  }
  
  // Schedule the new delayed response using QStash
  await scheduleDelayedResponse(userName, userMessage, userCountry);
  
  console.log('✅ Gemmie timer reset and response scheduled');
}

/**
 * Cancels any pending QStash jobs for Gemmie responses
 * Useful for cleaning up orphaned jobs
 */
export async function cancelPendingGemmieJobs(): Promise<void> {
  console.log('🗑️ Cancelling any pending Gemmie QStash jobs...');
  
  const jobScheduled = await redis.get(JOB_SCHEDULED_KEY);
  if (jobScheduled) {
    try {
      const response = await fetch(`https://qstash.upstash.com/v2/messages/${jobScheduled}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.QSTASH_TOKEN!}`,
        },
      });
      if (response.ok) {
        console.log(`✅ Cancelled pending QStash job: ${jobScheduled}`);
      } else {
        console.error(`❌ Failed to cancel QStash job ${jobScheduled}: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error cancelling QStash job ${jobScheduled}:`, error);
    }
    await redis.del(JOB_SCHEDULED_KEY);
  } else {
    console.log('ℹ️ No pending QStash jobs found');
  }
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
  console.log('🔍 Raw messages from Redis queue:', messagesJson);

  const messages: any[] = [];
  for (const msg of messagesJson) {
    try {
      let parsedMsg;
      if (typeof msg === 'string') {
        parsedMsg = JSON.parse(msg);
      } else if (typeof msg === 'object' && msg !== null) {
        parsedMsg = msg;
        console.log('📥 Using already-parsed queued message object');
      } else {
        throw new Error('Invalid message format');
      }
      messages.push(parsedMsg);
    } catch (parseError: any) {
      console.error('❌ Failed to parse queued message:', msg, 'Error:', parseError.message);
      // Skip invalid messages
    }
  }
  
  // Clear the queue after retrieving messages
  await redis.del(GEMMIE_MESSAGE_QUEUE_KEY);
  
  console.log(`🗑️ Cleared ${messages.length} valid messages from Gemmie queue.`);
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
 * Sets the Gemmie job as active (prevents multiple jobs)
 */
export async function setJobActive(): Promise<boolean> {
  try {
    // Set the job active key with TTL (should be longer than GEMMIE_DELAY)
    const result = await redis.set(JOB_ACTIVE_KEY, 'active', { ex: GEMMIE_DELAY + 10, nx: true });
    if (result === 'OK') {
      console.log('🚀 Gemmie job marked as active.');
      return true;
    } else {
      console.log('⏳ Gemmie job is already active.');
      return false;
    }
  } catch (error) {
    console.error('❌ Error setting job active:', error);
    return false;
  }
}

/**
 * Checks if a Gemmie job is currently active
 */
export async function isJobActive(): Promise<boolean> {
  try {
    const isActive = await redis.get(JOB_ACTIVE_KEY);
    return isActive === 'active';
  } catch (error) {
    console.error('❌ Error checking job active status:', error);
    return false;
  }
}

/**
 * Clears the Gemmie job active flag
 */
export async function clearJobActive(): Promise<void> {
  try {
    await redis.del(JOB_ACTIVE_KEY);
    console.log('🔓 Cleared Gemmie job active flag.');
  } catch (error) {
    console.error('❌ Error clearing job active flag:', error);
  }
}

/**
 * Stores the URL of the selected image for AI processing.
 * This should be called when an image is chosen to be sent to the AI.
 * @param imageUrl The URL of the selected image.
 */
export async function setSelectedImageUrl(imageUrl: string): Promise<void> {
  try {
    await redis.set(GEMMIE_SELECTED_IMAGE_URL_KEY, String(imageUrl), { ex: GEMMIE_DELAY + 60 }); // TTL slightly more than processing delay
    console.log('🖼️ Stored selected image URL for AI processing:', imageUrl);
  } catch (error) {
    console.error('❌ Error storing selected image URL:', error);
  }
}

/**
 * Retrieves and clears the URL of the selected image for AI processing.
 * This should be called after the image has been processed by the AI.
 * @returns The URL of the selected image, or null if none.
 */
export async function getAndClearSelectedImageUrl(): Promise<string | null> {
  try {
    const imageUrl = await redis.get(GEMMIE_SELECTED_IMAGE_URL_KEY);
    if (imageUrl) {
      await redis.del(GEMMIE_SELECTED_IMAGE_URL_KEY);
      console.log('🔄 Retrieved and cleared selected image URL:', imageUrl);
      return String(imageUrl);
    }
    console.log('ℹ️ No selected image URL found for AI processing.');
    return null;
  } catch (error) {
    console.error('❌ Error retrieving/clearing selected image URL:', error);
    return null;
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

/**
 * Automatically cleans up any orphaned QStash jobs that are older than expected
 * This can be called periodically to ensure no stale jobs remain
 */
export async function cleanupOrphanJobs(): Promise<void> {
  console.log('🧹 Performing automatic orphan job cleanup...');
  
  const jobScheduled = await redis.get(JOB_SCHEDULED_KEY);
  if (jobScheduled) {
    try {
      // Check the job status from QStash
      const response = await fetch(`https://qstash.upstash.com/v2/messages/${jobScheduled}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.QSTASH_TOKEN!}`,
        },
      });
      
      if (response.ok) {
        const jobData = await response.json();
        console.log('📋 Orphan job status:', jobData);
        
        // If job is still scheduled but very old (more than 2x our delay), cancel it
        const now = Math.floor(Date.now() / 1000);
        const jobAge = now - Math.floor(new Date(jobData.scheduledFor).getTime() / 1000);
        const maxAge = GEMMIE_DELAY * 2 + 30; // Allow some buffer
        
        if (jobAge > maxAge) {
          console.log(`⏰ Job is ${jobAge}s old (max ${maxAge}s), cancelling as orphan...`);
          await fetch(`https://qstash.upstash.com/v2/messages/${jobScheduled}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${process.env.QSTASH_TOKEN!}`,
            },
          });
          await redis.del(JOB_SCHEDULED_KEY);
          console.log('✅ Cancelled old orphan job');
        } else {
          console.log(`ℹ️ Job is ${jobAge}s old, still within acceptable age`);
        }
      } else {
        // If we can't get job status, assume it's orphaned and cancel
        console.log('❓ Cannot verify job status, cancelling as potential orphan...');
        await fetch(`https://qstash.upstash.com/v2/messages/${jobScheduled}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.QSTASH_TOKEN!}`,
          },
        });
        await redis.del(JOB_SCHEDULED_KEY);
      }
    } catch (error) {
      console.error('❌ Error during orphan job cleanup:', error);
    }
  } else {
    console.log('ℹ️ No scheduled jobs found during cleanup');
  }
}
