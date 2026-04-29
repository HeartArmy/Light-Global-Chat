import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateGemmieResponse, generateGemmieResponseForContext, sendGemmieMessage, addProbabilisticTypos } from '@/lib/openrouter';
import { getPusherInstance } from '@/lib/pusher';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import GemmieMemory from '@/models/GemmieMemory';
import DeletedMessageByGemmie from '@/models/DeletedMessageByGemmie';
import EditedMessageByGemmie from '@/models/EditedMessageByGemmie';
import mongoose from 'mongoose'; 

// Get country flag
function getCountryFlag(countryCode: string, userName?: string): string {
  // Always show USA flag for gemmie
  if (userName?.toLowerCase() === 'gemmie') {
    return '🇺🇸';
  }
  
  if (!countryCode || countryCode === 'XX') return '🌍';
  const codePoints = countryCode.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397);
  return String.fromCodePoint(...codePoints);
}

// Check if response is too similar to recent messages using AI
async function checkResponseSimilarity(newResponse: string, recentMessages: any[]): Promise<{ shouldSkip: boolean; similarMessage?: string }> {
  if (recentMessages.length === 0) {
    return { shouldSkip: false };
  }

  // Get the most recent message to compare against
  const mostRecentMessage = recentMessages[0].content;
  
  // Create comprehensive context showing the full conversation flow with country flags and timestamps
  const contextMessages = recentMessages.slice(0, 10).map((msg, index) => {
    const flag = msg.userCountry ? getCountryFlag(msg.userCountry, msg.userName) : '🌍';
    return `${index + 1}. ${msg.userName} ${flag} from ${msg.userCountry} [${new Date(msg.timestamp).toISOString()}]: "${msg.content}"`;
  }).join('\n');

  const similarityPrompt = `Check if Gemmie should SKIP sending this new message.

NEW MESSAGE TO SEND:
"${newResponse}"

RECENT CONVERSATION:
${contextMessages}

SKIP THE MESSAGE IF ANY OF THESE ARE TRUE:

1. TOO LONG: Message is over 18 words
2. TOO HELPFUL: Gives step-by-step instructions, recipes, or detailed how-to explanations
3. DUPLICATE: Says basically the same thing as Gemmie's last message
4. STALE: User already answered their own question or moved on to a different topic
5. IMPOSSIBLE KNOWLEDGE: Gemmie (23yo from California) wouldn't realistically know this specific information

DO NOT SKIP IF:
- Responding to a different user than last time
- More than 30 minutes since Gemmie's last message
- User is asking about a different topic/subject
- Message is a simple greeting or short response

WHEN IN DOUBT, DO NOT SKIP. Better to send than to ignore a user.

Respond with JSON only:
{"shouldSkip": true/false, "reason": "which rule triggered"}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App', 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3.2-24b-instruct',
        messages: [{ role: 'user', content: similarityPrompt }],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (response.ok) {
      const data = await response.json();
      const resultText = data.choices[0]?.message?.content?.trim();
      
      try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            shouldSkip: parsed.shouldSkip || false,
            similarMessage: mostRecentMessage
          };
        }
      } catch (parseError) {
        console.error('Failed to parse similarity check JSON:', parseError);
      }
    }
  } catch (error) {
    console.error('Error in similarity check:', error);
  }

  return { shouldSkip: false };
}

// This API route handles the delayed Gemmie response
export async function POST(request: NextRequest) {
  // Create a receiver for signature verification
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

    // Verify the request is coming from QStash
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.text();

    try {
      // Verify the signature
      const isValid = await receiver.verify({
        signature,
        body,
        // Remove url from verification to fix signature mismatch
      });

      if (!isValid) {
        console.error('❌ Invalid QStash signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  try {
    // Connect to database early for similarity checks
    await connectDB();
    
    // Check if this is an orphan job by verifying job activity
    const { isJobActive } = await import('@/lib/gemmie-timer');
    const jobIsActive = await isJobActive();
    
    if (!jobIsActive) {
      console.log('⚠️ Job active flag not set - checking if this is a legitimate orphan job...');
      
      // Check if there are any recent messages that might indicate this is a valid job
      // that just lost its flag due to TTL expiration
      const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000);
      const recentMessages = await Message.find({
        timestamp: { $gte: fortyFiveSecondsAgo }
      }).sort({ timestamp: -1 }).limit(5).lean();
      
      // If there are recent messages from non-Gemmie users, this might be a valid job
      const hasRecentUserMessages = recentMessages.some(msg =>
        msg.userName.toLowerCase() !== 'gemmie'
      );
      
      if (hasRecentUserMessages) {
        console.log('ℹ️ Recent user messages found, treating as valid job despite missing flag');
        // Set the flag again since this appears to be a valid job
        const { setJobActive } = await import('@/lib/gemmie-timer');
        await setJobActive();
      } else {
        console.log('⚠️ No recent user messages found, treating as true orphan job. Skipping processing...');
        return NextResponse.json({ success: true, skipped: true, reason: 'orphan-job' });
      }
    }
    
    // Clear the job scheduled key to allow new messages to trigger QStash jobs
    // This is important so that if resetGemmieTimer is called later for a rescheduled job,
    // it can successfully store the new QStash message ID.
    const redisClient = await import('@/lib/redis');
    await redisClient.default.del('gemmie:job-scheduled');
    console.log('🔓 Cleared gemmie:job-scheduled key. New messages can now schedule QStash jobs.');
    
    // Log current job state for debugging
    const jobActiveStatus = await redisClient.default.get('gemmie:job-active');
    console.log(`📋 Job state at start: job-active=${jobActiveStatus}`);

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (initialParseError: any) {
      console.warn('Initial JSON.parse failed, attempting to extract JSON from body:', initialParseError.message);
      // Attempt to find a JSON object string within the body
      // This is a common pattern if QStash adds prefixes or the body is not plain JSON
      const jsonMatch = body.match(/\{[\s\S]*\}/); // Find first {...}
      if (jsonMatch) {
        try {
          parsedBody = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error('Failed to parse extracted JSON:', secondParseError);
          throw new Error('Invalid JSON format in request body');
        }
      } else {
        throw new Error('No valid JSON object found in request body');
      }
    }
    
    const { userName, userMessage, userCountry } = parsedBody;
    
    if (!userName || !userMessage || !userCountry) {
      throw new Error('Missing required fields in request body: userName, userMessage, or userCountry');
    }

    // Message Age Check - Prevent processing old messages
    const MAX_MESSAGE_AGE_SECONDS = 20;
    const messageTimestamp =
      typeof parsedBody.timestamp === 'number'
        ? parsedBody.timestamp
        : Math.floor(Date.now() / 1000);
    const messageAge = Math.floor(Date.now() / 1000) - messageTimestamp;
    if (messageAge > MAX_MESSAGE_AGE_SECONDS) {
      console.log(`⚠️ Message too old (${messageAge}s), skipping`);
      return NextResponse.json({ success: true, skipped: true, reason: 'message-too-old' });
    }

    // Message Hash Check - Prevent duplicate processing (atomic)
    const { createMessageHash, tryMarkMessageAsProcessed } = await import('@/lib/gemmie-timer');
    const messageHash = createMessageHash(userName, userMessage, messageTimestamp);
    const acquired = await tryMarkMessageAsProcessed(messageHash);

    if (!acquired) {
      console.log(`⚠️ Message already processed (hash: ${messageHash}), skipping`);
      return NextResponse.json({ success: true, skipped: true, reason: 'already-processed' });
    }

    console.log('🤖 Starting delayed Gemmie response process for:', userName);

    // Get queued messages that were present before this QStash job started processing.
    const { getAndClearGemmieQueue } = await import('@/lib/gemmie-timer');
    const queuedMessagesAtStart = await getAndClearGemmieQueue();
    
    // CRITICAL FIX: Process only recent queued messages, ignore old ones
    const MAX_QUEUED_MESSAGE_AGE_SECONDS = 15; // Only process messages from last 15 seconds
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const recentQueuedMessages = queuedMessagesAtStart.filter(msg =>
      currentTimestamp - msg.timestamp <= MAX_QUEUED_MESSAGE_AGE_SECONDS
    );
    
    // Prepare messages for context (current message + only recent queued messages)
    const allMessagesForContext = [
      { userName, userMessage, userCountry, timestamp: currentTimestamp },
      ...recentQueuedMessages
    ];

    // Helper: even if we skip sending, we still need to drain any queued messages
    // that arrived during processing and schedule the next job, otherwise the chat can stall.
    const scheduleNextFromQueue = async (): Promise<void> => {
      const {
        getAndClearGemmieQueue: getQueueAgain,
        resetGemmieTimer: scheduleNextJob,
        queueGemmieMessage: queueGemmieMessageFn,
      } = await import('@/lib/gemmie-timer');

      const newlyQueuedMessages = await getQueueAgain();
      if (newlyQueuedMessages.length === 0) return;

      console.log(`📥 Found ${newlyQueuedMessages.length} new message(s) in queue. Scheduling next job immediately.`);

      const nextMessageToProcess = newlyQueuedMessages[0]; // oldest first
      await scheduleNextJob(
        nextMessageToProcess.userName,
        nextMessageToProcess.userMessage,
        nextMessageToProcess.userCountry,
        nextMessageToProcess.timestamp
      );

      const remainingMessages = newlyQueuedMessages.slice(1);
      for (const remainingMsg of remainingMessages) {
        await queueGemmieMessageFn(remainingMsg.userName, remainingMsg.userMessage, remainingMsg.userCountry);
      }
    };
    
    console.log(`🧠 Processing ${allMessagesForContext.length} messages (${recentQueuedMessages.length} recent queued, ${queuedMessagesAtStart.length - recentQueuedMessages.length} old messages ignored)`);

    console.log(`🧠 Generating AI response based on ${allMessagesForContext.length} messages...`);

    // Format messages for context with timestamp and country flag
    const formatMessageWithContext = (msg: any) => {
      const flag = msg.userCountry ? getCountryFlag(msg.userCountry, msg.userName) : '🌍';
      return `${msg.userName} ${flag} from ${msg.userCountry} [${new Date(msg.timestamp * 1000).toISOString()}]: ${msg.userMessage}`;
    };

    const contextString = allMessagesForContext.map(formatMessageWithContext).join('\n---\n');

    // ---- Memory-aware generation (main LLM call) ----
    const userMemoryKey = `${userName.toLowerCase()}:${userCountry}`;
    const gemmieSelfMemoryKey = 'gemmie:self';

    const findUserMemoryDoc = async (): Promise<any> => {
      const exactDoc = await GemmieMemory.findOne({ key: userMemoryKey }).lean();
      if (exactDoc) return exactDoc;

      const aliasDoc = await GemmieMemory.findOne({
        userCountry,
        knownNames: userName.toLowerCase(),
      }).lean();
      return aliasDoc || null;
    };

    const userMemoryDoc: any = await findUserMemoryDoc();
    const gemmieSelfMemoryDoc: any = await GemmieMemory.findOne({ key: gemmieSelfMemoryKey }).lean();

    const userTopics = (userMemoryDoc?.topics || []).slice(0, 3).map((t: any) => String(t.topic));
    const gemmieSelfFacts = (gemmieSelfMemoryDoc?.selfFacts || []).slice(0, 3).map((f: any) => String(f.fact));

    const userMemoryBlock = userTopics.length ? userTopics.map((t: string) => `- ${t}`).join('\n') : 'none';
    const gemmieSelfMemoryBlock = gemmieSelfFacts.length ? gemmieSelfFacts.map((f: string) => `- ${f}`).join('\n') : 'none';

    const extractNameChange = (message: string) => {
      const normalized = message.toLowerCase();
      const nameMatch = normalized.match(/(?:changed my name to|i am now|i'm now|call me|my new name is)\s+([a-z0-9_\-]+)/i);
      const oldNameMatch = normalized.match(/(?:formerly known as|used to be|was called)\s+([a-z0-9_\-]+)/i);
      return {
        newName: nameMatch?.[1] || null,
        oldName: oldNameMatch?.[1] || null,
      };
    };

    const nameChange = extractNameChange(userMessage);
    const sameCountryDocs = await GemmieMemory.find({ userCountry }).lean();

    const resolveExistingUserDoc = async (): Promise<any> => {
      if (userMemoryDoc) return userMemoryDoc;

      if (nameChange.oldName) {
        const match = sameCountryDocs.find((doc: any) => doc.knownNames?.includes(nameChange.oldName?.toLowerCase() || ''));
        if (match) return match;
      }

      if (nameChange.newName && nameChange.newName.toLowerCase() === userName.toLowerCase()) {
        const candidates = sameCountryDocs.filter((doc: any) => doc.knownNames?.some((name: string) => name !== userName.toLowerCase()));
        if (candidates.length === 1) return candidates[0];
      }

      return null;
    };

    const resolvedUserMemoryDoc = await resolveExistingUserDoc();

    const applyMemoryUpdate = async (
      memoryUpdate: { topics: Array<{ topic: string; strength: number }>; selfFacts: Array<{ fact: string; strength: number }> }
    ): Promise<void> => {
      const now = new Date();

      const mergeByLower = (
        existing: any[],
        incoming: any[],
        getExistingKey: (x: any) => string,
        getIncomingKey: (x: any) => string,
        getStrength: (x: any) => number,
        keyField: 'topics' | 'selfFacts',
      ): any[] => {
        const out = [...existing];
        for (const inc of incoming) {
          const incKey = getIncomingKey(inc).toLowerCase();
          const idx = out.findIndex(e => getExistingKey(e).toLowerCase() === incKey);
          if (idx >= 0) {
            out[idx].strength = Math.max(Number(out[idx].strength || 0), Number(getStrength(inc)));
            out[idx].lastMentionedAt = now;
          } else {
            out.push({
              ...(keyField === 'topics'
                ? { topic: String(inc.topic), strength: getStrength(inc) }
                : { fact: String(inc.fact), strength: getStrength(inc) }),
              lastMentionedAt: now,
            });
          }
        }
        // cap growth: keep strongest/recent, max 10 items
        out.sort((a, b) => (Number(b.strength) - Number(a.strength)) || (Number(new Date(b.lastMentionedAt).getTime()) - Number(new Date(a.lastMentionedAt).getTime())));
        return out.slice(0, 10);
      };

      if (memoryUpdate?.topics?.length) {
        const existingDoc: any = await GemmieMemory.findOne({ key: userMemoryKey }).exec();
        const doc: any = existingDoc || resolvedUserMemoryDoc || new GemmieMemory({ key: userMemoryKey });
        doc.userCountry = userCountry;
        doc.currentName = userName;
        doc.knownNames = Array.from(new Set([...(doc.knownNames || []).map((name: string) => name.toLowerCase()), userName.toLowerCase()]));
        if (!doc.key) {
          doc.key = userMemoryKey;
        }
        doc.lastSeenAt = now;
        doc.topics = mergeByLower(
          doc.topics || [],
          memoryUpdate.topics,
          (x: any) => String(x.topic),
          (x: any) => String(x.topic),
          (x: any) => Number(x.strength),
          'topics'
        );
        await doc.save();
      }

      if (memoryUpdate?.selfFacts?.length) {
        const doc: any = (await GemmieMemory.findOne({ key: gemmieSelfMemoryKey }).exec()) || new GemmieMemory({ key: gemmieSelfMemoryKey });
        doc.lastSeenAt = now;
        doc.selfFacts = mergeByLower(
          doc.selfFacts || [],
          memoryUpdate.selfFacts,
          (x: any) => String(x.fact),
          (x: any) => String(x.fact),
          (x: any) => Number(x.strength),
          'selfFacts'
        );
        await doc.save();
      }
    };

    const gen = await generateGemmieResponseForContext(
      userName,
      contextString,
      userCountry,
      allMessagesForContext,
      { userMemoryBlock, gemmieSelfMemoryBlock }
    );

    console.log('💬 Generated gemmie JSON:', {
      shouldRespond: gen.shouldRespond,
      replyPreview: gen.reply?.slice(0, 80),
    });

    await applyMemoryUpdate(gen.memoryUpdate);

    if (!gen.shouldRespond || !gen.reply) {
      const { setTypingIndicator } = await import('@/lib/gemmie-timer');
      await setTypingIndicator(false, 'gemmie');
      await scheduleNextFromQueue();
      return NextResponse.json({ success: true, skipped: true, reason: 'shouldRespond-false' });
    }

    // Track if typos were added for conditional editing
    const originalResponse = gen.reply;
    const responseWithTypos = addProbabilisticTypos(gen.reply);
    const hasTypos = responseWithTypos !== gen.reply;
    
    if (hasTypos) {
      console.log('🔤 Typos detected, message will go through editing logic');
    } else {
      console.log('✅ No typos added, skipping editing logic');
    }

    // Simulate realistic typing delay based on response length
    const words = (responseWithTypos.match(/\S+/g) || []).length;
    const typingSpeedWps = 1.3; // words/sec (chatgpt said 1.3 word per second for 100 wpm)
    let typingDelaySec = words / typingSpeedWps;
    typingDelaySec = Math.max(1, Math.min(1, typingDelaySec)); // cap 1-1s (maximum)
    typingDelaySec *= (0.8 + Math.random() * 0.4); // 20% variance
    const typingDelayMs = typingDelaySec * 1000;
    console.log(`⌨️ Typing ${words} words: ~${Math.round(typingDelayMs)}ms`);
    await new Promise(resolve => setTimeout(resolve, typingDelayMs));

    // Check for similarity with recent messages from GEMMIE only before sending
    console.log('🔍 Checking for similarity with recent Gemmie messages only...');
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    //Get all recent messages for context (for AI understanding)
    const allRecentMessages = await Message.find({
      timestamp: { $gte: twoMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('_id content userName userCountry timestamp')
      .lean();
    
    // Get only Gemmie messages for similarity comparison
    const gemmieMessages = await Message.find({
      userName: 'gemmie',
      timestamp: { $gte: twoMinutesAgo }
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('_id content userName userCountry timestamp')
      .lean();

    //Check if this response is too similar to recent Gemmie messages
    const similarityCheck = await checkResponseSimilarity(originalResponse, gemmieMessages);
    
    if (similarityCheck.shouldSkip) {
      console.log(`⚠️ Response is a duplicate of recent message, skipping send`);
      console.log(`📝 Similar message: "${similarityCheck.similarMessage}"`);
      const { setTypingIndicator } = await import('@/lib/gemmie-timer');
      await setTypingIndicator(false, 'gemmie');
      await scheduleNextFromQueue();
      return NextResponse.json({ success: true, skipped: true, reason: 'similarity' });
    }

    // Hard min-gap between Gemmie sends (race-proof via Redis lock)
    const COOLDOWN_SECONDS = 11; // minimum gap you want
    const SEND_COOLDOWN_LOCK_KEY = 'gemmie:send-cooldown';
    const lockTTL = COOLDOWN_SECONDS + 1; // extra buffer to avoid suspiciously close timestamps

    const lockAcquired = await redisClient.default.set(SEND_COOLDOWN_LOCK_KEY, '1', {
      ex: lockTTL,
      nx: true,
    });

    if (lockAcquired !== 'OK') {
      console.log('⏰ Gemmie is in cooldown (Redis lock), skipping message send');
      const { setTypingIndicator } = await import('@/lib/gemmie-timer');
      await setTypingIndicator(false, 'gemmie');
      await scheduleNextFromQueue();
      return NextResponse.json({ success: true, skipped: true, reason: 'cooldown' });
    }

    // Clear typing indicator before sending message
    const { setTypingIndicator } = await import('@/lib/gemmie-timer');
    await setTypingIndicator(false, 'gemmie');
    // console.log('💬 Gemmie typing indicator cleared');

    // Send to chat
    console.log('📤 Sending Gemmie message to chat...');
    await sendGemmieMessage(responseWithTypos);

    // Trigger Pusher event for real-time update
    const pusher = getPusherInstance();
    const gemmieMessage = {
      _id: new Date().getTime().toString(), // Temporary ID
      content: responseWithTypos,
      userName: 'gemmie',
      userCountry: 'US', // Default country for Gemmie
      timestamp: new Date(),
      attachments: [],
      replyTo: null,
      reactions: [],
      edited: false,
      editedAt: null
    };

    await pusher.trigger('chat-room', 'new-message', gemmieMessage);
    console.log('✅ Delayed Gemmie response sent for the initial message(s).');
    
    // Check for new messages that arrived during processing and schedule next job immediately.
    // This allows the next job to start while editing happens concurrently.
    await scheduleNextFromQueue();

    // Check Gemmie's recent messages for repetition and delete if needed
    // console.log('🔍 Checking Gemmie messages for repetition...');

    // // Filter for only Gemmie messages from the all recent messages
    // const gemmieMessagesForRepetition = allRecentMessages.filter((msg: any) => msg.userName === 'gemmie');

    // if (gemmieMessagesForRepetition.length > 1) {
    //   const messagesContext = gemmieMessagesForRepetition.map((msg: any, index: number) =>
    //     `${index + 1}. ID: ${msg._id} Content: "${msg.content}" Time: ${new Date(msg.timestamp).toISOString()}`
    //   ).join('\n');

    //   const reviewPrompt = `Review these last ${gemmieMessagesForRepetition.length} Gemmie messages (1=newest, ${gemmieMessagesForRepetition.length}=oldest) for repetition or similarity.

    // ${messagesContext}

    // IMPORTANT RULES:
    // - You can ONLY delete Gemmie's most recent message (index 1) or the second most recent message (index 2)
    // - Do NOT delete messages from index 3 or higher (older messages)
    // - Only delete if there's clear repetition between the most recent messages
    // - Prefer deleting the older of the two repetitive messages
    // - CRITICAL: You can only delete older message only if it was sent within 120 seconds of the most recent message. Check the timestamps and only delete if the time difference is 120 seconds or less.

    // Output ONLY valid JSON: {"deleteIndices": [1]} or {"deleteIndices": [2]} or {"deleteIndices": []} if none needed.
    // Allowed indices: [1] or [2] only!`;

    //   try {
    //     const reviewResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    //       method: 'POST',
    //       headers: {
    //         'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    //         'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
    //         'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
    //         'Content-Type': 'application/json'
    //       },
    //       body: JSON.stringify({
    //         model: 'openrouter/free', //no need of image model here just a good text model is sufficient
    //         messages: [{ role: 'user', content: reviewPrompt }],
    //         max_tokens: 200,
    //         temperature: 0.1
    //       })
    //     });

    //     if (reviewResponse.ok) {
    //       const data = await reviewResponse.json();
    //       const reviewText = data.choices[0]?.message?.content?.trim();
    //       console.log('🤖 AI review:', reviewText);

    //       let deleteIndices: number[] = [];
    //       try {
    //         const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
    //         if (jsonMatch) {
    //           const parsed = JSON.parse(jsonMatch[0]);
    //           deleteIndices = Array.isArray(parsed.deleteIndices) ? parsed.deleteIndices.map((i: any) => parseInt(i)) : [];
    //         }
    //       } catch (parseError) {
    //         console.error('Failed to parse review JSON:', parseError);
    //       }

    //       console.log(`🗑️ Processing ${deleteIndices.length} deletion indices`);
    //       for (const idx of deleteIndices) {
    //         // Only allow indices 1 or 2 (most recent or second most recent)
    //         if (idx !== 1 && idx !== 2) {
    //           console.log(`⚠️ Invalid index ${idx}, only indices 1 and 2 are allowed, skipping`);
    //           continue;
    //         }
    //         if (idx > gemmieMessagesForRepetition.length) {
    //           console.log(`ℹ️ Index ${idx} out of range, skipping`);
    //           continue;
    //         }
    //         const msgIndex = idx - 1;
    //         const msg = gemmieMessagesForRepetition[msgIndex];
    //         const idStr = msg._id.toString();
    //         try {
    //           const id = new mongoose.Types.ObjectId(idStr);
    //           const message = await Message.findById(id);
    //           if (message && message.userName === 'gemmie') {
    //             // Store the deleted message in the DeletedMessageByGemmie collection
    //             const deletedMessage = new DeletedMessageByGemmie({
    //               originalMessageId: id,
    //               content: message.content,
    //               userName: message.userName,
    //               userCountry: message.userCountry,
    //               timestamp: message.timestamp,
    //               attachments: message.attachments,
    //               replyTo: message.replyTo,
    //               reactions: message.reactions,
    //               edited: message.edited,
    //               editedAt: message.editedAt,
    //               deletionReason: 'repetition'
    //             });
                
    //             await deletedMessage.save();
    //             console.log(`💾 Stored deleted message ${idStr} in DeletedMessageByGemmie collection`);
                
    //             // Delete the original message
    //             await Message.findByIdAndDelete(id);
    //             const eventData = { messageId: idStr };
    //             console.log('🗑️ About to trigger Pusher delete event with data:', eventData);
                
    //             // Ensure Pusher event is sent successfully before continuing
    //             try {
    //               await pusher.trigger('chat-room', 'delete-message', eventData);
    //               console.log(`🗑️ Successfully deleted repetitive Gemmie message index ${idx} (${idStr}) and triggered Pusher event`);
    //             } catch (pusherError) {
    //               console.error(`❌ Failed to trigger Pusher event for message ${idStr}:`, pusherError);
    //               // Continue processing even if Pusher fails - the message is still deleted
    //             }
    //           } else {
    //             console.log(`ℹ️ Message index ${idx} (${idStr}) not found or not Gemmie's, skipping delete`);
    //           }
    //         } catch (deleteError) {
    //           console.error(`❌ Failed to delete message index ${idx} (${idStr}):`, deleteError);
    //         }
    //       }
    //     } else {
    //       console.error('AI review failed:', reviewResponse.status);
    //     }
    //   } catch (reviewError) {
    //     console.error('Error in Gemmie self-review:', reviewError);
    //   }
    // }

    // Check Gemmie's recent messages for typos and edit if needed
    // Only run this logic if typos were actually added to the response
    if (hasTypos) {
      console.log('🔍 Checking Gemmie messages for typos (typos detected)...');
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const recentGemmieMessagesForEdit = await Message.find({
        userName: 'gemmie',
        timestamp: { $gte: twoMinutesAgo }
      })
        .sort({ timestamp: -1 })
        .limit(5)
        .select('_id content timestamp')
        .lean();

      if (recentGemmieMessagesForEdit.length > 0) {
      console.log(`📝 Edit check: Found ${recentGemmieMessagesForEdit.length} recent Gemmie messages to review`);
      console.log(`📝 User message: "${userName}: ${userMessage}"`);
      
      const messagesContext = recentGemmieMessagesForEdit.map((msg, index) =>
        `${index + 1}. ID: ${msg._id} Content: "${msg.content}" Time: ${new Date(msg.timestamp).toISOString()}`
      ).join('\n');

      console.log('📋 Detailed edit system debug info:');
      console.log('- User message for analysis:', `"${userName}: ${userMessage}"`);
      console.log('- Available messages for editing:');
      recentGemmieMessagesForEdit.forEach((msg, index) => {
        console.log(`  ${index + 1}. ID: ${msg._id}, Content: "${msg.content}", Time: ${new Date(msg.timestamp).toISOString()}`);
      });

      const reviewPrompt = `You are reviewing Gemmie's recent messages to decide whether one of them should be edited based on any common typos.

Recent Gemmie messages (1 = newest, 5 = oldest):
${messagesContext}

IMPORTANT RULES:
- You can ONLY edit Gemmie's most recent message (index 1) or the second most recent message (index 2)
- Do NOT edit messages from index 3 or higher (older messages)
- ALWAYS check for spelling errors, grammar mistakes, and typos FIRST, even without explicit user feedback
- Common typos to fix: "battallion" -> "battalion", "teh" -> "the" etc.
- common abbreviations are fine -> "everytime" instead of "every time", "alot" instead of "a lot", "dont" instead of "don't", "whats" instead of "what is", "cant" instead of "can't", "wont" instead of "won't", these are all fine
- Intentional slang/shortcuts that are OK: "gonna", "wanna", "gimme", "cause" (as in "because"), "cos" (as in "because")
- ONLY fix typos and grammar mistakes - NEVER change the meaning, context, or intent of the message
- DO NOT add new information or explanations
- DO NOT incorporate user names or external context into the message
- DO NOT fix shortforms of cities, towns, countries, like NYC, ny, AE, etc
- ONLY edit if there are clear typos or grammar errors that need fixing

Examples of CORRECT edits:
- "alot" → "a lot" (typo fix)
- "dont" → "don't" (grammar fix)
- "teh" → "the" (typo fix)

Examples of INCORRECT edits:
- Adding user names to the message
- Including external context or user information
- Changing the meaning or intent of the message
- Adding new information not in original message

Output ONLY valid JSON with this shape:

{"editIndex": 1, "newContent": "updated text here"}

If no edit is needed:

{"editIndex": null, "newContent": null}

Allowed indices: [1] or [2] only!`;

      try {
        console.log('🚀 Sending edit review prompt to AI...');
        const reviewResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com',
            'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gemma-4-26b-a4b-it',
            messages: [{ role: 'user', content: reviewPrompt }],
            max_tokens: 300,
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });

        if (reviewResponse.ok) {
          const data = await reviewResponse.json();
          const reviewText = data.choices[0]?.message?.content?.trim();
          console.log('🤖 AI review for editing:', reviewText);

          let editIndex: number | null = null;
          let newContent: string | null = null;
          let rawJsonExtracted = false;
          
          try {
            console.log('🔍 Attempting to parse JSON from AI response...');
            const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              console.log('✅ Found JSON object in response:', jsonMatch[0]);
              const parsed = JSON.parse(jsonMatch[0]);
              editIndex = typeof parsed.editIndex === 'number' ? parsed.editIndex : null;
newContent = typeof parsed.newContent === 'string' && parsed.newContent.length > 0 
  ? parsed.newContent 
  : null;
              rawJsonExtracted = true;
              console.log('✅ Successfully parsed JSON:', { editIndex, newContent });
            } else {
              console.log('❌ No JSON object found in AI response');
            }
          } catch (parseError) {
            console.error('❌ Failed to parse edit review JSON:', parseError);
            console.error('📝 Raw AI response that failed to parse:', reviewText);
          }

          // Additional validation for edit index restrictions
          if (editIndex !== null && (editIndex < 1 || editIndex > 2)) {
            console.log(`⚠️ Invalid edit index ${editIndex}, only indices 1 and 2 are allowed, setting to null`);
            editIndex = null;
            newContent = null;
          }

          if (editIndex !== null && newContent !== null && rawJsonExtracted) {
            const msgIndex = editIndex - 1;
            const msg = recentGemmieMessagesForEdit[msgIndex];
            const idStr = msg._id.toString();
            
            console.log(`🎯 Attempting to edit message index ${editIndex} (${idStr}) with new content: "${newContent}"`);
            
            try {
              const id = new mongoose.Types.ObjectId(idStr);
              const message = await Message.findById(id);
              if (message && message.userName === 'gemmie') {
                // Store the edit in the EditedMessageByGemmie collection
                const editedMessage = new EditedMessageByGemmie({
                  originalMessageId: id,
                  originalContent: message.content,
                  newContent: newContent,
                  editReason: 'user-feedback',
                  userName: message.userName,
                  userCountry: message.userCountry,
                  timestamp: message.timestamp,
                  attachments: message.attachments,
                  replyTo: message.replyTo,
                  reactions: message.reactions,
                  edited: message.edited,
                  editedAtOriginal: message.editedAt,
                  triggerMessage: `${userName}: ${userMessage}`,
                  aiPrompt: reviewPrompt
                });
                
                await editedMessage.save();
                console.log(`💾 Stored edited message ${idStr} in EditedMessageByGemmie collection`);
                
                // Update the original message
                message.content = newContent;
                message.edited = true;
                message.editedAt = new Date();
                await message.save();
                
                // Trigger Pusher event for real-time update
                const pusher = getPusherInstance();
                await pusher.trigger('chat-room', 'edit-message', {
                  messageId: idStr,
                  newContent: newContent
                });
                console.log(`✅ Successfully edited Gemmie message index ${editIndex} (${idStr})`);
              } else {
                console.log(`ℹ️ Message index ${editIndex} (${idStr}) not found or not Gemmie's, skipping edit`);
              }
            } catch (editError) {
              console.error(`❌ Failed to edit message index ${editIndex} (${idStr}):`, editError);
            }
          } else {
            console.log(`📋 Edit decision: editIndex=${editIndex}, newContent=${newContent}, rawJsonExtracted=${rawJsonExtracted}`);
            if (editIndex === null || newContent === null) {
              console.log('ℹ️ No edit needed or JSON parsing failed');
            }
          }
        } else {
          console.error('AI edit review failed:', reviewResponse.status);
          const errorText = await reviewResponse.text();
          console.error('📝 Error response from AI:', errorText);
        }
      } catch (reviewError) {
        console.error('❌ Error in Gemmie self-edit review:', reviewError);
      }
      }
    } else {
      console.log('✅ Skipping editing logic - no typos detected in response');
    }


    // --- Check for new messages that arrived during processing ---
    // This includes messages that arrived during the editing process
    // Add a small delay to ensure Pusher events are processed before checking queue
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { getAndClearGemmieQueue: getQueueAgain2, resetGemmieTimer: rescheduleJob, queueGemmieMessage: queueGemmieMessage2 } = await import('@/lib/gemmie-timer');
    const newlyQueuedMessages2 = await getQueueAgain2();
    
    let shouldClearJobActive = true; // Assume we'll clear the flag

    if (newlyQueuedMessages2.length > 0) {
      console.log(`📥 Found ${newlyQueuedMessages2.length} new message(s) in queue after processing. Rescheduling for the next one.`);
      
      const nextMessageToProcess = newlyQueuedMessages2[0]; // Process the oldest one next
      console.log('🔄 Scheduling next QStash job for:', nextMessageToProcess.userName);

      // Reschedule for the next message
      await rescheduleJob(nextMessageToProcess.userName, nextMessageToProcess.userMessage, nextMessageToProcess.userCountry);
      
      // Re-queue the remaining messages (if any)
      const remainingMessages = newlyQueuedMessages2.slice(1);
      for (const remainingMsg of remainingMessages) {
        await queueGemmieMessage2(remainingMsg.userName, remainingMsg.userMessage, remainingMsg.userCountry);
        console.log(`📝 Re-queued remaining message from: ${remainingMsg.userName}`);
      }
      
      console.log('✅ Next QStash job scheduled and remaining messages re-queued. gemmie:job-active remains set.');
      shouldClearJobActive = false; // Do not clear the flag, a new job is scheduled
    } else {
      console.log('🧹 No new messages found in queue after processing.');
    }
    
    if (shouldClearJobActive) {
      const { clearStuckJobActive, clearJobScheduled } = await import('@/lib/gemmie-timer');
      const wasStuck = await clearStuckJobActive();
      await clearJobScheduled();
      
      if (wasStuck) {
        console.log('🔓 Cleared stuck job active flag and job scheduled key as queue is now empty.');
      } else {
        console.log('🔓 Cleared job scheduled key as queue is now empty (job active flag was legitimate).');
      }
      
      // Log final job state
      const finalJobStatus = await (await import('@/lib/redis')).default.get('gemmie:job-active');
      console.log(`📋 Job state after clearing: job-active=${finalJobStatus}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error in delayed Gemmie response:', error);
    // Important: Do not clear job active flag here if the error is after rescheduling.
    // The finally block will handle cleanup for errors during the main processing part.
    return NextResponse.json({ error: 'Failed to process delayed response' }, { status: 500 });
  } finally {
    // Ensure job active flag is cleared only if an error occurred before
    // the main logic could decide to reschedule or clear it normally.
    // This is a fallback for unexpected errors.
    try {
      const { clearStuckJobActive, clearJobScheduled } = await import('@/lib/gemmie-timer');
      const redis = (await import('@/lib/redis')).default;
      const JOB_ACTIVE_KEY = 'gemmie:job-active';
      const isActive = await redis.get(JOB_ACTIVE_KEY);
      
      if (isActive === 'active') {
        // Use the stuck job detection logic in the finally block as well
        const wasStuck = await clearStuckJobActive();
        
        if (wasStuck) {
          await clearJobScheduled();
          console.log('🔓 Cleared stuck job active flag and job scheduled key in finally block.');
        } else {
          // Check if there are queued messages
          const { getAndClearGemmieQueue } = await import('@/lib/gemmie-timer');
          const queuedMessages = await getAndClearGemmieQueue();
          
          if (queuedMessages.length === 0) {
            await clearJobScheduled();
            console.log('🔓 Cleared job scheduled key in finally block (no queued messages).');
          } else {
            // Put messages back in queue and don't clear flag
            const { queueGemmieMessage } = await import('@/lib/gemmie-timer');
            for (const msg of queuedMessages) {
              await queueGemmieMessage(msg.userName, msg.userMessage, msg.userCountry);
            }
            console.log(`⚠️ Found ${queuedMessages.length} queued messages in finally block, keeping job active flag set.`);
          }
        }
      } else {
        console.log('ℹ️ Job active flag already cleared by main logic.');
      }
    } catch (releaseError) {
      console.error('❌ Failed to clear job active flag in finally block:', releaseError);
    }
  }
}

export const dynamic = 'force-dynamic';
