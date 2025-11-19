// Test script for delayed emoji reactions
console.log('⏰ Testing Delayed Emoji Reaction System...\n');

// Simulate the processDelayedEmojiReaction function
async function simulateDelayedEmojiReaction(messageId, messageContent) {
  console.log(`📨 New message received: "${messageContent}"`);
  console.log(`🆔 Message ID: ${messageId}`);
  
  // Simulate shouldGemmieReact logic (15% chance)
  const shouldReact = Math.random() < 0.15;
  
  if (shouldReact) {
    console.log(`⏰ Gemmie will react to message ${messageId} in 10 seconds...`);
    
    // Use setTimeout to delay the reaction
    setTimeout(async () => {
      try {
        // Simulate emoji selection
        const lowerContent = messageContent.toLowerCase().trim();
        let emoji;
        
        if (lowerContent.includes('love') || lowerContent.includes('❤️') || lowerContent.includes('<3')) {
          emoji = '❤️';
        } else if (lowerContent.includes('haha') || lowerContent.includes('lol') || lowerContent.includes('funny')) {
          emoji = '😂';
        } else if (lowerContent.includes('hi') || lowerContent.includes('hello') || lowerContent.includes('hey')) {
          emoji = '👋';
        } else if (lowerContent.includes('sad') || lowerContent.includes('bad') || lowerContent.includes('hate')) {
          emoji = '😢';
        } else if (lowerContent.includes('!') || lowerContent.includes('awesome') || lowerContent.includes('great') || lowerContent.includes('cool')) {
          emoji = '❤️';
        } else {
          emoji = '❤️';
        }
        
        console.log(`🎭 Gemmie reacted to message ${messageId} with ${emoji} after delay`);
        console.log(`💬 Message: "${messageContent}" → ${emoji}`);
        
      } catch (error) {
        console.error('❌ Error during delayed emoji reaction:', error);
      }
    }, 10000); // 10 second delay
    
  } else {
    console.log(`⏭️ Gemmie decided not to react to message ${messageId}`);
  }
}

/**
 * Test function to verify delayed emoji reaction system
 */
async function testDelayedEmojiReactions() {
  console.log('🎯 Testing delayed emoji reactions:\n');
  
  const testMessages = [
    { id: 'msg-001', content: 'this is awesome!' },
    { id: 'msg-002', content: 'haha that is so funny 😂' },
    { id: 'msg-003', content: 'hi everyone' },
    { id: 'msg-004', content: 'i feel so sad today' },
    { id: 'msg-005', content: 'cool stuff' },
    { id: 'msg-006', content: 'great job!' },
    { id: 'msg-007', content: 'talking to you felt great i loved it' },
    { id: 'msg-008', content: 'hello there' },
    { id: 'msg-009', content: 'bad day :(' },
    { id: 'msg-010', content: 'just a regular message' }
  ];

  // Test messages with delays to simulate real chat flow
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    await simulateDelayedEmojiReaction(message.id, message.content);
    
    // Add delay between message simulations
    if (i < testMessages.length - 1) {
      console.log(`⏳ Waiting 3 seconds before next message...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n✅ Delayed emoji reaction tests initiated!');
  console.log('\n📝 Note: Reactions will appear 10 seconds after each message that Gemmie decides to react to.');
  console.log('   This simulates the natural timing you wanted - messages appear first, then reactions come later.');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDelayedEmojiReactions().catch(console.error);
}
