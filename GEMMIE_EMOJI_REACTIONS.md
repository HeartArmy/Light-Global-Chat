# Gemmie Emoji Reactions Implementation

## Overview

This implementation adds human-like emoji reactions from Gemmie to user messages in the chat. The system is designed to feel natural and not robotic by incorporating timing controls, frequency limits, and context-aware emoji selection.

## Features

### 1. AI-Powered Emoji Selection
Gemmie uses the same OpenRouter AI model to intelligently choose emojis based on message content:
- **❤️** - Love, appreciation, warm feelings  
- **😂** - Funny content, laughter, jokes
- **👋** - Greetings, hellos, salutations
- **😢** - Sad content, complaints, negative emotions

The AI analyzes context, tone, and sentiment to pick the most appropriate emoji, making reactions feel more natural and human-like.

### 2. Human-Like Behavior Controls
- **Cooldown System**: 1-5 minute intervals between reactions
- **Daily Limit**: Maximum 8 reactions per day
- **Random Probability**: 15% base chance to react
- **No Spam**: Each message can only be reacted to once
- **Time-Based Adjustment**: Higher chance to react if more time has passed since last reaction

### 3. Technical Implementation
- Uses Redis for state management and cooldown tracking
- Integrates seamlessly with existing message processing flow
- Real-time updates via Pusher events
- Proper error handling and logging

## Files Modified/Added

### New Files
- `lib/gemmie-reactions.ts` - Core reaction logic and Redis operations
- `lib/test-gemmie-reactions.ts` - Testing utilities
- `GEMMIE_EMOJI_REACTIONS.md` - This documentation

### Modified Files  
- `app/api/messages/route.ts` - Added emoji reaction logic to message creation

## How It Works

### 1. Message Processing Flow
1. User sends a message
2. Message is validated and saved to database
3. **NEW**: Check if Gemmie should react with emoji
4. If yes: Select appropriate emoji, add reaction, update database
5. Trigger Pusher event for real-time emoji display
6. Continue with existing Gemmie response logic

### 2. Reaction Decision Process
```typescript
// Check multiple conditions before reacting
const shouldReact = await shouldGemmieReact(messageId);
if (shouldReact) {
  const emoji = selectEmojiForMessage(content);
  // Add reaction to message
  // Update database
  // Trigger real-time event
}
```



## Configuration

### Reaction Settings
```typescript
const MIN_REACTION_INTERVAL = 60;    // 1 minute minimum
const MAX_REACTION_INTERVAL = 300;    // 5 minutes maximum  
const DAILY_REACTION_LIMIT = 8;       // 8 reactions per day
const baseReactionChance = 0.15;      // 15% base probability
```

### Available Emojis
- ❤️ (Heart) 
- 😂 (Laughing/crying)
- 👋 (Waving hand)
- 😢 (Crying/sad)

## Testing

Run the test suite to verify functionality:

```bash
# Execute the test file
node lib/test-gemmie-reactions.ts
```

The test will:
- Verify emoji selection logic
- Test reaction probability (should be ~15%)
- Check duplicate prevention
- Validate Redis operations

## Monitoring

### Reaction Statistics
```typescript
const stats = await getReactionStats();
console.log(`Today's reactions: ${stats.today}`);
console.log(`Last reaction: ${stats.lastReaction}`);
```

### Redis Keys Used
- `gemmie:last-emoji-reaction` - Timestamp of last reaction
- `gemmie:reaction-cooldown` - Cooldown expiration time
- `gemmie:reaction-count:YYYY-MM-DD` - Daily reaction count
- `gemmie:reacted-messages` - Set of already reacted message IDs

## Integration Notes

### Compatibility
- Works alongside existing Gemmie AI response system
- Does not interfere with user emoji reactions
- Maintains existing message editing/deletion functionality

### Performance
- Minimal Redis operations per message
- Reaction check happens before expensive AI processing
- Efficient cooldown and limit checking

### Error Handling
- Graceful fallbacks if Redis is unavailable
- No impact on message creation if reaction fails
- Comprehensive logging for debugging

## Example Usage

### User Message Flow
1. User sends: "This is awesome! 🔥"
2. System checks: Should Gemmie react? (15% chance + timing)
3. If yes: Select emoji → "❤️" 
4. Add reaction: `[{emoji: "❤️", userName: "gemmie"}]`
5. Update database and trigger real-time event
6. Continue with normal message processing

### Result in Chat
```
User: This is awesome! 🔥
[Message appears with ❤️ gemmie reaction]
```

## Future Enhancements

Potential improvements that could be added:
- Machine learning for better emoji selection
- User-specific reaction patterns
- Reaction timing based on time of day
- Special reactions for holidays/events
- Integration with message sentiment analysis

## Troubleshooting

### Common Issues
1. **No reactions happening**: Check Redis connection and daily limits
2. **Too many reactions**: Verify cooldown settings in environment
3. **Wrong emojis**: Review content matching logic in `selectEmojiForMessage`

### Debug Logging
The system includes comprehensive logging:
- Reaction decision process
- Emoji selection reasoning  
- Redis operations
- Error conditions

Enable debug logging by checking the console output in your application logs.
