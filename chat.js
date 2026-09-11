const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimit');
const { generateChatResponse } = require('../services/aiService');

// POST /api/chat
router.post('/', authenticateToken, chatLimiter, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    const userMessageContent = message.trim();
    let targetConversationId = conversationId;

    await client.query('BEGIN');

    // 1. Verify or create conversation
    if (targetConversationId) {
      const convCheck = await client.query(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [targetConversationId, req.user.userId]
      );

      if (convCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Conversation not found or unauthorized.' });
      }
    } else {
      // Auto-generate title from user message
      const autoTitle = userMessageContent.length > 40
        ? userMessageContent.slice(0, 38).trim() + '…'
        : userMessageContent;

      const newConv = await client.query(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
        [req.user.userId, autoTitle]
      );
      targetConversationId = newConv.rows[0].id;
    }

    // 2. Fetch past conversation context history
    const historyRes = await client.query(
      'SELECT sender, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [targetConversationId]
    );
    const history = historyRes.rows;

    // 3. Save incoming user message
    await client.query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
      [targetConversationId, 'user', userMessageContent]
    );

    // 4. Generate response via AI Service (Gemini API)
    let aiReplyText = '';
    try {
      aiReplyText = await generateChatResponse(history, userMessageContent);
    } catch (aiErr) {
      await client.query('ROLLBACK');
      return res.status(502).json({
        success: false,
        error: 'Failed to obtain AI response from backend service.'
      });
    }

    // 5. Save assistant message
    await client.query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
      [targetConversationId, 'assistant', aiReplyText]
    );

    // 6. Update conversation timestamp
    await client.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetConversationId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      reply: aiReplyText,
      conversationId: targetConversationId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
