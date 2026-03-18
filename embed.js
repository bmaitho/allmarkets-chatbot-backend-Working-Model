/**
 * Embedding Generator for AllMarkets Q&A Data
 * Run: node embed.js
 * 
 * Reads qa.json, generates embeddings for each Q&A pair,
 * and saves to qa_with_embeddings.json
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile, writeFile } from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 10; // Process in batches to avoid rate limits
const DELAY_MS = 500;  // Delay between batches

if (!API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY not found');
    process.exit(1);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateEmbeddings() {
    console.log('📂 Loading Q&A data...');
    
    const qaData = JSON.parse(await readFile('./qa.json', 'utf-8'));
    console.log(`   Found ${qaData.length} Q&A entries`);
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    const results = [];
    let processed = 0;
    let errors = 0;
    
    console.log('\n🔄 Generating embeddings...');
    
    for (let i = 0; i < qaData.length; i += BATCH_SIZE) {
        const batch = qaData.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
            batch.map(async (item) => {
                try {
                    // Combine question and answer for better semantic representation
                    const textToEmbed = `${item.question} ${item.answer}`;
                    const result = await embedModel.embedContent(textToEmbed);
                    
                    return {
                        ...item,
                        embedding: result.embedding.values
                    };
                } catch (error) {
                    console.error(`   ❌ Error embedding ${item.id}: ${error.message}`);
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
        process.stdout.write(`\r   Progress: ${processed}/${qaData.length} (${progress}%)`);
        
        // Rate limiting delay
        if (i + BATCH_SIZE < qaData.length) {
            await sleep(DELAY_MS);
        }
    }
    
    console.log('\n\n📝 Saving embeddings...');
    
    await writeFile(
        './qa_with_embeddings.json',
        JSON.stringify(results, null, 2),
        'utf-8'
    );
    
    const successCount = results.filter(r => r.embedding !== null).length;
    
    console.log(`\n✨ Complete!`);
    console.log(`   ✅ Successfully embedded: ${successCount}`);
    console.log(`   ❌ Failed: ${errors}`);
    console.log(`   📁 Saved to: qa_with_embeddings.json`);
}

generateEmbeddings().catch(console.error);
