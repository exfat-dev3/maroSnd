const express = require('express');
const path = require('path');
const { put, list } = require('@vercel/blob');

// 👈 ここで明示的に CHAT_READ_WRITE_TOKEN を指定する
const blobToken = process.env.CHAT_READ_WRITE_TOKEN;

// Vercel Blobからメッセージを読み込む
async function loadMessages() {
  try {
    // tokenオプションを渡す
    const { blobs } = await list({ prefix: 'messages.json', token: blobToken });
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
    return { general: [] };
  }
}

// Vercel Blobにメッセージを上書き保存する
async function saveMessages(data) {
  try {
    // tokenオプションを渡す
    await put('messages.json', JSON.stringify(data, null, 2), {
      access: 'public',
      allowOverwrite: true,
      contentType: 'application/json',
      token: blobToken,
    });
  } catch (error) {
    console.error('Blob save error:', error);
  }
}