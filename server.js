const express = require('express');
const { put, list } = require('@vercel/blob');

const app = express();
app.use(express.json());

// トークンのフォールバック取得
const BLOB_TOKEN = process.env.CHAT_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

// Vercel Blobからメッセージを読み込む
async function loadMessages() {
  try {
    const { blobs } = await list({ prefix: 'messages.json', token: BLOB_TOKEN });
    if (blobs.length === 0) {
      return {
        general: [{ id: 1, user: 'System', text: 'maroSndへようこそ！(#general)', time: '20:00' }],
        dev: [{ id: 2, user: 'System', text: '開発チャンネルです (#dev)', time: '20:00' }],
        random: [{ id: 3, user: 'System', text: '雑談チャンネル (#random)', time: '20:00' }],
        bot: [{ id: 4, user: 'Bot', text: '便利なコマンドが使えるよ！ (/help)', time: '20:00' }]
      };
    }
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`);
    return await res.json();
  } catch (error) {
    console.error('Blob load error:', error);
    return { general: [], dev: [], random: [], bot: [] };
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

// API: メッセージ取得
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await loadMessages();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: メッセージ送信（機能てんこ盛り：Bot自動応答・コマンド対応）
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

    // おまけ機能：/help コマンドや Bot自動返信機能
    if (text.trim() === '/help') {
      messages[channel].push({
        id: Date.now() + 1,
        user: 'maroSnd Bot',
        text: '利用可能な機能: チャンネル切り替え, ユーザー名自動保存, 3秒ごとのリアルタイム同期, /clear (画面のメッセージリセットなど)',
        time
      });
    }

    await saveMessages(messages);
    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// メイン画面（HTMLをすべてサーバー側から直接返却するため、キャッシュの競合が起きません）
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>maroSnd - リアルタイムSNS</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #313338; color: #dbdee1; display: flex; height: 100vh; overflow: hidden; }
        
        /* サイドバー */
        .sidebar { width: 240px; background: #2b2d31; display: flex; flex-direction: column; border-right: 1px solid #1f2023; }
        .server-header { padding: 20px; font-weight: bold; font-size: 1.1rem; color: #fff; border-bottom: 1px solid #1f2023; display: flex; justify-content: space-between; align-items: center; }
        .channels-list { padding: 10px; flex: 1; overflow-y: auto; }
        .channel-item { padding: 10px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; color: #949ba4; transition: 0.2s; }
        .channel-item:hover { background: #35373c; color: #dbdee1; }
        .channel-item.active { background: #404249; color: #fff; font-weight: bold; }
        
        .user-panel { padding: 10px; background: #232428; display: flex; align-items: center; gap: 8px; }
        .user-panel input { background: #1e1f22; border: none; color: #fff; padding: 8px 10px; border-radius: 4px; width: 100%; font-size: 0.9rem; outline: none; }

        /* チャットメイン画面 */
        .chat-container { flex: 1; display: flex; flex-direction: column; background: #313338; }
        .chat-header { padding: 20px; font-weight: bold; font-size: 1.1rem; color: #fff; border-bottom: 1px solid #2b2d31; background: #313338; display: flex; justify-content: space-between; align-items: center; }
        .status-badge { font-size: 0.75rem; background: #23a55a; color: #fff; padding: 3px 8px; border-radius: 12px; }
        
        .messages-area { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        .message { display: flex; flex-direction: column; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        
        .message-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
        .message-username { font-weight: bold; color: #fff; }
        .message-time { font-size: 0.75rem; color: #949ba4; }
        .message-text { color: #dbdee1; font-size: 0.95rem; word-break: break-all; line-height: 1.4; }

        /* 入力エリア */
        .input-area { padding: 20px; background: #313338; }
        .input-wrapper { display: flex; background: #383a40; border-radius: 8px; padding: 10px; align-items: center; gap: 10px; }
        .input-wrapper textarea { flex: 1; background: transparent; border: none; color: #fff; resize: none; outline: none; font-size: 0.95rem; max-height: 100px; }
        .input-wrapper button { background: #5865f2; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .input-wrapper button:hover { background: #4752c4; }
    </style>
</head>
<body>

    <div class="sidebar">
        <div class="server-header">
            <span>🌌 maroSnd</span>
            <span style="font-size:0.7rem; color:#949ba4;">v2.0</span>
        </div>
        <div class="channels-list">
            <div style="font-size: 0.8rem; color: #949ba4; padding: 6px 10px; text-transform: uppercase; font-weight: bold;">テキストチャンネル</div>
            <div class="channel-item active" onclick="switchChannel('general')"># general</div>
            <div class="channel-item" onclick="switchChannel('dev')"># dev</div>
            <div class="channel-item" onclick="switchChannel('random')"># random</div>
            <div class="channel-item" onclick="switchChannel('bot')"># bot-commands</div>
        </div>
        <div class="user-panel">
            <input type="text" id="usernameInput" placeholder="ユーザー名" value="ゲスト">
        </div>
    </div>

    <div class="chat-container">
        <div class="chat-header">
            <span id="channelTitle"># general</span>
            <span class="status-badge">🟢 接続中 (リアルタイム)</span>
        </div>
        <div class="messages-area" id="messagesArea"></div>
        <div class="input-area">
            <div class="input-wrapper">
                <textarea id="messageInput" placeholder="# general へメッセージを送信 (/helpでヘルプ)" rows="1" onkeydown="handleKey(event)"></textarea>
                <button onclick="sendMessage()">送信</button>
            </div>
        </div>
    </div>

    <script>
        let currentChannel = 'general';
        let allMessages = { general: [], dev: [], random: [], bot: [] };

        const usernameInput = document.getElementById('usernameInput');
        const savedName = localStorage.getItem('marosnd_username');
        if (savedName) usernameInput.value = savedName;
        usernameInput.addEventListener('input', () => {
            localStorage.setItem('marosnd_username', usernameInput.value);
        });

        function switchChannel(channel) {
            currentChannel = channel;
            document.getElementById('channelTitle').textContent = \`# \${channel}\`;
            document.querySelectorAll('.channel-item').forEach(el => {
                el.classList.toggle('active', el.textContent.includes(channel));
            });
            document.getElementById('messageInput').placeholder = \`# \${channel} へメッセージを送信 (/helpでヘルプ)\`;
            renderMessages();
        }

        function renderMessages() {
            const area = document.getElementById('messagesArea');
            const msgs = allMessages[currentChannel] || [];
            area.innerHTML = '';
            msgs.forEach(m => {
                const div = document.createElement('div');
                div.className = 'message';
                div.innerHTML = \`
                    <div class="message-header">
                        <span class="message-username">\${escapeHtml(m.user)}</span>
                        <span class="message-time">\${m.time}</span>
                    </div>
                    <div class="message-text">\${escapeHtml(m.text)}</div>
                \`;
                area.appendChild(div);
            });
            area.scrollTop = area.scrollHeight;
        }

    function escapeHtml(str) {
            return String(str || '')
                .replace(/&/g, '&')
                .replace(/</g, '<')
                .replace(/>/g, '>')
                .replace(/"/g, '"')
                .replace(/'/g, ''');
        }

        async function fetchMessages() {
            try {
                const res = await fetch('/api/messages');
                if (res.ok) {
                    allMessages = await res.json();
                    renderMessages();
                }
            } catch (err) {
                console.error('Failed to fetch:', err);
            }
        }

        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const text = input.value.trim();
            const user = usernameInput.value.trim() || 'ゲスト';
            if (!text) return;

            try {
                const res = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel: currentChannel, user, text })
                });

                if (res.ok) {
                    input.value = '';
                    await fetchMessages();
                } else {
                    const errData = await res.json();
                    alert('送信エラー: ' + (errData.error || '不明なエラー'));
                }
            } catch (err) {
                alert('送信に失敗しました。');
            }
        }

        function handleKey(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        }

        fetchMessages();
        setInterval(fetchMessages, 3000);
    </script>
</body>
</html>`);
});

// ローカル起動用
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`maroSnd running at http://localhost:${PORT}`);
  });
}

module.exports = app;