const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { put, list } = require('@vercel/blob');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// 📁 Vercel Blobからメッセージを読み込む関数
async function loadMessages() {
  try {
    const { blobs } = await list({ prefix: 'messages.json' });
    if (blobs.length === 0) {
      // 初期データ
      return {
        general: [{ id: 1, user: 'System', text: 'maroSnd へようこそ！', time: '20:00' }],
        dev: [{ id: 2, user: 'System', text: '開発チャンネルです', time: '20:00' }]
      };
    }
    // BlobのURLから最新のJSONを取得（キャッシュ回避のクエリ付き）
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`);
    return await res.json();
  } catch (error) {
    console.error('Blob読み込みエラー:', error);
    return { general: [] };
  }
}

// 💾 Vercel Blobにメッセージを上書き保存する関数
async function saveMessages(data) {
  try {
    await put('messages.json', JSON.stringify(data, null, 2), {
      access: 'public',
      allowOverwrite: true, // 👈 これでファイルを更新！
      contentType: 'application/json',
    });
  } catch (error) {
    console.error('Blob保存エラー:', error);
  }
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Socket.IO リアルタイム通信
io.on('connection', async (socket) => {
  // 接続時に全履歴を送信
  const messages = await loadMessages();
  socket.emit('init', messages);

  // メッセージ受信時
  socket.on('send_message', async ({ channel, user, text }) => {
    if (!text.trim()) return;

    const currentMessages = await loadMessages();
    if (!currentMessages[channel]) currentMessages[channel] = [];

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMsg = {
      id: Date.now(),
      user: user || 'ゲスト',
      text: text.trim(),
      time
    };

    currentMessages[channel].push(newMsg);
    await saveMessages(currentMessages); // Vercel Blobに保存

    // 全員にリアルタイム配信
    io.emit('new_message', { channel, message: newMsg });
  });
});

server.listen(PORT, () => {
  console.log(`maroSnd running at http://localhost:${PORT}`);
});