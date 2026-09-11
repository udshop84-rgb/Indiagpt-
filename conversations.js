const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// All endpoints require user authentication
router.use(authenticateToken);

// GET /api/conversations - Get user's conversations
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.userId]
    );

    res.json({ success: true, conversations: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversations - Create conversation
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body;
    const conversationTitle = (title && typeof title === 'string' && title.trim()) ? title.trim().slice(0, 80) : 'New chat';

    const result = await db.query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at AS "createdAt", updated_at AS "updatedAt"',
      [req.user.userId, conversationTitle]
    );

    res.status(201).json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/conversations/:id - Get a single conversation details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM conversations WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found or access denied.' });
    }

    res.json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/conversations/:id - Rename conversation
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    const result = await db.query(
      'UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id, title, created_at AS "createdAt", updated_at AS "updatedAt"',
      [title.trim().slice(0, 80), id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found or access denied.' });
    }

    res.json({ success: true, conversation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found or access denied.' });
    }

    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/conversations/:id/messages - Get messages from a conversation
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const convCheck = await db.query('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Conversation not found or access denied.' });
    }

    const messages = await db.query(
      'SELECT id, conversation_id AS "conversationId", sender, content, created_at AS "createdAt" FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({ success: true, messages: messages.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
