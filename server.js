/**
 * AllMarkets AI Chatbot - Express Server
 * 
 * Full-stack customer support chatbot with:
 * - Gemini AI integration for responses
 * - Vector similarity search for Q&A retrieval
 * - MySQL logging and quota management
 * - Session-based context tracking
 * 
 * Updated March 2026 - Using current Gemini model names
 */

import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

import { 
    getTopN, 
    formatContextForPrompt, 
    getPrimaryCategory,
    isGreeting,
    estimateTokens 
} from './utils/vector.js';

// Load environment variables
dotenv.config();

// ============================================
// Configuration
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
    port: process.env.PORT || 3000,
    geminiApiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS) || 250,
    topNResults: parseInt(process.env.TOP_N_RESULTS) || 3,
    guestDailyLimit: parseInt(process.env.GUEST_DAILY_LIMIT) || 10,
    registeredDailyLimit: parseInt(process.env.REGISTERED_DAILY_LIMIT) || 100,
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'chatbot_db'
    }
};

// ============================================
// Initialize Express App
// ============================================
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ============================================
// Global State
// ============================================
let qaData = [];
let genAI = null;
let generativeModel = null;
let embedModel = null;
let dbPool = null;

// In-memory session store (fallback if DB unavailable)
const sessions = new Map();

// ============================================
// Database Connection
// ============================================
async function initDatabase() {
    try {
        dbPool = mysql.createPool({
            host: CONFIG.db.host,
            port: CONFIG.db.port,
            user: CONFIG.db.user,
            password: CONFIG.db.password,
            database: CONFIG.db.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        
        // Test connection
        const connection = await dbPool.getConnection();
        console.log('✅ MySQL database connected');
        connection.release();
        return true;
    } catch (error) {
        console.warn('⚠️  MySQL connection failed:', error.message);
        console.log('   Running in memory-only mode (no persistent logging)');
        dbPool = null;
        return false;
    }
}

// ============================================
// Load Q&A Data with Embeddings
// ============================================
async function loadQAData() {
    try {
        const dataPath = join(__dirname, 'qa_with_embeddings.json');
        const rawData = await readFile(dataPath, 'utf-8');
        qaData = JSON.parse(rawData);
        
        const withEmbeddings = qaData.filter(item => item.embedding).length;
        console.log(`✅ Loaded ${qaData.length} Q&A entries (${withEmbeddings} with embeddings)`);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to load Q&A data:', error.message);
        return false;
    }
}

// ============================================
// Initialize Gemini AI
// ============================================
function initGemini() {
    if (!CONFIG.geminiApiKey) {
        console.error('❌ GEMINI_API_KEY not configured');
        return false;
    }
    
    try {
        genAI = new GoogleGenerativeAI(CONFIG.geminiApiKey);
        
        // Current model names as of March 2026:
        // - gemini-2.5-flash (stable, recommended for most use cases)
        // - gemini-3-flash-preview (preview, more advanced)
        // - gemini-embedding-001 (for embeddings)
        generativeModel = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: CONFIG.maxOutputTokens,
                temperature: 0.7
            }
        });
        
        // Use the current embedding model (gemini-embedding-001)
        embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        
        console.log('✅ Gemini AI initialized');
        console.log('   📝 Generation model: gemini-2.5-flash');
        console.log('   🔢 Embedding model: gemini-embedding-001');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Gemini:', error.message);
        return false;
    }
}

// ============================================
// Session Management
// ============================================
function getOrCreateSession(sessionId, userId = null, quotaType = 'guest') {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            sessionId,
            userId,
            quotaType,
            messagesToday: 0,
            lastActivity: new Date(),
            context: []
        });
    }
    
    const session = sessions.get(sessionId);
    session.lastActivity = new Date();
    
    return session;
}

async function checkQuota(session) {
    const limit = session.quotaType === 'registered' 
        ? CONFIG.registeredDailyLimit 
        : CONFIG.guestDailyLimit;
    
    // Reset counter if new day
    const today = new Date().toDateString();
    const lastDay = session.lastActivity.toDateString();
    
    if (today !== lastDay) {
        session.messagesToday = 0;
    }
    
    return session.messagesToday < limit;
}

// ============================================
// Database Logging
// ============================================
async function logUsage(userId, tokensUsed, success, quotaType, errorMessage = null) {
    if (!dbPool) return;
    
    try {
        await dbPool.execute(
            `INSERT INTO chatbot_usage 
             (user_id, tokens_used, success, quota_type, error_message) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, tokensUsed, success, quotaType, errorMessage]
        );
    } catch (error) {
        console.error('DB logging error:', error.message);
    }
}

async function logQA(userId, sessionId, question, topQaIds, topScores, answer, category, responseTime) {
    if (!dbPool) return;
    
    try {
        await dbPool.execute(
            `INSERT INTO chatbot_qa_log 
             (user_id, session_id, question, top_qa_ids, top_scores, answer, category_matched, response_time_ms) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                sessionId,
                question,
                JSON.stringify(topQaIds),
                JSON.stringify(topScores),
                answer,
                category,
                responseTime
            ]
        );
    } catch (error) {
        console.error('DB QA logging error:', error.message);
    }
}

// ============================================
// AI Response Generation
// ============================================
async function generateResponse(userMessage, session) {
    const startTime = Date.now();
    
    try {
        // Handle greetings specially
        if (isGreeting(userMessage)) {
            return {
                reply: "Hello! 👋 Welcome to AllMarkets support. I'm here to help you with questions about our services, subscriptions, payments, and more. How can I assist you today?",
                debug: { type: 'greeting', topScores: [], qaIds: [] }
            };
        }
        
        // Generate embedding for user query
        const queryResult = await embedModel.embedContent(userMessage);
        const queryVector = queryResult.embedding.values;
        
        // Find top matching Q&A entries
        const topMatches = getTopN(queryVector, qaData, CONFIG.topNResults);
        const context = formatContextForPrompt(topMatches);
        const category = getPrimaryCategory(topMatches);
        
        // Build AI prompt
        const systemPrompt = `You are the official AllMarkets customer support assistant. Your role is to help users with questions about AllMarkets.org services, subscriptions, payments, education resources, and platform features.

GUIDELINES:
- Be friendly, professional, and concise
- Use the provided FAQ context to answer accurately
- If the context doesn't fully answer the question, provide helpful general guidance
- For complex issues, suggest contacting AllMarkets support directly
- Keep responses under 200 words
- Use bullet points for lists when helpful
- Never make up information not in the context

RELEVANT FAQ CONTEXT:
${context}

USER'S RECENT CONTEXT:
${session.context.slice(-3).map(c => `User: ${c.q}\nAssistant: ${c.a}`).join('\n\n') || 'This is the start of the conversation.'}`;

        const prompt = `${systemPrompt}

USER QUESTION: ${userMessage}

Please provide a helpful response based on the AllMarkets FAQ context above.`;

        // Generate AI response
        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;
        const reply = response.text();
        
        // Update session context
        session.context.push({ q: userMessage, a: reply });
        if (session.context.length > 5) {
            session.context.shift(); // Keep last 5 exchanges
        }
        session.messagesToday = (session.messagesToday || 0) + 1;
        
        // Calculate metrics
        const responseTime = Date.now() - startTime;
        const tokensUsed = estimateTokens(prompt) + estimateTokens(reply);
        
        // Log to database
        const topQaIds = topMatches.map(m => m.item.id);
        const topScores = topMatches.map(m => parseFloat(m.score.toFixed(4)));
        
        await logUsage(session.userId, tokensUsed, true, session.quotaType);
        await logQA(
            session.userId, 
            session.sessionId, 
            userMessage, 
            topQaIds, 
            topScores, 
            reply, 
            category, 
            responseTime
        );
        
        return {
            reply,
            debug: {
                topScores,
                qaIds: topQaIds,
                category,
                responseTimeMs: responseTime
            }
        };
        
    } catch (error) {
        console.error('AI generation error:', error);
        
        // Log failed attempt
        await logUsage(session.userId, 0, false, session.quotaType, error.message);
        
        // Check if quota exceeded
        if (error.message?.includes('quota') || error.message?.includes('429')) {
            return {
                reply: "I apologize, but our AI service is currently experiencing high demand. Please try again in a few minutes, or contact AllMarkets support directly at support@allmarkets.org for immediate assistance.",
                debug: { error: 'quota_exceeded' }
            };
        }
        
        return {
            reply: "I'm sorry, I encountered an issue processing your request. Please try rephrasing your question, or contact AllMarkets support for help.",
            debug: { error: error.message }
        };
    }
}

// ============================================
// API Routes
// ============================================

/**
 * Main chat endpoint
 * POST /allmarkets-chat
 */
app.post('/allmarkets-chat', async (req, res) => {
    try {
        const { message, user_id, session_id, quota_type } = req.body;
        
        // Validate input
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Message is required',
                reply: 'Please enter a message.'
            });
        }
        
        // Sanitize input
        const sanitizedMessage = message.trim().slice(0, 1000); // Max 1000 chars
        
        if (!sanitizedMessage) {
            return res.status(400).json({
                error: 'Message cannot be empty',
                reply: 'Please enter a valid message.'
            });
        }
        
        // Get or create session
        const sessionId = session_id || uuidv4();
        const userId = user_id || `guest-${sessionId.slice(0, 8)}`;
        const quotaType = quota_type === 'registered' ? 'registered' : 'guest';
        
        const session = getOrCreateSession(sessionId, userId, quotaType);
        
        // Check quota
        const withinQuota = await checkQuota(session);
        if (!withinQuota) {
            const limit = quotaType === 'registered' 
                ? CONFIG.registeredDailyLimit 
                : CONFIG.guestDailyLimit;
            
            return res.status(429).json({
                error: 'Daily limit exceeded',
                reply: `You've reached your daily limit of ${limit} messages. ${quotaType === 'guest' ? 'Sign up for a free account to get more!' : 'Please try again tomorrow.'}`,
                session_id: sessionId
            });
        }
        
        // Check if AI is available
        if (!generativeModel || !embedModel) {
            return res.status(503).json({
                error: 'AI service unavailable',
                reply: 'Our AI assistant is currently unavailable. Please contact AllMarkets support directly.',
                session_id: sessionId
            });
        }
        
        // Generate response
        const result = await generateResponse(sanitizedMessage, session);
        
        return res.json({
            ...result,
            session_id: sessionId,
            messages_today: session.messagesToday,
            quota_remaining: (quotaType === 'registered' 
                ? CONFIG.registeredDailyLimit 
                : CONFIG.guestDailyLimit) - session.messagesToday
        });
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            reply: 'Something went wrong. Please try again or contact AllMarkets support.'
        });
    }
});

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', async (req, res) => {
    const status = {
        server: 'ok',
        qaData: qaData.length > 0 ? 'loaded' : 'not loaded',
        gemini: generativeModel ? 'connected' : 'not connected',
        database: dbPool ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    };
    
    const isHealthy = status.qaData === 'loaded' && status.gemini === 'connected';
    
    res.status(isHealthy ? 200 : 503).json(status);
});

/**
 * Get Q&A categories
 * GET /categories
 */
app.get('/categories', (req, res) => {
    const categories = [...new Set(qaData.map(item => item.category))].filter(Boolean);
    res.json({ categories, count: categories.length });
});

/**
 * Search Q&A directly (for debugging)
 * GET /search?q=query
 */
app.get('/search', async (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }
    
    try {
        const queryResult = await embedModel.embedContent(query);
        const queryVector = queryResult.embedding.values;
        const topMatches = getTopN(queryVector, qaData, 5);
        
        res.json({
            query,
            results: topMatches.map(m => ({
                id: m.item.id,
                category: m.item.category,
                question: m.item.question,
                answer: m.item.answer,
                score: parseFloat(m.score.toFixed(4))
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Serve the chat UI
 * GET /
 */
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ============================================
// Server Initialization
// ============================================
async function startServer() {
    console.log('\n🚀 AllMarkets Chatbot Server Starting...\n');
    
    // Initialize components
    await initDatabase();
    const qaLoaded = await loadQAData();
    const geminiReady = initGemini();
    
    if (!qaLoaded) {
        console.error('❌ Cannot start without Q&A data');
        process.exit(1);
    }
    
    if (!geminiReady) {
        console.warn('⚠️  Server starting without AI capabilities');
    }
    
    // Start listening
    app.listen(CONFIG.port, () => {
        console.log(`\n${'═'.repeat(50)}`);
        console.log(`🌐 AllMarkets Chatbot Server`);
        console.log(`${'═'.repeat(50)}`);
        console.log(`📍 URL: http://localhost:${CONFIG.port}`);
        console.log(`📊 Q&A Entries: ${qaData.length}`);
        console.log(`🤖 AI Model: gemini-2.5-flash`);
        console.log(`🔢 Embed Model: gemini-embedding-001`);
        console.log(`📝 Max Tokens: ${CONFIG.maxOutputTokens}`);
        console.log(`👥 Guest Limit: ${CONFIG.guestDailyLimit}/day`);
        console.log(`${'═'.repeat(50)}\n`);
    });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down gracefully...');
    if (dbPool) {
        await dbPool.end();
    }
    process.exit(0);
});

// Start the server
startServer().catch(console.error);
