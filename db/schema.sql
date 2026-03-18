-- AllMarkets Chatbot Database Schema
-- Run this script to set up the MySQL database

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS chatbot_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chatbot_db;

-- ============================================
-- Table: chatbot_usage
-- Tracks per-user request quotas and usage
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL COMMENT 'User identifier (email or session ID)',
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tokens_used INT NOT NULL DEFAULT 0 COMMENT 'Input + output tokens consumed',
    success BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether request returned valid AI response',
    quota_type ENUM('guest', 'registered') NOT NULL DEFAULT 'guest',
    error_message TEXT NULL COMMENT 'Error details if success = FALSE',
    
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_quota_type (quota_type),
    INDEX idx_user_date (user_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: chatbot_qa_log
-- Logs all Q&A interactions for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_qa_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NULL COMMENT 'User identifier if available',
    session_id VARCHAR(100) NOT NULL COMMENT 'Session tracking ID',
    question TEXT NOT NULL COMMENT 'User original message',
    top_qa_ids JSON NOT NULL COMMENT 'Array of top retrieved QA IDs',
    top_scores JSON NULL COMMENT 'Similarity scores for retrieved QAs',
    answer TEXT NOT NULL COMMENT 'AI-generated response',
    category_matched VARCHAR(100) NULL COMMENT 'Primary category of matched QAs',
    response_time_ms INT NULL COMMENT 'Response generation time in milliseconds',
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session (session_id),
    INDEX idx_user (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_category (category_matched)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: chatbot_sessions
-- Tracks conversation context per session
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(255) NULL,
    quota_type ENUM('guest', 'registered') NOT NULL DEFAULT 'guest',
    messages_today INT NOT NULL DEFAULT 0,
    last_activity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    context JSON NULL COMMENT 'Recent conversation context',
    
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- View: daily_usage_stats
-- Aggregated daily usage statistics
-- ============================================
CREATE OR REPLACE VIEW daily_usage_stats AS
SELECT 
    DATE(timestamp) as date,
    quota_type,
    COUNT(*) as total_requests,
    SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_requests,
    SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_requests,
    SUM(tokens_used) as total_tokens,
    COUNT(DISTINCT user_id) as unique_users
FROM chatbot_usage
GROUP BY DATE(timestamp), quota_type
ORDER BY date DESC;

-- ============================================
-- View: popular_categories
-- Most frequently accessed FAQ categories
-- ============================================
CREATE OR REPLACE VIEW popular_categories AS
SELECT 
    category_matched,
    COUNT(*) as query_count,
    DATE(timestamp) as date
FROM chatbot_qa_log
WHERE category_matched IS NOT NULL
GROUP BY category_matched, DATE(timestamp)
ORDER BY query_count DESC;
