const mongoose = require('mongoose');
const connectDB = require('../lib/mongodb');
const Message = require('../models/Message');

// Test script to check typo functionality
async function testTypoFunctionality() {
  try {
    await connectDB();
    
    console.log('🔍 Testing typo functionality...');
    
    // Find recent Gemmie messages that haven't been edited
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentMessages = await Message.find({
      userName: 'gemmie',
      timestamp: { $gte: tenMinutesAgo },
      edited: false
    })
    .sort({ timestamp: -1 })
    .limit(3)
    .select('_id content timestamp')
    .lean();
    
    console.log(`📝 Found ${recentMessages.length} eligible messages for typo testing:`);
    recentMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ID: ${msg._id} Content: "${msg.content}"`);
    });
    
    if (recentMessages.length > 0) {
      // Test typo patterns
      const mistakes = [
        { pattern: /\b(think)\b/g, replacement: (match) => 'thikn' },
        { pattern: /\b(the)\b/g, replacement: (match) => 'teh' },
        { pattern: /\b(what)\b/g, replacement: (match) => 'waht' },
        { pattern: /\b(have)\b/g, replacement: (match) => 'haev' },
        { pattern: /\b(they)\b/g, replacement: (match) => 'thye' },
        { pattern: /\b(friend)\b/g, replacement: (match) => 'freind' },
        { pattern: /\b(really)\b/g, replacement: (match) => 'realy' },
        { pattern: /\b(because)\b/g, replacement: (match) => 'becuase' },
      ];
      
      console.log('\n🧪 Testing typo patterns:');
      recentMessages.forEach((msg, msgIndex) => {
        console.log(`\nMessage ${msgIndex + 1}: "${msg.content}"`);
        
        mistakes.forEach((mistake, mistakeIndex) => {
          const originalContent = msg.content;
          const mistakeContent = originalContent.replace(mistake.pattern, mistake.replacement);
          
          if (mistakeContent !== originalContent) {
            console.log(`  ${mistakeIndex + 1}. Applied "${mistake.pattern}": "${originalContent}" → "${mistakeContent}"`);
          } else {
            console.log(`  ${mistakeIndex + 1}. No match for "${mistake.pattern}"`);
          }
        });
      });
      
      // Test random chance
      console.log(`\n🎲 Random chance test (50% threshold):`);
      for (let i = 0; i < 10; i++) {
        const randomNum = Math.random();
        console.log(`  Test ${i + 1}: ${randomNum.toFixed(3)} ${randomNum < 0.5 ? '< 0.500' : '>= 0.500'} → ${randomNum < 0.5 ? 'Would apply typo' : 'Would not apply'}`);
      }
    } else {
      console.log('❌ No eligible messages found for typo testing');
    }
    
  } catch (error) {
    console.error('❌ Error testing typo functionality:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testTypoFunctionality();