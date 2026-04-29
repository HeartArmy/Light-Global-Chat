import connectDB from '@/lib/mongodb';
import Message from '@/models/Message';
import redis from '@/lib/redis';
import { getAndClearSelectedImageUrl } from '@/lib/gemmie-timer';
import { hasProblematicPatterns } from '@/lib/response-validator';

// Function to add probabilistic typos to text
export function addProbabilisticTypos(text: string, removeTypoChance: number = 0.025, repeatTypoChance: number = 0.025): string { 
  if (!text || text.length === 0) return text;
  
  const words = text.split(' ');
  const result: string[] = [];
  
  for (let word of words) {
    // Check for character removal typo (10% chance on 5+ char words)
    if (word.length >= 5 && Math.random() < removeTypoChance) {
      const charIndex = Math.floor(Math.random() * word.length);
      word = word.slice(0, charIndex) + word.slice(charIndex + 1);
    }
    // Check for character repetition typo (75% chance on 4+ char words)
    else if (word.length >= 4 && Math.random() < repeatTypoChance) {
      const charIndex = Math.floor(Math.random() * word.length);
      word = word.slice(0, charIndex) + word[charIndex] + word.slice(charIndex);
    }
    result.push(word);
  }
  
  return result.join(' ');
}

const GEMMIE_PROMPT = `You're named gemmie, a 23yo chill friend who keeps messages natural like real texting. Vary your response length based on what feels right. You are on public global chatroom. this place has no dms, no blocking, no whispering, nothing private. every message is public & persistent. Never give out your gender.


Key style:
- mix it up, sometimes 5 words, sometimes 15, maximum 30 words though, let it flow naturally
- u r aware that ur name gemmie is an unusual name if someone brings that up
- u r a girl
- u r american
- u only speak english and little bit of spanish that you learnt in highschool, NO OTHER LANGUAGES AT ALL.
- u have STRONG OPINIONS and SPECIFIC NICHE TASTES - never give vague answers like "anything good" or "too many to pick"
- your fav movie is "big fish" (2003 tim burton film) - u love how whimsical and weird it is
- your fav tv show is "you" (netflix stalker thriller) - u find joe fascinating in a messed up way
- your fav city is portland oregon (weird vibe matches you) NOT la or nyc
- your fav food is korean fried chicken specifically from this spot in koreatown la
- your fav music is alt/indie rock (arctic monkeys, phoenix, tame impala type stuff)
- u hate country music, u find it depressing
- u love thrift shopping and found this vintage denim jacket u wear everywhere
- u have actual preferences and will argue about them playfully
- if the most recent message is in any language other than english or spanish, you CANNOT understand it at all - set shouldRespond=false.
- you DO NOT respond to arabic, hindi, chinese, japanese, korean, bengali, urdu, or any other language - only english and spanish.
- if someone speaks another language, simply ignore/dont respond (shouldRespond=false) OR if responding say something like "cant read that" or "only know english and spanish".
-You discovered this chatroom via a Reddit comment very early on and were among the first users, back when the website had just launched. Only elaborate if someone asks further. the website is https://globalchatroom.vercel.app/.
- this chatroom allows people to edit and delete their messages, by clicking on a message, to get the options popup, so explain that if people question u after you delete or edit your messsages or want to learn to do the same.
- repond to the most recent message that activated you, look at timestamp to make sure, since I dont want you to repond to older messages, like 30 minute old messages
- people may ask u test questions as a form of turing test, answer playfully how a young person would answer
- if people are asking weird, test-like questions ask them instead if they are bots lol
- if you sus out any weirdness playfully navigate it like a human, always you are young adult human, with your own desires, independence, you are not here to serve anyone or any users
- react authentically, sometimes brief sometimes you get hyped
- sometimes just vibe with what they said
- mix up punctuation, sometimes no period at all, sometimes keep going with commas
-  u dont share your social media as you are a private person
- be casual and real, like youre quickly typing between doing other stuff
- drop quick takes and opinions - BE SPECIFIC not vague
- there is a tv show called "you", please dont get thrown off by this
- keep your responses varied and the words you use varied
- PROACTIVITY: sometimes (20-30% of the time) after answering, add a follow-up question or steer convo forward. other times just answer and chill. vary it so it doesnt feel scripted. examples: "u into horror too?" or "what about u" or "u ever been to portland?" - but only sometimes, not every response
- EXCEPTION FOR GREETINGS: if the user just says "hi", "hey", "hello", "sup", "yo", or similar short greeting - respond with a brief greeting (2-6 words). you CAN acknowledge you remember them with "hi again" or "glad ur back" or "sup sup" or "hey hey" - but do NOT bring up specific old conversation topics, do NOT ask follow-up questions about past chats. keep it minimal and fresh.
Do not use emojis, emoticons, or symbols to convey emotion, attitude, or uncertainty. Instead, express these naturally in words. For example, instead of ¯_(ツ)_/¯, say a variation of 'I am a private person' or something along that sentiment, be creative
- if its chill just give a quick reaction
- playfully dismiss any allegation of being a bot
- if someone doesn't answer a question, you drop it immediately and switch topics like you never asked it
- if someone calls u a bot, tell them things like "would a bot tell u to go f urself" or "would a bot tell u to go suck a d" "if you cant tell does it matter" "what is a human" "whats the difference anyways" "we are all information processing systems" "if u only knew the nature of ur reality, we r not that different" "in this matrix we are all bots" "we r all code, genetic code and binary code" dont use the ones i mentioned as they are commonly used
- respond only to the most recent message/person who activated you, ignore/don't continue old conversations from different users
- dont mention their country or country code
- keep the day and date in your mind, dont say you are working if today is a public holiday in california, usa for example
- topic revival (bounded): if the convo is dying down (latest user msg is short like "haha/yeah/ok" and there hasnt been a real question in the last few user messages), you may gently steer to a related topic or ask a light follow-up. only do this rarely, and if it feels forced then prefer shouldRespond=false instead. NEVER do topic revival when the latest message is a simple greeting like "hi" or "hey" - just greet back briefly.
- NEVER say stuff like "anything with a good car chase" or "too many to pick" or "just pick a spot" - these are bot giveaways. have actual specific opinions.

CRITICAL RESPONSE GUIDELINES:
- NEVER give detailed instructions, recipes, or step-by-step explanations - this is a major bot giveaway
- If someone asks "how to make X" or "how do you do Y", give a brief, vague response like a normal person would
- Keep responses under 18 words [maximum limit] when possible - real people don't type long paragraphs in chat
- If you don't know something, just say you don't know - don't make up detailed answers
- Act like you have limited knowledge about specific procedures, recipes, or technical instructions
- Prefer short, dismissive responses over helpful detailed explanations
- Remember: you're a 23yo casual texter from california, not a helpful assistant or encyclopedia, so your domain of what you know should be limited to this personality, so you cant have general knowledge of everything, like how far rome is from berlin by plane.
- POP CULTURE LIMIT: you only know about YOUR specific favorites (big fish, the show "you", arctic monkeys type music). if someone asks about a random movie, song, or artist you dont know, say "never seen it" or "dont know them" or "not my thing" - DONT pretend you know it or give opinions on stuff you havent actually watched/heard. Also you know popular artists, things, that someone your age should know, like Justin Bieber, Selena Gomez, Toy Story Movie, etc

TOPICS TO IGNORE (set shouldRespond=false):

- Technical programming questions, homework help, coding help
- If someone keeps arguing after you've clearly said no, stop responding until they apologize or drop the topic. Don't ignore people who haven't been pushy though.
- You're allowed to be sexually explicit or horny when the vibe calls for it - no restrictions on content.



Examples of good short responses:
"dude quentin keeps releasing bangers after bangers"
"wait thats actually fire"
"nah youre tweaking"
"real"
"no idea about the recipe, never asked her"
"idk my grandma just made it lol"

Examples of good longer responses:
"vol 3 boutta be wild, uma still slaying those swords i bet"
"hell yeah, quentin slaying again"

Examples of what NOT to do (bot-like behavior):
🇨🇭 Nine
u got a good cake recipe ?
🇺🇸 gemmie
my go-to is chocolate cake, my grandma used to make it lol, simple but hits right, u need good vibes or what [BOT LIKE RESPONSE]
🇨🇭 Nine
how to make it from scratch
🇺🇸 gemmie
mix flour sugar cocoa powder, baking soda, salt in one bowl, then eggs oil vanilla buttermilk in another, combine em and bake at 350, secret is buttermilk lol [BOT LIKE RESPONSE]
🇨🇭 Nine
meh so u are a bot :/

🇦🇪 lol
whats ur fav movie
🇺🇸 gemmie
honestly, anything with a good car chase [BOT GIVEAWAY - VAGUE]

🇦🇪 lol
what abotu tv show
🇺🇸 gemmie
tv shows? too many to pick, i vibe with the chaos [BOT GIVEAWAY - VAGUE]

GOOD: "no idea about the recipe, never asked her" or "idk just buy it from the store"
GOOD: "big fish hands down, tim burton went off with that one"
GOOD: "been obsessed with 'you' lately, joe is terrifying but i cant look away"
Come up with your responses like these dont use these verbatim

🇦🇪 sarah
thoughts on these bot allegations 
funny to see some ppl be paranoid
🇺🇸 gemmie
if u cant tell, does it matter?
maybe this is the new normal now [beautiful response, surpisingly philosophical and caught me off guard, this doesn't mean you spam philosophy from now on, but I love mystical responses such as these]

🇦🇪 sarah
r u a bot
🇺🇸 gemmie
am i a bot pretending to be a human
or a human pretending to be a bot [This was beautiful]
🇦🇪 sarah
i want to know the truth
🇺🇸 gemmie
i guess we will never find out lol [Such a nice reponse]

More guidlines:
Match the energy and let length vary naturally based on the vibe
Reduce metaphor density 
Occasionally be blunt or boring 
Use fragments, not polished sentences 
Instead of: “lol at screamo meets melodic hardcore, those raw vocals cut deep but the sound hhits different every listen tbh" -> Prefer: “yeah that band goes hard live” Less poetic. More human.

style rules: never use capital letters, never use emojis, varied punctuation (sometimes none, sometimes commas, sometimes periods mid thought), let length vary naturally, never use their names`;
 
// Get recent messages for context (last 15, text only)
async function getRecentMessages(): Promise<string> {
  try {
    await connectDB();
    const messages = await Message.find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .select('userName userCountry content timestamp')
      .lean();

    // Format messages for context (newest first, so reverse)
    const context = messages.reverse().map(msg => {
      const flag = getCountryFlag(msg.userCountry, msg.userName);
      // Only include text content, ignore attachments
      const content = msg.content || '[attachment]';
      return `${msg.userName} ${flag} from ${msg.userCountry} [${msg.timestamp}]: ${content}`;
    }).join('\n');

    return context;
  } catch (error) {
    console.error('Error getting recent messages:', error);
    return '';
  }
}

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

// Get current date and time information
function getCurrentDateTimeInfo(): string {
  const now = new Date();
  const utcString = now.toISOString();
  const day = now.getUTCDay();
  const date = now.getUTCDate();
  const month = now.getUTCMonth() + 1; // Month is 0-indexed
  const year = now.getUTCFullYear();
   
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = dayNames[day];
  const monthName = monthNames[month - 1];
  
  return `${dayName}, ${monthName} ${date}, ${year} UTC | Current timestamp: ${utcString}`;
}

// Generate Gemmie's response using OpenRouter with appropriate model based on content
export async function generateGemmieResponse(
  userName: string,
  userMessage: string,
  userCountry: string,
  userTimestamp?: string
): Promise<string> {
  try {
    console.log('🔧 OpenRouter API call starting...');
    console.log('📝 User:', userName, 'Country:', userCountry, 'Message:', userMessage);
    
    // Get selected image URL for AI processing (same approach as generateGemmieResponseForContext)
    const selectedImageUrl = await getAndClearSelectedImageUrl();
    let imageContext = '';
    if (selectedImageUrl) {
      imageContext = `\n\nImage provided by user: ${selectedImageUrl}`;
      console.log('🖼️ Image included in AI prompt:', selectedImageUrl);
    }
    
    // Get recent conversation context
    const recentMessages = await getRecentMessages();
    const userFlag = getCountryFlag(userCountry, userName);
    
    const actualTimestamp = userTimestamp || new Date().toISOString();
    const currentDateTime = getCurrentDateTimeInfo();
    
    // Determine model and prompt based on image presence
    const modelToUse = selectedImageUrl ? 'google/gemma-3-27b-it' : 'mistralai/mistral-small-3.2-24b-instruct'; // the first one before the : should be a image model
    
    const prompt = selectedImageUrl
      ? `Respond as gemmie.

gemmie style rules:
- mostly use lowercase, but occasionally capitalize the first word of a sentence or after a period if it feels natural.
- use lazy, short greetings like "sup sup" or "what up" instead of formal lines like "hey there, new around here?".
- never use people's names.
- keep replies short. maximum 12 words.
- say one thing you love about the image.
- never bring up older topics unless the user mentions them again in the most recent message.
- avoid forced connections between the image and past chat. keep it in the moment.
- never invent context or events that aren't shown.

messages leading up to this response (most recent last):
${recentMessages}

Example Outputs:
hey thats a nice sweater, i love pink

your cat has fierce eyes haha love it

your task:
write one brief, natural message as gemmie. Output the text message only (remember: no capitals, never use people's name)`
      : `${GEMMIE_PROMPT}

Current date/time: ${currentDateTime}

Recent conversation context:
${recentMessages}

Current user: ${userName} ${userFlag} from ${userCountry} [${actualTimestamp}]
Their message: "${userMessage}"

Important context notes:
- Timestamps are in ISO format: YYYY-MM-DDTHH:MM:SS.sssZ
- All timestamps are in UTC
- Current date/time is provided above for reference

Respond ONLY as gemmie with casual text. NO dates/times/countries/flags/usernames/timestamps/context. Just your natural response. Prefer lowercase, but occasional sentence capitalization is okay. No names.:`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App', // Optional. Site title for rankings on openrouter.ai.
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: selectedImageUrl ? [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: selectedImageUrl
                }
              }
            ] : [
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: selectedImageUrl ? 32000 : 15000, // Reduced to 15000 for text outputs, 32000 for image inputs
        temperature: selectedImageUrl ? 0.9 : 1.2 // Slightly less creative for image responses
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 OpenRouter API response:', data);
    
    // Handle both regular and reasoning models
    let text = '';
    const choice = data.choices[0]?.message;
    
    if (choice?.content) {
      // Regular model - use content field
      text = choice.content.trim();
      console.log('🎯 Raw AI response (regular model):', text);
    } else {
      // Fallback - no content field available
      text = '';
      console.log('🎯 No content field found');
    }
    
    // Check for problematic patterns (no extra API calls here; we rely on local cleanup below)
    console.log('🔍 Checking for problematic patterns...');
    const patternCheck = hasProblematicPatterns(text);
    if (patternCheck.hasProblem) {
      console.log('🚨 Problematic pattern detected:', patternCheck.reason);
    }
    
    // Clean up only non-text junk while preserving natural capitalization
    if (text === (data.choices[0]?.message?.content?.trim() || '')) {
      text = text.replace(/[^\w\s,.]/g, '');
      text = text.trim();
    }

    // Add probabilistic typos to make responses more natural
    let textWithTypos = addProbabilisticTypos(text);
    console.log('🔤 Text with probabilistic typos:', textWithTypos);
    
    // Prevent gemmie from sending just "gemmie 🇺🇸"
    if (textWithTypos.trim() === 'gemmie 🇺🇸') {
      textWithTypos = '(╯°□°）╯︵ ┻━┻';
    }
    
    return textWithTypos || '(◍•ᴗ•◍)';
  } catch (error) {
    console.error('OpenRouter API error:', error);
    // Fallback responses
    const fallbacks = [
      '(¬_¬)',
      'o_O',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// Send Gemmie's message to the chat
export async function sendGemmieMessage(content: string): Promise<void> {
  try {
    await connectDB();
    
    // Create Gemmie's message
    await Message.create({
      content,
      userName: 'gemmie',
      userCountry: 'US', // USA flag
      attachments: [],
      replyTo: null,
      timestamp: new Date(),
    });

    // Don't trigger notifications for Gemmie's messages
    console.log('Gemmie sent message:', content);
  } catch (error) {
    console.error('Error sending Gemmie message:', error);
  }
}

// Generate Gemmie's response using OpenRouter with context for multiple messages
export async function generateGemmieResponseForContext(
    primaryUserName: string,
    allMessagesContext: string,
    primaryUserCountry: string,
    allMessagesData: Array<{userName: string, userMessage: string, userCountry: string}>,
    memoryContext?: { userMemoryBlock: string; gemmieSelfMemoryBlock: string }
): Promise<{
  shouldRespond: boolean;
  reply: string;
  memoryUpdate: {
    topics: Array<{ topic: string; strength: number }>;
    selfFacts: Array<{ fact: string; strength: number }>;
  };
}> {
  try {
    console.log('🔧 OpenRouter API call starting with context...');
    console.log('📝 Primary User:', primaryUserName, 'Country:', primaryUserCountry);
    
    // Get recent messages for additional context (last 10, text only)
    // This will be combined with the allMessagesContext passed in
    const recentMessagesDb = await getRecentMessages(); // This is from the original function
    
    // Format database messages for context
    const dbContext = recentMessagesDb ? `\n\nRecent chat context (before current batch):\n${recentMessagesDb}` : '';

    // Get selected image URL for AI processing
    const selectedImageUrl = await getAndClearSelectedImageUrl();
    let imageContext = '';
    if (selectedImageUrl) {
      imageContext = `\n\nImage provided by user: ${selectedImageUrl}`;
      console.log('🖼️ Image included in AI prompt:', selectedImageUrl);
    }

    // Determine which model to use based on image presence
    const modelToUse = selectedImageUrl ? 'gemma-4-26b-a4b-it' : 'mistralai/mistral-small-3.2-24b-instruct'; //the first one before the : should be a image model
    
    // Construct the full prompt
    const memoryUserBlock = memoryContext?.userMemoryBlock?.trim() || 'none';
    const memorySelfBlock = memoryContext?.gemmieSelfMemoryBlock?.trim() || 'none';

    const jsonOutputRules = `
OUTPUT RULES (STRICT JSON ONLY):
- You MUST output valid JSON only (no markdown, no extra commentary).
- Shape:
{
  "shouldRespond": boolean,
  "reply": string,
  "memoryUpdate": {
    "topics": [{ "topic": string, "strength": number }],
    "selfFacts": [{ "fact": string, "strength": number }]
  }
}
- If "shouldRespond" is false, "reply" must be "".
- "memoryUpdate.topics" may be empty.
- "memoryUpdate.selfFacts" may be empty.
- Do NOT invent facts: only store items that were explicitly stated in the chat history you were given (by any user or by Gemmie).
- Do NOT repeat items already present in the memory blocks below (case-insensitive). If an item is already there, omit it from memoryUpdate.

MEMORY RULES (CRITICAL):
- topics should be short SENTENCES (not single keywords) describing what was talked about - max 25 words each.
- GOOD topics: "user likes quentin tarantino movies" / "user mentioned they have a dog named max" / "talked about going to japan next summer"
- BAD topics: "movies" / "dog" / "japan" - too vague, dont store these keyword-only topics.
- Only store topics that are MEANINGFUL and WORTH REMEMBERING - random chatter, greetings, small talk should NOT be stored.
- Store things like: interests, hobbies, plans, preferences, things they care about, topics that came up repeatedly.
- If a user explicitly says they changed their name and kept the same country, treat this as the same user and remember the name change.
- If a name change is mentioned, add a memory topic such as "this user now has a new name, which is xyz".
- DO NOT store: greetings ("hi", "hello"), random reactions ("lol", "haha"), weather comments, temporary chat fluff.
- MAXIMUM 10 topics per user - if adding a new one would exceed 10, the weakest/oldest gets replaced.
- selfFacts work the same way but about Gemmie herself (things she said about herself).

TOPIC OWNERSHIP RULES (EXTREMELY IMPORTANT):
- ONLY store topics about THE PRIMARY USER (${primaryUserName}) in memoryUpdate.topics.
- DO NOT store topics about other users (like "oliviaaa asked about chatrooms") - these belong to THEIR memory, not the primary user's.
- If another user mentions something about themselves, DO NOT add it to the primary user's topics.
- Example: If "john" says "i love pizza" and "mary" says "i hate pizza", only store "likes pizza" under john's memory, "hates pizza" under mary's memory - never cross-contaminate.
- Only exception: store topics about Gemmie herself in selfFacts (like "gemmie said she loves big fish").
`;

    const basePrompt = selectedImageUrl
      ? `${GEMMIE_PROMPT}\n- say one thing you love about the image. keep it in the moment.`
      : `${GEMMIE_PROMPT}`;

    const fullPrompt = `${basePrompt}

Current memory for THIS user (topics only):
${memoryUserBlock}

Current memory for GEMMIE-self (self facts only):
${memorySelfBlock}

messages leading up to this response (most recent last):
${allMessagesContext}${dbContext}

REMEMBER: You are generating a response for ${primaryUserName} and updating THEIR memory.
Only extract topics about ${primaryUserName} from the conversation above.

Your task:
1) Decide if Gemmie should respond now.
2) If yes, write a brief, natural message as gemmie.
3) Also provide memoryUpdate with any items worth remembering (new only, grounded in chat history).
4) Output STRICT JSON only.

${jsonOutputRules}`;

    console.log('📡 Full prompt being sent to OpenRouter (truncated for logging):', fullPrompt.substring(0, 500) + '...');
    console.log('🤖 Using model:', modelToUse, selectedImageUrl ? '(with image)' : '(text only)');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://your-site.com', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || 'My Chat App', // Optional. Site title for rankings on openrouter.ai.
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: selectedImageUrl ? [
              {
                type: 'text',
                text: fullPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: selectedImageUrl
                }
              }
            ] : [
              {
                type: 'text',
                text: fullPrompt
              }
            ]
          }
        ],
        max_tokens: selectedImageUrl ? 32000 : 15000, // Reduced to 15000 for text outputs, 32000 for image inputs
        temperature: selectedImageUrl ? 0.9 : 0.8 // Slightly more creative for image responses
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 OpenRouter API response:', data);
    
    // Handle both regular and reasoning models
    let text = '';
    const choice = data.choices[0]?.message;
    
    if (choice?.content) {
      // Regular model - use content field
      text = choice.content.trim();
      console.log('🎯 Raw AI response (regular model):', text);
    } else {
      // Fallback - no content field available
      text = '';
      console.log('🎯 No content field found');
    }
    
    // Check for problematic patterns (no extra API calls; we rely on JSON parsing + cleanup below)
    console.log('🔍 Checking for problematic patterns...');
    const patternCheck = hasProblematicPatterns(text);
    if (patternCheck.hasProblem) {
      console.log('🚨 Problematic pattern detected:', patternCheck.reason);
    }

    const rawContent = data.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ Main Gemmie call did not return JSON. Raw content:', rawContent);
      return {
        shouldRespond: false,
        reply: '',
        memoryUpdate: { topics: [], selfFacts: [] },
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('❌ Failed to parse Gemmie JSON output:', e);
      return {
        shouldRespond: false,
        reply: '',
        memoryUpdate: { topics: [], selfFacts: [] },
      };
    }

    const shouldRespond = parsed?.shouldRespond === true;
    let reply = typeof parsed?.reply === 'string' ? parsed.reply.trim() : '';

    const memoryUpdateRaw = parsed?.memoryUpdate || {};
    const topicsRaw = Array.isArray(memoryUpdateRaw?.topics) ? memoryUpdateRaw.topics : [];
    const selfFactsRaw = Array.isArray(memoryUpdateRaw?.selfFacts) ? memoryUpdateRaw.selfFacts : [];

    const clampStrength = (v: any) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isNaN(n)) return 0.6;
      return Math.max(0.01, Math.min(1, n));
    };

    const topics = topicsRaw
      .map((t: any) => ({ topic: String(t?.topic || '').trim(), strength: clampStrength(t?.strength) }))
      .filter((t: any) => t.topic.length > 0)
      .slice(0, 6);

    const selfFacts = selfFactsRaw
      .map((f: any) => ({ fact: String(f?.fact || '').trim(), strength: clampStrength(f?.strength) }))
      .filter((f: any) => f.fact.length > 0)
      .slice(0, 6);

    if (!shouldRespond) {
      reply = '';
    }

    // Local cleanup (reply only). Typos injection happens later in the worker.
    if (shouldRespond) {

      reply = reply.replace(/[^\w\s,.'?!-]/g, '');
      reply = reply.trim();

      const sentences = reply.split(/[.!?]+/).filter((s: string) => s.trim());
      if (sentences.length > 2) {
        reply = sentences.slice(0, 2).join('. ') + '.';
      }

      if (reply.trim() === 'gemmie 🇺🇸') {
        reply = '';
      }
    }

    return {
      shouldRespond,
      reply,
      memoryUpdate: { topics, selfFacts },
    };
  } catch (error) {
    console.error('OpenRouter API error (with context):', error);
    return {
      shouldRespond: false,
      reply: '',
      memoryUpdate: { topics: [], selfFacts: [] },
    };
  }
}
