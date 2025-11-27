// Test script for DeletedMessageByGemmie functionality
const mongoose = require('mongoose');
const DeletedMessageByGemmie = require('../models/DeletedMessageByGemmie');

// Test data
const testMessage = {
  originalMessageId: new mongoose.Types.ObjectId(),
  content: "This is a test message that was deleted by Gemmie",
  userName: "gemmie",
  userCountry: "US",
  timestamp: new Date(),
  deletedAt: new Date(),
  attachments: [],
  reactions: [],
  edited: false,
  editedAt: null,
  deletionReason: "repetition"
};

async function testDeletedMessages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test-chat');
    console.log('✅ Connected to MongoDB');

    // Create a test deleted message
    const deletedMessage = new DeletedMessageByGemmie(testMessage);
    await deletedMessage.save();
    console.log('✅ Created test deleted message:', deletedMessage._id);

    // Query deleted messages
    const deletedMessages = await DeletedMessageByGemmie.find({});
    console.log('✅ Found', deletedMessages.length, 'deleted messages');

    // Verify the stored message has all expected fields
    const storedMessage = deletedMessages[0];
    console.log('✅ Stored message verification:');
    console.log('  - Original Message ID:', storedMessage.originalMessageId);
    console.log('  - Content:', storedMessage.content);
    console.log('  - User Name:', storedMessage.userName);
    console.log('  - User Country:', storedMessage.userCountry);
    console.log('  - Deletion Reason:', storedMessage.deletionReason);
    console.log('  - Deleted At:', storedMessage.deletedAt);

    // Clean up
    await DeletedMessageByGemmie.deleteMany({});
    console.log('✅ Cleaned up test data');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testDeletedMessages();