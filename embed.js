/**
 * Embedding Generator for AllMarkets Q&A Data
 * Run: node embed.js
 * 
 * IMPORTANT: Uses gemini-embedding-001 (March 2026)
 * This MUST match the model used in server.js for queries!
 * 
 * Reads qa.json, generates embeddings for each Q&A pair,
 * and saves to qa_with_embeddings.json
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile, writeFile } from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 5;   // Smaller batches for stability
const DELAY_MS = 1000;  // 1 second delay between batches

if (!API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY not found in .env file');
    console.error('   Make sure you have a .env file with GEMINI_API_KEY=your_key');
    process.exit(1);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateEmbeddings() {
    console.log('═══════════════════════════════════════════════');
    console.log('📂 AllMarkets Embedding Generator');
    console.log('═══════════════════════════════════════════════\n');
    
    // Load Q&A data
    let qaData;
    try {
        qaData = JSON.parse(await readFile('./qa.json', 'utf-8'));
        console.log(`✅ Loaded ${qaData.length} Q&A entries from qa.json`);
    } catch (error) {
        console.error('❌ Failed to load qa.json:', error.message);
        process.exit(1);
    }
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // ⚠️ CRITICAL: This model MUST match server.js
    const EMBEDDING_MODEL = 'gemini-embedding-001';
    const embedModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    
    console.log(`🔢 Using embedding model: ${EMBEDDING_MODEL}`);
    console.log(`📦 Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms\n`);
    
    const results = [];
    let processed = 0;
    let errors = 0;
    
    console.log('🔄 Generating embeddings...\n');
    
    const startTime = Date.now();
    
    for (let i = 0; i < qaData.length; i += BATCH_SIZE) {
        const batch = qaData.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
            batch.map(async (item) => {
                try {
                    // Combine question and answer for better semantic matching
                    const textToEmbed = `${item.question} ${item.answer}`;
                    const result = await embedModel.embedContent(textToEmbed);
                    
                    return {
                        ...item,
                        embedding: result.embedding.values
                    };
                } catch (error) {
                    console.error(`\n   ❌ Error embedding ${item.id}: ${error.message}`);
                    errors++;
                    return {
                        ...item,
                        embedding: null
                    };
                }
            })
        );
        
        results.push(...batchResults);
        processed += batch.length;
        
        // Progress indicator
        const progress = ((processed / qaData.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        process.stdout.write(`\r   Progress: ${processed}/${qaData.length} (${progress}%) - ${elapsed}s elapsed`);
        
        // Rate limiting delay between batches
        if (i + BATCH_SIZE < qaData.length) {
            await sleep(DELAY_MS);
        }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n\n📝 Saving embeddings to qa_with_embeddings.json...');
    
    await writeFile(
        './qa_with_embeddings.json',
        JSON.stringify(results, null, 2),
        'utf-8'
    );
    
    const successCount = results.filter(r => r.embedding !== null).length;
    const embeddingDim = results[0]?.embedding?.length || 0;
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('✨ COMPLETE!');
    console.log('═══════════════════════════════════════════════');
    console.log(`   ✅ Successfully embedded: ${successCount}/${qaData.length}`);
    console.log(`   ❌ Failed: ${errors}`);
    console.log(`   📐 Embedding dimensions: ${embeddingDim}`);
    console.log(`   ⏱️  Total time: ${totalTime}s`);
    console.log(`   📁 Saved to: qa_with_embeddings.json`);
    console.log('═══════════════════════════════════════════════\n');
    
    if (embeddingDim !== 3072) {
        console.warn('⚠️  WARNING: Expected 3072 dimensions for gemini-embedding-001');
        console.warn('   If dimensions are 768, you may be using the wrong model!');
    }
}

generateEmbeddings().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
});