// Test script for asynchronous emoji reactions using QStash
console.log('⏰ Testing Asynchronous Emoji Reaction System...\n');

/**
 * Test function to simulate the new asynchronous emoji reaction flow
 */
async function testAsyncEmojiReactions() {
  console.log('🎯 Testing asynchronous emoji reactions:\n');
  
  const testMessages = [
    { id: 'msg-async-001', content: 'this is awesome!' },
    { id: 'msg-async-002', content: 'haha that is so funny 😂' },
    { id: 'msg-async-003', content: 'hi everyone' },
    { id: 'msg-async-004', content: 'i feel so sad today' },
    { id: 'msg-async-005', content: 'cool stuff' },
    { id: 'msg-async-006', content: 'great job!' },
    { id: 'msg-async-007', content: 'talking to you felt great i loved it' },
    { id: 'msg-async-008', content: 'hello there' },
    { id: 'msg-async-009', content: 'bad day :(' },
    { id: 'msg-async-010', content: 'just a regular message' }
  ];

  // Simulate message creation flow
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    
    console.log(`📨 New message created: "${message.content}"`);
    console.log(`🆔 Message ID: ${message.id}`);
    
    // Simulate shouldGemmieReact logic (15% chance)
    const shouldReact = Math.random() < 0.15;
    
    if (shouldReact) {
      console.log(`⏰ Gemmie will react to message ${message.id} in 30 seconds via QStash...`);
      console.log(`🚀 Scheduled QStash job for emoji reaction (30 second delay)`);
      
      // Simulate the delayed reaction happening 30 seconds later
      setTimeout(() => {
        console.log(`🎭 QStash triggered! Processing emoji reaction for message ${message.id}`);
        
        // Simulate emoji selection
        const lowerContent = message.content.toLowerCase().trim();
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
        
        console.log(`🎉 Asynchronous emoji reaction ${emoji} sent for message ${message.id}`);
        console.log(`💬 Message: "${message.content}" → ${emoji}`);
        
      }, 3000); // 3 second delay for testing (simulating 30 seconds)
      
    } else {
      console.log(`⏭️ Gemmie decided not to react to message ${message.id}`);
    }
    
    // Add delay between message simulations to show the async nature
    if (i < testMessages.length - 1) {
      console.log(`⏳ Waiting 1 second before next message...\n`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n✅ Asynchronous emoji reaction tests initiated!');
  console.log('\n📝 Key improvements:');
  console.log('   1. Messages appear immediately on frontend (no blocking)');
  console.log('   2. Emoji reactions are scheduled via QStash for 30 seconds later');
  console.log('   3. Multiple messages can be created without waiting for emoji processing');
  console.log('   4. QStash handles the delayed execution asynchronously');
  console.log('   5. Fallback to immediate reaction if QStash fails');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAsyncEmojiReactions().catch(console.error);
}
