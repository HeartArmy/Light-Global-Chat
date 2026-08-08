import redis from '@/lib/redis';

// Key for tracking the last message timestamp
const LAST_MESSAGE_KEY = 'gemmie:last-message-timestamp';
// Key for tracking whether a QStash job is already scheduled
const JOB_SCHEDULED_KEY = 'gemmie:job-scheduled';
// Placeholder value while a QStash publish is in-flight (before the real messageId is stored)
const JOB_SCHEDULED_PENDING_VALUE = 'pending';
// Key for storing messages that arrive during the cooldown
const GEMMIE_MESSAGE_QUEUE_KEY = 'gemmie:message-queue';
// Key for tracking if a Gemmie job is active
const JOB_ACTIVE_KEY = 'gemmie:job-active';
// Key for storing the URL of the single image selected for AI processing in the current burst
const GEMMIE_SELECTED_IMAGE_URL_KEY = 'gemmie:selected-image-url';
// Key for flagging that the selected image is a frame extracted from a video
const GEMMIE_SELECTED_IS_VIDEO_FRAME_KEY = 'gemmie:selected-image-is-video-frame';
// Key for tracking typing indicator status
const TYPING_INDICATOR_KEY = 'typing:indicator';
// Key for tracking processed messages to prevent duplicates
const GEMMIE_PROCESSED_MESSAGES_KEY = 'gemmie:processed-messages';
// Time in seconds for the delay before Gemmie responds (random between 10-15 seconds to match job window)
const GEMMIE_DELAY = 7; // Fixed short thinking delay before AI (typing added after)
// TTL for job active flag should be longer than the entire processing time
const JOB_ACTIVE_TTL = 300; // 5 minutes - covers full processing including cleanup
// Key for tracking a pending proof-of-humanity delay (gemmie stays silent while set)
const DELAY_PENDING_KEY = 'gemmie:delay-pending';
// Prefix for per-user hostile flags (user marked as time-waster / adversarial)
const HOSTILE_KEY_PREFIX = 'gemmie:hostile:';
// Throttle key so hostile users don't spam apology-review jobs
const HOSTILE_REVIEW_THROTTLE_KEY = 'gemmie:hostile-review-throttle';
// Max seconds a user can request for a delayed proof-of-humanity reply
export const MAX_PROOF_DELAY_SECONDS = 300; // 5 minutes
// TTL for the hostile flag (1 hour)
const HOSTILE_TTL = 3600;

/**
 * Resets the Gemmie response timer when a user sends a message
 * If a job is already scheduled, it will be cancelled and rescheduled
 */
export async function resetGemmieTimer(
  userName: string,
  userMessage: string,
  userCountry: string,
  sourceTimestampSeconds?: number
): Promise<void> {
  console.log('⏰ Resetting Gemmie timer...');
  
  // Get the current timestamp
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  
  // Store the current timestamp
  await redis.set(LAST_MESSAGE_KEY, now);
  
  // Clear the selected image URL for the new message burst
  await redis.del(GEMMIE_SELECTED_IMAGE_URL_KEY);
  console.log('🗑️ Cleared previously selected image URL for new message burst.');

  // Clear any existing scheduled job before scheduling a new one.
  // Cancels the REAL QStash message by ID (not just the Redis key) so a
  // superseded job can never fire later — deleting only the key allowed stale
  // jobs to fire, which caused duplicate responses to the same message.
  const existingJobId = await redis.get<string>(JOB_SCHEDULED_KEY);
  if (existingJobId && existingJobId !== JOB_SCHEDULED_PENDING_VALUE) {
    console.log('🗑️ Cancelling existing QStash job:', existingJobId);
    await cancelQStashMessage(existingJobId);
    await redis.del(JOB_SCHEDULED_KEY);
  }
  
  // Schedule the new delayed response using QStash.
  // Use sourceTimestampSeconds when provided so downstream dedupe/hashing is stable.
  await scheduleDelayedResponse(userName, userMessage, userCountry, sourceTimestampSeconds ?? now);
  
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
async function scheduleDelayedResponse(
  userName: string,
  userMessage: string,
  userCountry: string,
  sourceTimestampSeconds: number
): Promise<void> {
  // Import QStash here to avoid circular dependencies
  const qstash = await import('@/lib/qstash');
  console.log('🚀 Attempting to schedule QStash message for:', userName, 'with delay:', GEMMIE_DELAY, 's');

  // Atomically claim the right to schedule. SET NX means only one publisher can
  // hold the job-scheduled key, so concurrent resets can't double-publish.
  // The 'pending' placeholder is swapped for the real messageId after a successful publish.
  const claim = await redis.set(JOB_SCHEDULED_KEY, JOB_SCHEDULED_PENDING_VALUE, { ex: JOB_ACTIVE_TTL, nx: true });
  if (claim !== 'OK') {
    console.log('⚠️ QStash job already scheduled, skipping new schedule.');
    return;
  }

  // Get the absolute URL for the delayed processing endpoint
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const endpoint = `${baseUrl}/api/gemmie/process`;
  console.log('📬 QStash target endpoint:', endpoint);

  const payload = {
    userName,
    userMessage,
    userCountry,
    timestamp: sourceTimestampSeconds,
  };
  console.log('📦 QStash payload:', JSON.stringify(payload));

  try {
    // Send message to QStash with delay
    const response = await qstash.default.publishJSON({
      url: endpoint,
      body: payload,
      delay: GEMMIE_DELAY, // Delay in seconds
    });
    console.log('✅ QStash publish successful. Response:', response);

    if (response && response.messageId) {
      // Store the message ID so we can potentially track/cancel it later if needed
      await redis.set(JOB_SCHEDULED_KEY, response.messageId, { ex: JOB_ACTIVE_TTL });
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
 * Cancels a pending QStash message by ID so a reset/superseded job never fires.
 * Best-effort: already-delivered or already-cancelled messages simply no-op.
 */
async function cancelQStashMessage(messageId: string): Promise<void> {
  try {
    const qstash = await import('@/lib/qstash');
    await qstash.default.messages.delete(messageId);
    console.log('🗑️ QStash message cancelled:', messageId);
  } catch (error: any) {
    // A message that already fired or was already cancelled will error — that's fine.
    console.error('❌ Failed to cancel QStash message:', messageId, error?.message || error);
  }
}

/**
 * Sets the Gemmie job as active (prevents multiple jobs)
 */
export async function setJobActive(): Promise<boolean> {
  try {
    // Set the job active key with TTL (should cover full processing time)
    const result = await redis.set(JOB_ACTIVE_KEY, 'active', { ex: JOB_ACTIVE_TTL, nx: true });
    if (result === 'OK') {
      // Store the timestamp when the flag was set for stuck detection
      const currentTime = Math.floor(Date.now() / 1000);
      await redis.set('gemmie:job-active-set-time', currentTime.toString(), { ex: JOB_ACTIVE_TTL });
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
    await redis.del('gemmie:job-active-set-time');
    console.log('🔓 Cleared Gemmie job active flag and timestamp.');
  } catch (error) {
    console.error('❌ Error clearing job active flag:', error);
  }
}

/**
 * Clears the Gemmie job active flag only if it's stuck
 * A flag is considered stuck if it's set but no actual job is in progress
 */
export async function clearStuckJobActive(): Promise<boolean> {
  try {
    const isActive = await redis.get(JOB_ACTIVE_KEY);
    
    if (isActive === 'active') {
      console.log('⚠️ Job active flag is set, checking if it\'s stuck...');
      
      // Simple time-based approach: if the flag has been set for more than 10 minutes, it's likely stuck
      const flagSetTime = await redis.get('gemmie:job-active-set-time');
      
      if (flagSetTime && typeof flagSetTime === 'string') {
        const flagSetTimestamp = parseInt(flagSetTime);
        const currentTime = Math.floor(Date.now() / 1000);
        const flagAgeSeconds = currentTime - flagSetTimestamp;
        
        // If flag has been set for more than 10 minutes (600 seconds), consider it stuck
        if (flagAgeSeconds > 600) {
          console.log(`🔓 Job active flag has been set for ${flagAgeSeconds}s (limit: 600s), considering it stuck - clearing it`);
          await redis.del(JOB_ACTIVE_KEY);
          await redis.del('gemmie:job-active-set-time');
          console.log('✅ Cleared stuck job active flag');
          return true;
        } else {
          console.log(`✅ Job active flag is relatively new (${flagAgeSeconds}s), keeping it set`);
          return false;
        }
      } else {
        // If no timestamp is set, the flag might be from an older version or corrupted
        console.log('🔓 No timestamp found for job active flag, considering it stuck - clearing it');
        await redis.del(JOB_ACTIVE_KEY);
        console.log('✅ Cleared stuck job active flag');
        return true;
      }
    } else {
      console.log('ℹ️ Job active flag is not set, no action needed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking and clearing stuck job active flag:', error);
    return false;
  }
}

/**
 * Clears the QStash job scheduled key
 */
export async function clearJobScheduled(): Promise<void> {
  try {
    await redis.del(JOB_SCHEDULED_KEY);
    console.log('🔓 Cleared QStash job scheduled key.');
  } catch (error) {
    console.error('❌ Error clearing job scheduled key:', error);
  }
}

/**
 * Stores the URL of the selected image for AI processing.
 * This should be called when an image is chosen to be sent to the AI.
 * @param imageUrl The URL of the selected image.
 * @param isVideoFrame Whether this image is a frame extracted from a video.
 */
export async function setSelectedImageUrl(imageUrl: string, isVideoFrame: boolean = false): Promise<void> {
  try {
    await redis.set(GEMMIE_SELECTED_IMAGE_URL_KEY, String(imageUrl), { ex: GEMMIE_DELAY + 60 }); // TTL slightly more than processing delay
    if (isVideoFrame) {
      await redis.set(GEMMIE_SELECTED_IS_VIDEO_FRAME_KEY, '1', { ex: GEMMIE_DELAY + 60 });
    } else {
      await redis.del(GEMMIE_SELECTED_IS_VIDEO_FRAME_KEY);
    }
    console.log('🖼️ Stored selected image URL for AI processing:', imageUrl, isVideoFrame ? '(video frame)' : '(image)');
  } catch (error) {
    console.error('❌ Error storing selected image URL:', error);
  }
}

/**
 * Retrieves and clears the URL of the selected image for AI processing.
 * This should be called after the image has been processed by the AI.
 * @returns The URL of the selected image, or null if none.
 */
export async function getAndClearSelectedImageUrl(): Promise<{ url: string; isVideoFrame: boolean } | null> {
  try {
    const imageUrl = await redis.get(GEMMIE_SELECTED_IMAGE_URL_KEY);
    if (imageUrl) {
      await redis.del(GEMMIE_SELECTED_IMAGE_URL_KEY);
      const isVideoFrame = (await redis.get(GEMMIE_SELECTED_IS_VIDEO_FRAME_KEY)) === '1';
      await redis.del(GEMMIE_SELECTED_IS_VIDEO_FRAME_KEY);
      console.log('🔄 Retrieved and cleared selected image URL:', imageUrl, isVideoFrame ? '(video frame)' : '(image)');
      return { url: String(imageUrl), isVideoFrame };
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
 * Sets the typing indicator status
 * @param isTyping Whether someone is typing
 */
export async function setTypingIndicator(isTyping: boolean, userName?: string): Promise<void> {
  try {
    if (isTyping) {
      await redis.set(TYPING_INDICATOR_KEY, 'typing', { ex: 10 }); // TTL 10 seconds
      // console.log('💬 Someone is typing...');
      
      // Trigger Pusher event for real-time update
      try {
        const pusher = (await import('@/lib/pusher')).getPusherInstance();
        const result = await pusher.trigger('chat-room', 'typing-start', { userName });
        // console.log('✅ Pusher typing-start event triggered successfully:', result);
      } catch (pusherError) {
        console.error('❌ Failed to trigger typing-start event:', pusherError);
      }
    } else {
      await redis.del(TYPING_INDICATOR_KEY);
      // console.log('💬 Typing indicator cleared');
      
      // Trigger Pusher event for real-time update
      try {
        const pusher = (await import('@/lib/pusher')).getPusherInstance();
        const result = await pusher.trigger('chat-room', 'typing-stop', { userName });
        // console.log('✅ Pusher typing-stop event triggered successfully:', result);
      } catch (pusherError) {
        console.error('❌ Failed to trigger typing-stop event:', pusherError);
      }
    }
  } catch (error) {
    console.error('❌ Error setting typing indicator:', error);
  }
}

/**
 * Gets the current typing indicator status
 * @returns true if someone is typing, false otherwise
 */
export async function isSomeoneTyping(): Promise<boolean> {
  try {
    const typingStatus = await redis.get(TYPING_INDICATOR_KEY);
    return typingStatus === 'typing';
  } catch (error) {
    console.error('❌ Error checking typing status:', error);
    return false;
  }
}

/**
 * Schedules a typing indicator for Gemmie after the delay period
 * This will start the typing indicator only after GEMMIE_DELAY seconds of inactivity
 */
export async function scheduleGemmieTypingIndicator(userName: string, userMessage: string, userCountry: string): Promise<void> {
  try {
    // Wait for the Gemmie delay period
    await new Promise(resolve => setTimeout(resolve, GEMMIE_DELAY * 1000));
    
    // Check if the job is still active (user hasn't sent new messages)
    const jobIsActive = await isJobActive();
    
    if (jobIsActive) {
      // Set typing indicator for Gemmie
      await setTypingIndicator(true, 'gemmie');
      console.log(`💬 Gemmie typing indicator started after ${GEMMIE_DELAY}s delay`);
      
      // Add a small delay before the actual response to simulate typing
      // The actual typing delay will be handled in the process route
    }
  } catch (error) {
    console.error('❌ Error scheduling Gemmie typing indicator:', error);
  }
}

/**
 * Marks a message as processed by Gemmie to prevent duplicate responses
 * @param messageHash A unique hash identifying the message content and context
 */
export async function markMessageAsProcessed(messageHash: string): Promise<void> {
  try {
    await redis.setex(`${GEMMIE_PROCESSED_MESSAGES_KEY}:${messageHash}`, 600, '1'); // 10 minutes TTL
    console.log(`📍 Marked message as processed: ${messageHash}`);
  } catch (error) {
    console.error('❌ Error marking message as processed:', error);
  }
}

/**
 * Atomically marks a message as processed.
 * @returns true if this call acquired the lock (message not processed yet), false otherwise.
 */
export async function tryMarkMessageAsProcessed(messageHash: string): Promise<boolean> {
  try {
    const result = await redis.set(
      `${GEMMIE_PROCESSED_MESSAGES_KEY}:${messageHash}`,
      '1',
      { ex: 600, nx: true } // 10 minutes TTL
    );
    // Upstash/Redis returns 'OK' on successful set with nx:true
    return result === 'OK';
  } catch (error) {
    console.error('❌ Error atomically marking message as processed:', error);
    return false;
  }
}

/**
 * Checks if a message has already been processed by Gemmie
 * @param messageHash A unique hash identifying the message content and context
 * @returns true if already processed, false otherwise
 */
export async function isMessageAlreadyProcessed(messageHash: string): Promise<boolean> {
  try {
    const exists = await redis.exists(`${GEMMIE_PROCESSED_MESSAGES_KEY}:${messageHash}`);
    return exists === 1;
  } catch (error) {
    console.error('❌ Error checking if message is processed:', error);
    return false;
  }
}

/**
 * Creates a hash for a message to track if it's been processed
 * @param userName The username who sent the message
 * @param userMessage The message content
 * @param timestamp The message timestamp
 * @returns A hash string
 */
export function createMessageHash(userName: string, userMessage: string, timestamp: number): string {
  // Use the EXACT timestamp (seconds) — NOT rounded to the minute. Rounding made two
  // jobs scheduled for the same message in different minutes hash differently, so the
  // duplicate-response guard missed them and Gemmie replied twice to one message.
  return `${userName}:${userMessage}:${timestamp}`;
}

/**
 * Checks if a proof-of-humanity delayed reply is currently pending.
 * While pending, Gemmie stays silent and queues messages instead of responding.
 */
export async function isDelayPending(): Promise<boolean> {
  try {
    return (await redis.get(DELAY_PENDING_KEY)) === '1';
  } catch (error) {
    console.error('❌ Error checking delay pending status:', error);
    return false;
  }
}

/**
 * Clears the pending proof-of-humanity delay flag
 */
export async function clearDelayPending(): Promise<void> {
  try {
    await redis.del(DELAY_PENDING_KEY);
    console.log('🔓 Cleared gemmie:delay-pending flag.');
  } catch (error) {
    console.error('❌ Error clearing delay pending flag:', error);
  }
}

/**
 * Marks a user as hostile (time-waster) for 1 hour. Gemmie stops responding to them.
 */
export async function markUserHostile(userName: string): Promise<void> {
  try {
    const key = `${HOSTILE_KEY_PREFIX}${userName.toLowerCase()}`;
    await redis.set(key, '1', { ex: HOSTILE_TTL });
    console.log('🚫 Marked user as hostile:', userName);
  } catch (error) {
    console.error('❌ Error marking user hostile:', error);
  }
}

/**
 * Checks if a user is currently marked hostile
 */
export async function isUserHostile(userName: string): Promise<boolean> {
  try {
    const key = `${HOSTILE_KEY_PREFIX}${userName.toLowerCase()}`;
    return (await redis.get(key)) === '1';
  } catch (error) {
    console.error('❌ Error checking hostile status:', error);
    return false;
  }
}

/**
 * Removes the hostile flag for a user (e.g. after a genuine apology)
 */
export async function clearUserHostile(userName: string): Promise<void> {
  try {
    const key = `${HOSTILE_KEY_PREFIX}${userName.toLowerCase()}`;
    await redis.del(key);
    console.log('🔓 Cleared hostile flag for user:', userName);
  } catch (error) {
    console.error('❌ Error clearing hostile flag:', error);
  }
}

/**
 * Schedules a delayed proof-of-humanity message.
 * Sets the delay-pending flag so Gemmie stays silent for everyone during the wait,
 * then publishes a QStash job that fires after delaySeconds and sends sassyText.
 */
export async function scheduleProofOfHumanity(sassyText: string, delaySeconds: number): Promise<void> {
  try {
    // Keep Gemmie silent for everyone while the proof delay is pending
    await redis.set(DELAY_PENDING_KEY, '1', { ex: delaySeconds + 120 });
    console.log(`⏱️ Delay pending set for ${delaySeconds}s (sassy follow-up scheduled).`);

    const qstash = await import('@/lib/qstash');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const endpoint = `${baseUrl}/api/gemmie/process`;

    await qstash.default.publishJSON({
      url: endpoint,
      body: {
        mode: 'proof',
        userName: 'gemmie',
        userMessage: '__proof__',
        userCountry: 'US',
        sassyText,
        timestamp: Math.floor(Date.now() / 1000),
      },
      delay: Math.max(1, Math.round(delaySeconds)),
    });
    console.log(`🚀 Scheduled proof-of-humanity QStash job in ${delaySeconds}s.`);
  } catch (error) {
    console.error('❌ Error scheduling proof-of-humanity:', error);
    await redis.del(DELAY_PENDING_KEY);
  }
}

/**
 * Schedules a quiet AI review for a hostile user's latest message so Gemmie can
 * un-hostile them if they've genuinely apologized. Throttled to avoid spam.
 */
export async function tryScheduleHostileReview(userName: string, userMessage: string, userCountry: string): Promise<boolean> {
  try {
    // Throttle: only one review per 30s to avoid spam jobs from a hostile user
    const throttleResult = await redis.set(HOSTILE_REVIEW_THROTTLE_KEY, '1', { ex: 30, nx: true });
    if (throttleResult !== 'OK') {
      console.log('⏳ Hostile review already pending, skipping:', userName);
      return false;
    }

    const qstash = await import('@/lib/qstash');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const endpoint = `${baseUrl}/api/gemmie/process`;

    await qstash.default.publishJSON({
      url: endpoint,
      body: {
        mode: 'hostile-review',
        userName,
        userMessage,
        userCountry,
        timestamp: Math.floor(Date.now() / 1000),
      },
      delay: 3,
    });
    console.log(`🤖 Scheduled hostile-review job for user: ${userName}`);
    return true;
  } catch (error) {
    console.error('❌ Error scheduling hostile review:', error);
    return false;
  }
}

