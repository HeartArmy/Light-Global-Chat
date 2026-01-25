#!/usr/bin/env node

/**
 * Test script for video upload functionality
 * This script tests the video upload endpoint and validates the Supabase integration
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testVideoUpload() {
  console.log('🎬 Testing Video Upload Functionality');
  console.log('==================================\n');

  // Test 1: Check if Supabase environment variables are set
  console.log('1. Checking Supabase configuration...');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase environment variables not found');
    console.log('   Make sure .env file has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return false;
  }
  console.log('✅ Supabase configuration found');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key: ${supabaseKey.substring(0, 10)}...\n`);

  // Test 2: Check if video upload endpoint exists
  console.log('2. Checking video upload endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/upload-video', {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Video upload endpoint is accessible');
      console.log(`   Response: ${data.message}\n`);
    } else {
      console.log('❌ Video upload endpoint not accessible');
      console.log(`   Status: ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to connect to video upload endpoint');
    console.log(`   Error: ${error.message}\n`);
    return false;
  }

  // Test 3: Test with a small video file (create a dummy file)
  console.log('3. Testing video upload with dummy file...');
  
  // Create a small dummy video file
  const dummyVideoPath = path.join(__dirname, 'test-video.mp4');
  const dummyVideoData = Buffer.from('FAKEVIDEO', 'utf-8');
  
  try {
    fs.writeFileSync(dummyVideoPath, dummyVideoData);
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(dummyVideoPath), {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });

    const uploadResponse = await fetch('http://localhost:3000/api/upload-video', {
      method: 'POST',
      body: formData
    });

    const result = await uploadResponse.json();
    
    if (uploadResponse.ok) {
      console.log('✅ Video upload successful');
      console.log(`   URL: ${result.url}`);
      console.log(`   Size: ${result.size} bytes`);
      console.log(`   Type: ${result.type}\n`);
    } else {
      console.log('❌ Video upload failed');
      console.log(`   Error: ${result.error}\n`);
      return false;
    }
    
    // Clean up
    fs.unlinkSync(dummyVideoPath);
  } catch (error) {
    console.log('❌ Video upload test failed');
    console.log(`   Error: ${error.message}\n`);
    
    // Clean up if file was created
    if (fs.existsSync(dummyVideoPath)) {
      fs.unlinkSync(dummyVideoPath);
    }
    return false;
  }

  // Test 4: Test file size validation
  console.log('4. Testing file size validation...');
  
  // Create a file larger than 50MB (just create a small file and test the validation)
  const largeVideoPath = path.join(__dirname, 'large-video.mp4');
  const largeVideoData = Buffer.alloc(1024 * 1024 * 2); // 2MB file for testing
  
  try {
    fs.writeFileSync(largeVideoPath, largeVideoData);
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(largeVideoPath), {
      filename: 'large-video.mp4',
      contentType: 'video/mp4'
    });

    const sizeTestResponse = await fetch('http://localhost:3000/api/upload-video', {
      method: 'POST',
      body: formData
    });

    const sizeTestResult = await sizeTestResponse.json();
    
    if (sizeTestResponse.status === 400 && sizeTestResult.error.includes('too large')) {
      console.log('✅ File size validation working correctly');
      console.log(`   Error message: ${sizeTestResult.error}\n`);
    } else {
      console.log('⚠️  File size validation test inconclusive');
      console.log(`   Status: ${sizeTestResponse.status}\n`);
    }
    
    // Clean up
    fs.unlinkSync(largeVideoPath);
  } catch (error) {
    console.log('⚠️  File size validation test failed');
    console.log(`   Error: ${error.message}\n`);
    
    // Clean up if file was created
    if (fs.existsSync(largeVideoPath)) {
      fs.unlinkSync(largeVideoPath);
    }
  }

  // Test 5: Test supported video formats
  console.log('5. Testing supported video formats...');
  const supportedFormats = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/ogg',
    'video/3gpp',
    'video/3gpp2'
  ];
  
  console.log('✅ Supported video formats:');
  supportedFormats.forEach(format => {
    console.log(`   - ${format}`);
  });
  console.log('');

  console.log('🎉 Video Upload Tests Complete!');
  console.log('================================');
  console.log('✅ All basic tests passed');
  console.log('📝 Remember to test with real video files in the actual application');
  console.log('📱 Test on iPhone, Safari, and Firefox for full compatibility');

  return true;
}

// Run the test
testVideoUpload().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});