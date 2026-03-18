# AllMarkets AI Chatbot

An AI-powered customer support chatbot for the AllMarkets platform, featuring intelligent Q&A retrieval, Google Gemini integration, and conversation logging.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.21-blue)
![Gemini](https://img.shields.io/badge/Google-Gemini%20AI-orange)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)

## ✨ Features

- **🤖 AI-Powered Responses** - Google Gemini 1.5 Flash for intelligent, contextual answers
- **🔍 Vector Search** - Semantic similarity matching against 600+ FAQ entries
- **💬 Modern Chat UI** - Clean, responsive interface with typing indicators
- **📊 Usage Tracking** - Per-user quotas and comprehensive logging
- **🔒 Session Management** - Conversation context maintained across messages
- **⚡ Fast Retrieval** - Pre-computed embeddings for instant semantic search

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+ (optional, runs in memory-only mode without)
- Google Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

```bash
# Clone or extract the project
cd allmarkets-chatbot-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API key
nano .env
```

### Environment Configuration

Edit `.env` with your values:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Server (optional)
PORT=3000

# MySQL Database (optional - runs without if not configured)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chatbot_db

# Quotas (optional)
GUEST_DAILY_LIMIT=10
REGISTERED_DAILY_LIMIT=100

# AI Configuration (optional)
MAX_OUTPUT_TOKENS=250
TOP_N_RESULTS=3
```

### Database Setup (Optional)

If using MySQL for persistent logging:

```bash
# Login to MySQL
mysql -u root -p

# Run the schema
source db/schema.sql
```

Or via phpMyAdmin:
1. Open phpMyAdmin
2. Create database `chatbot_db`
3. Import `db/schema.sql`

### Running the Server

```bash
# Test Gemini connection first
npm run test-gemini

# Start the server
npm start

# Or with auto-reload for development
npm run dev
```

Visit `http://localhost:3000` to use the chatbot!

## 📁 Project Structure

```
allmarkets-chatbot-backend/
├── server.js               # Express server & API endpoints
├── embed.js                # Embedding generation script
├── gemini_sanity_test.js   # API connection test
├── qa.json                 # Q&A source data (600 entries)
├── qa_with_embeddings.json # Q&A with pre-computed vectors
├── package.json
├── .env.example
├── public/
│   ├── index.html          # Chat UI
│   └── style.css           # Styles
├── db/
│   └── schema.sql          # MySQL schema
└── utils/
    └── vector.js           # Similarity functions
```

## 🔌 API Endpoints

### `POST /allmarkets-chat`

Main chat endpoint.

**Request:**
```json
{
  "message": "How do I subscribe to a service?",
  "session_id": "optional-session-id",
  "user_id": "optional-user-id",
  "quota_type": "guest"
}
```

**Response:**
```json
{
  "reply": "To subscribe to a service on AllMarkets...",
  "session_id": "sess_abc123",
  "messages_today": 3,
  "quota_remaining": 7,
  "debug": {
    "topScores": [0.92, 0.85, 0.78],
    "qaIds": ["faq-001", "faq-002", "faq-003"],
    "category": "Service Selection & Subscription",
    "responseTimeMs": 450
  }
}
```

### `GET /health`

Health check endpoint.

```json
{
  "server": "ok",
  "qaData": "loaded",
  "gemini": "connected",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### `GET /categories`

List all FAQ categories.

### `GET /search?q=query`

Direct semantic search (for debugging).

## 🎨 Frontend Features

- **Responsive Design** - Works on mobile and desktop
- **Dark Mode** - Automatic system preference detection
- **Typing Indicator** - Visual feedback while AI generates response
- **Quick Actions** - Pre-defined question buttons for common queries
- **Session Persistence** - Conversation context saved locally
- **Character Counter** - Input limit visualization

## 📊 Database Schema

### `chatbot_usage`
Tracks API usage per user:
- `user_id` - User identifier
- `tokens_used` - Tokens consumed
- `success` - Request status
- `quota_type` - guest/registered

### `chatbot_qa_log`
Logs all Q&A interactions:
- `question` - User's message
- `top_qa_ids` - Retrieved FAQ IDs (JSON)
- `answer` - AI response
- `category_matched` - Primary category
- `response_time_ms` - Processing time

### `chatbot_sessions`
Maintains conversation context:
- `session_id` - Session identifier
- `messages_today` - Daily message count
- `context` - Recent conversation (JSON)

## 🔧 Re-generating Embeddings

If you update `qa.json`, regenerate embeddings:

```bash
npm run embed
```

This creates/updates `qa_with_embeddings.json` with fresh vector embeddings.

## 🚢 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
NODE_ENV=production npm start
```

### With PM2
```bash
pm2 start server.js --name allmarkets-chat
```

### Docker (optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## ⚠️ Important Notes

1. **API Key Security** - Never commit `.env` to version control
2. **Rate Limits** - Gemini API has usage limits; monitor your quota
3. **Database Optional** - Server runs without MySQL (no persistent logging)
4. **Pre-computed Embeddings** - Using the included `qa_with_embeddings.json` saves API calls

## 📝 FAQ Categories Covered

- Service Selection & Subscription
- Payment & Billing
- Account Management
- Education Services
- Technical Support
- Immigration & Visa Services
- Matchmaking Services
- And more...

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use and modify for your needs.

---

**Need Help?** Contact AllMarkets support or open an issue on GitHub.
