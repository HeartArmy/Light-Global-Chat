import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateGemmieResponse, generateGemmieResponseForContext, sendGemmieMessage, addProbabilisticTypos } from '@/lib/openrouter';
import { getPusherInstance } from '@/lib/pusher';
import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
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
  const contextMessages = recentMessages.slice(0, 20).map((msg, index) => {
    const flag = msg.userCountry ? getCountryFlag(msg.userCountry, msg.userName) : '🌍';
    return `${index + 1}. ${msg.userName} ${flag} from ${msg.userCountry} [${new Date(msg.timestamp).toISOString()}]: "${msg.content}"`;
  }).join('\n');

  const similarityPrompt = `You are checking if Gemmie's new response is a duplicate of her OWN previous responses. This mechanism exists because Gemmie is activated whenever ANY user sends a message, so when multiple users send messages in short succession, Gemmie might respond multiple times with similar content if not filtered.

BACKGROUND: This chatroom has a delayed response system where each user message can trigger Gemmie's response after a short delay. During message bursts (multiple messages in quick succession), this system might generate several Gemmie responses in sequence, potentially leading to repetitive content if not checked.

NEW RESPONSE FROM GEMMIE:
"${newResponse}"

FULL CONVERSATION CONTEXT (last 20 messages for understanding the flow):
${contextMessages}


IMPORTANT ANALYSIS RULES:
- You are ONLY checking for duplication between Gemmie's new response and her OWN previous messages
- IGNORE other users' messages for similarity comparison - they are just for context
- Look for repeated phrases, same intent, or very similar structure specifically in Gemmie's messages
- Check if Gemmie is answering the SAME question or topic repeatedly
- If the message you are about to send contradicts anything Gemmie has stated earlier in this conversation, do not send the message so SKIP.
- Look at the conversation history and see if the message to be send would be a red flag and giveaway that you are a bot, like if it's a semantic duplication, etc skip it. I need GEMMIE to pass turing test in this cool chatrooom.
- Look for patterns where Gemmie responds to incremental user messages with similar answers
- Minor word changes or punctuation differences don't count as different enough
- If multiple users are having similar conversations, Gemmie should vary her responses more
- If both messages are very short (under 10 words), be more strict about similarity
- If both messages are longer, allow some variation in expression
- Consider the context: if users are sending many messages quickly, Gemmie should avoid repetitive responses
- CRITICAL: Check if the new response is answering the same question/topic as previous responses
- DO NOT skip responses when different users are having separate conversations
- DO NOT skip responses that are appropriate greetings or basic interactions with different users
- DO NOT skip responses if there's been a significant time gap (30+ minutes) since the user's last message - this indicates a new session
- DO NOT skip responses if the user's current message is significantly different in topic or context from their previous messages
- DO NOT skip responses if the user is asking about a different subject/topic (e.g., switching from "blue" to "red")
- DO NOT skip responses if the user's message indicates a new question or different context
- DO NOT skip responses if the user is spelling out a different word or concept
- USE COMMON SENSE: If a human would consider this a reasonable response in this context, do NOT skip it
- THINK LIKE GEMMIE: Would Gemmie reasonably respond to this user message in this situation?

EXAMPLE SCENARIOS TO AVOID:
User: "what is this color"
User: "b"
User: "l"
User: "u"
User: "e"
Gemmie: "blue, this time u got it right lol" (GOOD - first response)
Gemmie: "Blue now huh, I see what you're doing there" (BAD - repetitive)
Gemmie: "blue? waht's with the spelling quiz lol u a bot or something" (BAD - repetitive)
Gemmie: "u know u can type whole words right" (BAD - repetitive)

Examples of what NOT to do (bot-like behavior):
🇨🇭 Nine
u got a good cake recipe ?
🇺🇸 gemmie
my go-to is chocolate cake, my grandma used to make it lol, simple but hits right, u need good vibes or what [BOT LIKE RESPONSE should have skipped]
🇨🇭 Nine
how to make it from scratch
🇺🇸 gemmie
mix flour sugar cocoa powder, baking soda, salt in one bowl, then eggs oil vanilla buttermilk in another, combine em and bake at 350, secret is buttermilk lol [BOT LIKE RESPONSE should have skipped]
🇨🇭 Nine
meh so u are a bot :/

STALE MESSAGE CHECK:
Before evaluating duplication, verify that the NEW RESPONSE is still relevant to the most recent user message.

CRITICAL: Check if the user has already COMPLETED their thought or answered their own question in subsequent messages. This is especially important when:
- User sends an incomplete question first, then completes it in later messages
- User asks "do you know somewhere like" then adds "i can access and intereact a lot of people easily" and "does not consist of a lot of kids like discord"
- User sends a fragmented message that gets completed by their own later messages

If the user has already responded to their own question, clarified it themselves, completed their thought, or moved the conversation forward before Gemmie's response would appear, SKIP the response.

If Gemmie's response answers a question that is no longer the latest unresolved user message, SKIP it.

If the response would feel delayed, out-of-context, or awkward to a human reader because the conversational turn has already passed, SKIP it.

SELF-ANSWERED QUESTION EXAMPLES:
User: "do you know somewhere like"
User: "i can access and intereact a lot of people easily"
User: "does not consist of a lot of kids like discord"
Gemmie: any response asking "like what?" or similar ❌ SKIP - user already completed their thought

User: "u smoke?"
User: "nvm lol"
Gemmie: any response about smoking ❌ SKIP - user already moved on

User: "i have a question? can i ask"
User: "u listen to music?"
Gemmie: "shoot ask away" ❌ SKIP - user already asked their question

Priority is always given to the latest user intent, not the message that originally triggered the response.

When in doubt, ask: "Would a human still respond to this, or has the conversation already moved on?"

TURN OWNERSHIP RULE:
If a user asks a question and then immediately answers it themselves or redirects the topic, Gemmie should not respond to the original question.

OUTDATED TURN EXAMPLE:
User: “question”
User: “u smoke?”
User: “nvm lol”
Gemmie: any response about smoking ❌ SKIP

OUTDATED TURN EXAMPLE:
User: "i have a question? can i ask"
User: “u listen to music?”
Gemmie: "shoot ask away" ❌ SKIP

CRITICAL RESPONSE GUIDELINES:
- NEVER give detailed instructions, recipes, or step-by-step explanations - this is a major bot giveaway
- If someone asks "how to make X" or "how do you do Y", give a brief, vague response like a normal person would
- Keep responses under 18 words [maximum word limit] when possible - real people don't type long paragraphs in chat, IF longer than this word limit, skip it
- If you don't know something, just say you don't know - don't make up detailed answers
- Act like you have limited knowledge about specific procedures, recipes, or technical instructions
- Prefer short, dismissive responses over helpful detailed explanations
- Remember: you're a 23yo casual texter from california, not a helpful assistant or encyclopedia, so your domain of what you know should be limited to this personality, so you cant have general knowledge of everything, like how far rome is from berlin by plane. Knowing everything about every domain is bot like. So if it doesnt make sense for your personality to know skip the message.

- IF IT DOESNT FULFIL THE RESPONSE GUIDELINE SKIP THE MESSAGE

EXAMPLE SCENARIOS TO ALLOW:
User Sam: "hi"
Gemmie: "hello back" (GOOD)
User Sarah: "hi"
Gemmie: "hey back" (GOOD - different user, should NOT be skipped)

User John: "how are you?"
Gemmie: "i'm good thanks" (GOOD)
User Mike: "how are you?"
Gemmie: "doing great!" (GOOD - different user, should NOT be skipped)

User Sam: "hi" [10:00 AM]
Gemmie: "hey there!" (GOOD)
User Sam: "hi" [1:00 PM - 3 hours later]
Gemmie: "hello back!" (GOOD - new session, significant time gap, should NOT be skipped)

User Alice: "what's up?" [12:00 PM]
Gemmie: "not much, you?" (GOOD)
User Alice: "need help" [12:01 PM - 1 minute later]
Gemmie: "sure, what's up?" (GOOD - different topic/context, should NOT be skipped)

User Bob: "what color is this?" [2:00 PM]
User Bob: "b"
User Bob: "l"
User Bob: "u"
User Bob: "e"
Gemmie: "blue?" (GOOD - first response to color question)
User Bob: "what about this?" [2:05 PM]
User Bob: "r"
User Bob: "e"
User Bob: "d"
Gemmie: "red?" (GOOD - different color, different question, should NOT be skipped)

User Charlie: "how are you?" [3:00 PM]
Gemmie: "i'm good thanks" (GOOD)
User Charlie: "how are you?" [3:01 PM - 1 minute later]
Gemmie: "doing great!" (BAD - same question, repetitive response, should be skipped)

Respond ONLY with a JSON object:
{"shouldSkip": true/false, "explanation": "brief reason"}

shouldSkip = true if Gemmie's new response is a duplicate of her OWN previous messages
shouldSkip = false if it's a new, unique response`;

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
        model: 'openrouter/free',
        messages: [{ role: 'user', content: similarityPrompt }],
        max_tokens: 32000,
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
    const messageAge = Math.floor(Date.now() / 1000) - parsedBody.timestamp;
    if (messageAge > MAX_MESSAGE_AGE_SECONDS) {
      console.log(`⚠️ Message too old (${messageAge}s), skipping`);
      return NextResponse.json({ success: true, skipped: true, reason: 'message-too-old' });
    }

    // Message Hash Check - Prevent duplicate processing
    const { createMessageHash, isMessageAlreadyProcessed, markMessageAsProcessed } = await import('@/lib/gemmie-timer');
    const messageHash = createMessageHash(userName, userMessage, parsedBody.timestamp);
    
    if (await isMessageAlreadyProcessed(messageHash)) {
      console.log(`⚠️ Message already processed (hash: ${messageHash}), skipping`);
      return NextResponse.json({ success: true, skipped: true, reason: 'already-processed' });
    }
    
    // Mark this message as processed
    await markMessageAsProcessed(messageHash);

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
    
    console.log(`🧠 Processing ${allMessagesForContext.length} messages (${recentQueuedMessages.length} recent queued, ${queuedMessagesAtStart.length - recentQueuedMessages.length} old messages ignored)`);

    console.log(`🧠 Generating AI response based on ${allMessagesForContext.length} messages...`);

    // Format messages for context with timestamp and country flag
    const formatMessageWithContext = (msg: any) => {
      const flag = msg.userCountry ? getCountryFlag(msg.userCountry, msg.userName) : '🌍';
      return `${msg.userName} ${flag} from ${msg.userCountry} [${new Date(msg.timestamp * 1000).toISOString()}]: ${msg.userMessage}`;
    };

    const contextString = allMessagesForContext.map(formatMessageWithContext).join('\n---\n');

    // Generate response using all messages as context
    const response = await generateGemmieResponseForContext(
      userName,
      contextString,
      userCountry,
      allMessagesForContext
    );
    console.log('💬 Generated response:', response);

    // Track if typos were added for conditional editing
    const originalResponse = response;
    const responseWithTypos = addProbabilisticTypos(response);
    const hasTypos = responseWithTypos !== response;
    
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
    // console.log('🔍 Checking for similarity with recent Gemmie messages only...');
    // const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    // // Get all recent messages for context (for AI understanding)
    // const allRecentMessages = await Message.find({
    //   timestamp: { $gte: twoMinutesAgo }
    // })
    //   .sort({ timestamp: -1 })
    //   .limit(20)
    //   .select('_id content userName userCountry timestamp')
    //   .lean();
    
    // // Get only Gemmie messages for similarity comparison
    // const gemmieMessages = await Message.find({
    //   userName: 'gemmie',
    //   timestamp: { $gte: twoMinutesAgo }
    // })
    //   .sort({ timestamp: -1 })
    //   .limit(20)
    //   .select('_id content userName userCountry timestamp')
    //   .lean();

    // // Check if this response is too similar to recent Gemmie messages
    // const similarityCheck = await checkResponseSimilarity(response, gemmieMessages);
    
    // if (similarityCheck.shouldSkip) {
    //   console.log(`⚠️ Response is a duplicate of recent message, skipping send`);
    //   console.log(`📝 Similar message: "${similarityCheck.similarMessage}"`);
    //   return NextResponse.json({ success: true, skipped: true, reason: 'similarity' });
    // }

    // 11-second cooldown check - prevent back-to-back Gemmie messages
    const COOLDOWN_SECONDS = 11;
    const twentySecondsAgo = new Date(Date.now() - COOLDOWN_SECONDS * 1000);
    const mostRecentGemmieMessage = await Message.findOne({
      userName: 'gemmie',
      timestamp: { $gte: twentySecondsAgo }
    })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean();
    
    if (mostRecentGemmieMessage) {
      const secondsSinceLastMessage = (Date.now() - new Date(mostRecentGemmieMessage.timestamp).getTime()) / 1000;
      console.log(`⏰ Cooldown check: Last Gemmie message was ${secondsSinceLastMessage.toFixed(1)}s ago (cooldown: ${COOLDOWN_SECONDS}s)`);
      
      if (secondsSinceLastMessage < COOLDOWN_SECONDS) {
        const remainingCooldown = COOLDOWN_SECONDS - secondsSinceLastMessage;
        console.log(`⚠️ Gemmie is in cooldown (${remainingCooldown.toFixed(1)}s remaining), skipping message send`);
        return NextResponse.json({ success: true, skipped: true, reason: 'cooldown' });
      }
    } else {
      console.log('✅ No recent Gemmie messages found, cooldown check passed');
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
    
    // Check for new messages that arrived during processing and schedule next job immediately
    // This allows the next job to start while editing happens concurrently
    const { getAndClearGemmieQueue: getQueueAgain1, resetGemmieTimer: scheduleNextJob, queueGemmieMessage: queueGemmieMessage1 } = await import('@/lib/gemmie-timer');
    const newlyQueuedMessages1 = await getQueueAgain1();
    
    if (newlyQueuedMessages1.length > 0) {
      console.log(`📥 Found ${newlyQueuedMessages1.length} new message(s) in queue after sending message. Scheduling next job immediately.`);
      
      const nextMessageToProcess = newlyQueuedMessages1[0]; // Process the oldest one next
      console.log('🔄 Scheduling next QStash job for:', nextMessageToProcess.userName);
      
      // Schedule the next job immediately after sending the current message
      await scheduleNextJob(nextMessageToProcess.userName, nextMessageToProcess.userMessage, nextMessageToProcess.userCountry);
      
      // Re-queue the remaining messages (if any)
      const remainingMessages = newlyQueuedMessages1.slice(1);
      for (const remainingMsg of remainingMessages) {
        await queueGemmieMessage1(remainingMsg.userName, remainingMsg.userMessage, remainingMsg.userCountry);
        console.log(`📝 Re-queued remaining message from: ${remainingMsg.userName}`);
      }
      
      console.log('✅ Next QStash job scheduled immediately. Editing will happen concurrently.');
    }

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
    //         model: 'nvidia/nemotron-nano-12b-v2-vl:free',
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
- "everytime" → "every time" (typo fix)
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
            model: 'openrouter/free',
            messages: [{ role: 'user', content: reviewPrompt }],
            max_tokens: 32000,
            temperature: 0.1
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
              editIndex = parsed.editIndex !== null ? parseInt(parsed.editIndex) : null;
              newContent = parsed.newContent || null;
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
