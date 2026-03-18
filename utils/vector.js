/**
 * Vector Similarity Utilities for AllMarkets Chatbot
 * Handles embedding comparison and top-N retrieval
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First embedding vector
 * @param {number[]} vecB - Second embedding vector
 * @returns {number} Cosine similarity score (0-1)
 */
export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    
    if (denominator === 0) return 0;
    
    return dotProduct / denominator;
}

/**
 * Get top N most similar items from the Q&A dataset
 * @param {number[]} queryVector - Embedding of the user's query
 * @param {Array<{id: string, embedding: number[], ...}>} qaItems - Q&A items with embeddings
 * @param {number} n - Number of top results to return
 * @returns {Array<{item: object, score: number}>} Top N matches with scores
 */
export function getTopN(queryVector, qaItems, n = 3) {
    if (!queryVector || !qaItems || qaItems.length === 0) {
        return [];
    }
    
    // Calculate similarity for each Q&A item
    const scored = qaItems
        .filter(item => item.embedding && Array.isArray(item.embedding))
        .map(item => ({
            item: {
                id: item.id,
                category: item.category,
                question: item.question,
                answer: item.answer,
                module: item.module,
                section: item.section
            },
            score: cosineSimilarity(queryVector, item.embedding)
        }));
    
    // Sort by score descending and take top N
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, n);
}

/**
 * Extract unique categories from top matches
 * @param {Array<{item: {category: string}, score: number}>} topMatches 
 * @returns {string} Primary category (most frequent or highest scored)
 */
export function getPrimaryCategory(topMatches) {
    if (!topMatches || topMatches.length === 0) return null;
    
    // Return category of highest-scored match
    return topMatches[0].item.category || null;
}

/**
 * Format context from top matches for AI prompt
 * @param {Array<{item: object, score: number}>} topMatches 
 * @returns {string} Formatted context string
 */
export function formatContextForPrompt(topMatches) {
    if (!topMatches || topMatches.length === 0) {
        return "No relevant FAQ entries found.";
    }
    
    return topMatches
        .map((match, i) => {
            const { item, score } = match;
            return `[FAQ ${i + 1}] (Relevance: ${(score * 100).toFixed(1)}%)
Category: ${item.category}
Q: ${item.question}
A: ${item.answer}`;
        })
        .join('\n\n');
}

/**
 * Check if a query is likely a greeting or off-topic
 * @param {string} query - User's message
 * @returns {boolean} True if appears to be a greeting
 */
export function isGreeting(query) {
    const greetings = [
        'hi', 'hello', 'hey', 'greetings', 'good morning',
        'good afternoon', 'good evening', 'howdy', 'hola',
        "what's up", 'sup', 'yo'
    ];
    
    const normalized = query.toLowerCase().trim();
    return greetings.some(g => normalized === g || normalized.startsWith(g + ' '));
}

/**
 * Estimate token count (rough approximation)
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
}
