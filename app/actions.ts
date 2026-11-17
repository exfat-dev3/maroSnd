'vending server' // または 'use server';
'use server';

import { put, list } from '@vercel/blob';

// 1. メッセージをBlobから取得する関数
export async function getMessages() {
  try {
    // 'messages.json' という名前のファイルを探す
    const { blobs } = await list({ prefix: 'messages.json' });
    
    if (blobs.length === 0) {
      // ファイルがまだなければ初期データを返す
      return {
        general: [{ id: 1, user: 'System', text: 'maroSnd へようこそ！', time: '20:00' }],
        dev: [{ id: 2, user: 'System', text: '開発チャンネルです', time: '20:00' }]
      };
    }

    // キャッシュを避けるために ?t=... をつけて最新を取得
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: 'no-store' });
    return await res.json();
  } catch (error) {
    console.error('読み込み失敗:', error);
    return {};
  }
}

// 2. メッセージを追加してVercel Blobに上書き保存する関数
export async function addMessage(channel: string, user: string, text: string) {
  if (!text.trim()) return;

  // 現在の全メッセージを取得
  const messages = await getMessages();
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

  // Vercel Blobに 'messages.json' として上書き保存 (allowOverwrite: true)
  await put('messages.json', JSON.stringify(messages, null, 2), {
    access: 'public',
    allowOverwrite: true, // 👈 これでファイルを更新できる！
    contentType: 'application/json',
  });

  return messages;
}