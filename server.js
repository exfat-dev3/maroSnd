const express = require('express');
const path = require('path');
const { put, list } = require('@vercel/blob');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// トークンのフォールバック取得
const BLOB_TOKEN = process.env.CHAT_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

// Vercel Blobからメッセージを読み込む
async function loadMessages() {
  try {
    const { blobs } = await list({ prefix: 'messages.json', token: BLOB_TOKEN });
    if (blobs.length === 0) {
      return {
        general: [{ id: 1, user: 'System', text: 'maroSnd へようこそ！(#general)', time: '20:00' }],
        dev: [{ id: 2, user: 'System', text: '開発チャンネルです (#dev)', time: '20:00' }],
        random: [{ id: 3, user: 'System', text: '雑談チャンネル (#random)', time: '20:00' }]
      };
    }
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`);
    return await res.json();
  } catch (error) {
    console.error('Blob load error:', error);
    return { general: [], dev: [], random: [] };
  }
}

// Vercel Blobにメッセージを上書き保存する
async function saveMessages(data) {
  try {
    await put('messages.json', JSON.stringify(data, null, 2), {
      access: 'public',
      allowOverwrite: true,
      contentType: 'application/json',
      token: BLOB_TOKEN,
    });
  } catch (error) {
    console.error('Detailed Blob save error:', error);
    throw error;
  }
}

// メッセージ取得API
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await loadMessages();
    res.json(messages);
  } catch (err) {
    console.error('API GET ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// メッセージ送信API
app.post('/api/messages', async (req, res) => {
  try {
    const { channel, user, text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const messages = await loadMessages();
    if (!messages[channel]) messages[channel] = [];

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      id: Date.now(),
      user: user || 'ゲスト',
      text: text.trim(),
      time
    };

    messages[channel].push(newMsg);
    await saveMessages(messages);

    res.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('API POST ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ローカル起動用
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`maroSnd running at http://localhost:${PORT}`);
  });
}

module.exports = app;