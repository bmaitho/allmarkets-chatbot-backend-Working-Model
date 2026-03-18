/**
 * Gemini API Sanity Test
 * Run: node gemini_sanity_test.js
 * 
 * Tests connection to Google Gemini API and validates embedding functionality
 * Updated March 2026 with current model names
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY not found in environment variables');
    console.log('📋 Please create a .env file with: GEMINI_API_KEY=your_api_key');
    process.exit(1);
}

async function testGeminiConnection() {
    console.log('🔗 Testing Gemini API Connection...\n');
    console.log('📅 Using March 2026 model names\n');
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Test 1: Generative Model (gemini-2.5-flash - current stable model)
    console.log('📝 Test 1: Generative Model (gemini-2.5-flash)');
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent('Say "AllMarkets API test successful!" in one sentence.');
        const response = await result.response;
        console.log('   ✅ Response:', response.text().trim());
    } catch (error) {
        console.log('   ❌ Error:', error.message);
        console.log('   💡 If this fails, try gemini-3-flash-preview instead');
    }
    
    // Test 2: Embedding Model (gemini-embedding-001 - current embedding model)
    console.log('\n🔢 Test 2: Embedding Model (gemini-embedding-001)');
    try {
        const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await embedModel.embedContent('What is AllMarkets?');
        const embedding = result.embedding.values;
        console.log(`   ✅ Embedding generated: ${embedding.length} dimensions`);
        console.log(`   📊 Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    
    // Test 3: Token counting
    console.log('\n📏 Test 3: Token Counting');
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const testText = 'How do I subscribe to a service on AllMarkets? I want to learn about education options.';
        const countResult = await model.countTokens(testText);
        console.log(`   ✅ Test text: "${testText}"`);
        console.log(`   📊 Token count: ${countResult.totalTokens}`);
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    
    console.log('\n' + '═'.repeat(50));
    console.log('✨ Sanity test complete!');
    console.log('═'.repeat(50));
    console.log('\n👉 If all tests passed, you can start the server with: npm start');
    console.log('\n📚 Current model names (March 2026):');
    console.log('   • Generation: gemini-2.5-flash (stable)');
    console.log('   • Generation: gemini-3-flash-preview (preview)');
    console.log('   • Embeddings: gemini-embedding-001');
}

testGeminiConnection().catch(console.error);