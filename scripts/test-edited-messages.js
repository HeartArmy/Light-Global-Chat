const mongoose = require('mongoose');
const connectDB = require('../lib/mongodb');
const EditedMessageByGemmie = require('../models/EditedMessageByGemmie');

async function testEditedMessages() {
  try {
    await connectDB();
    console.log('🔗 Connected to MongoDB');

    // Test 1: Create a new edited message record
    console.log('\n📝 Test 1: Creating edited message record...');
    const editedMessage = new EditedMessageByGemmie({
      originalMessageId: new mongoose.Types.ObjectId(),
      originalContent: 'Hello, I am Gemmie!',
      newContent: 'Hey there! I\'m Gemmie - totally not a bot, promise! 😄',
      editReason: 'user-feedback',
      userName: 'gemmie',
      userCountry: 'US',
      timestamp: new Date(),
      editedAt: new Date(),
      triggerMessage: 'user: omg u type like a bot',
      aiPrompt: 'AI prompt for testing...'
    });

    await editedMessage.save();
    console.log('✅ Created edited message:', editedMessage._id);

    // Test 2: Find all edited messages
    console.log('\n🔍 Test 2: Finding all edited messages...');
    const allEditedMessages = await EditedMessageByGemmie.find().sort({ editedAt: -1 });
    console.log(`📊 Found ${allEditedMessages.length} edited messages`);
    allEditedMessages.forEach(msg => {
      console.log(`- ${msg._id}: "${msg.originalContent}" → "${msg.newContent}" (${msg.editReason})`);
    });

    // Test 3: Find edited messages by reason
    console.log('\n🔍 Test 3: Finding edited messages by reason...');
    const feedbackEdits = await EditedMessageByGemmie.find({ 
      editReason: 'user-feedback' 
    }).sort({ editedAt: -1 });
    console.log(`📊 Found ${feedbackEdits.length} user-feedback edits`);

    // Test 4: Update a message and check edit status
    console.log('\n🔄 Test 4: Testing edit status...');
    const testMessageId = editedMessage.originalMessageId;
    console.log('Original message ID:', testMessageId);
    
    // Clean up test data
    console.log('\n🧹 Test 5: Cleaning up test data...');
    await EditedMessageByGemmie.findByIdAndDelete(editedMessage._id);
    console.log('✅ Deleted test edited message');

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testEditedMessages();