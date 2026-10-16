import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Headphones, Clock, Image, Loader2, ShieldCheck, CheckCheck } from 'lucide-react';
import {
  ref as dbRef,
  push as rtdbPush,
  set as rtdbSet,
  update as rtdbUpdate,
  onValue as rtdbOnValue,
  query as rtdbQuery,
  limitToLast,
} from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { rtdb, storage } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AntiFloodTracker } from '../utils/antiFlood';

// Comprime imagens no cliente via Canvas antes do upload (reduz 3-5MB para ~40-90KB)
async function compressImageFile(file, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, dataUrl: null, ext: 'jpg', contentType: file.type || 'image/jpeg' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', quality);
        let ext = 'webp';
        let contentType = 'image/webp';
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          ext = 'jpg';
          contentType = 'image/jpeg';
        }
        canvas.toBlob(
          (blob) => {
            resolve({
              blob: blob || file,
              dataUrl,
              ext,
              contentType,
            });
          },
          contentType,
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, dataUrl: null, ext: 'jpg', contentType: file.type || 'image/jpeg' });
      };
      img.src = objectUrl;
    } catch {
      resolve({ blob: file, dataUrl: null, ext: 'jpg', contentType: file.type || 'image/jpeg' });
    }
  });
}

export default function SupportChatModal({ isOpen, onClose }) {
  const { currentUser, userProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [floodWarning, setFloodWarning] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const antiFloodRef = useRef(new AntiFloodTracker());

  const triggerFloodWarning = (msg) => {
    setFloodWarning(msg);
    setTimeout(() => {
      setFloodWarning((prev) => (prev === msg ? '' : prev));
    }, 4000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen || !currentUser?.uid) return;

    let active = true;
    let unsubChat = null;

    // Marca como lido pelo cliente ao abrir
    try {
      const threadRef = dbRef(rtdb, `support_threads/${currentUser.uid}`);
      rtdbUpdate(threadRef, { unreadByCustomer: false }).catch(() => {});
    } catch {}

    const disconnect = () => {
      if (unsubChat) {
        try {
          unsubChat();
        } catch {}
        unsubChat = null;
      }
    };

    const connect = () => {
      disconnect();
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      try {
        // Escuta em tempo real no RTDB (limitado às últimas 50 mensagens para Free Tier)
        const chatRef = dbRef(rtdb, `support_chats/${currentUser.uid}`);
        const chatQuery = rtdbQuery(chatRef, limitToLast(50));
        unsubChat = rtdbOnValue(
          chatQuery,
          (snap) => {
            if (!active) return;
            if (snap.exists()) {
              const val = snap.val();
              const arr = Object.keys(val).map((k) => ({
                id: k,
                ...val[k],
                createdAtMillis:
                  typeof val[k].createdAt === 'number'
                    ? val[k].createdAt
                    : Date.now(),
              }));
              arr.sort((a, b) => (a.createdAtMillis || 0) - (b.createdAtMillis || 0));
              setMessages(arr);
            } else {
              setMessages([
                {
                  id: 'welcome-1',
                  senderRole: 'owner',
                  senderName: 'Administração Vendário',
                  text: 'Olá! Como podemos te ajudar hoje? Envie sua dúvida diretamente para nossa equipe de administração.',
                  createdAtMillis: Date.now(),
                },
              ]);
            }
            setTimeout(scrollToBottom, 100);
          },
          (error) => {
            console.warn('Aviso no listener do chat de suporte:', error);
          }
        );
      } catch (err) {
        console.warn('Erro ao conectar suporte RTDB:', err);
      }
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
      } else if (document.visibilityState === 'visible') {
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  }, [isOpen, currentUser?.uid]);

  const handleSendMessage = async (e, imageUrl = null) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !imageUrl) return;
    if (sending || !currentUser?.uid) return;

    // 🛡️ Validação Anti-Flood para mensagens de texto no suporte
    if (!imageUrl) {
      const floodCheck = antiFloodRef.current.canSendMessage(inputMessage);
      if (!floodCheck.allowed) {
        triggerFloodWarning(floodCheck.reason);
        return;
      }
    }

    const textToSend = inputMessage.trim().slice(0, 200);
    setInputMessage('');
    setSending(true);

    const nowMs = Date.now();
    const isOwner = userProfile?.role === 'owner';
    const customerDisplayName = isOwner ? 'Administrador' : (userProfile?.displayName || currentUser?.displayName || 'Cliente');
    const customerEmail = userProfile?.email || currentUser?.email || '';
    const customerPhoto = userProfile?.photoURL || currentUser?.photoURL || null;
    const senderRole = isOwner ? 'owner' : 'customer';

    const messagePayload = {
      senderId: currentUser.uid,
      senderName: customerDisplayName,
      senderRole,
      text: textToSend || (imageUrl ? 'Enviou uma imagem' : ''),
      imageUrl: imageUrl || null,
      createdAt: nowMs,
      createdAtIso: new Date(nowMs).toISOString(),
    };

    const threadPayload = {
      customerId: currentUser.uid,
      customerName: customerDisplayName,
      customerEmail: customerEmail,
      customerAvatar: customerPhoto,
      lastMessageText: textToSend || 'Enviou uma imagem',
      lastMessageAt: nowMs,
      lastSenderId: currentUser.uid,
      lastSenderRole: senderRole,
      lastSenderName: customerDisplayName,
      unreadByAdmin: !isOwner,
      unreadByCustomer: isOwner,
    };

    try {
      // 1. Grava a mensagem no nó do cliente
      const chatRef = dbRef(rtdb, `support_chats/${currentUser.uid}`);
      await rtdbPush(chatRef, messagePayload);

      // 2. Atualiza a thread no índice ordenado de conversas
      const threadRef = dbRef(rtdb, `support_threads/${currentUser.uid}`);
      await rtdbSet(threadRef, threadPayload);

      if (!imageUrl) {
        antiFloodRef.current.recordMessageSent(textToSend);
      }
    } catch (err) {
      console.warn('Erro ao enviar mensagem para suporte:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderId: currentUser.uid,
          senderName: customerDisplayName,
          senderRole,
          text: textToSend,
          imageUrl: imageUrl,
          createdAtMillis: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    // 🛡️ Validação de Segurança e Anti-Flood no upload de imagens
    const fileCheck = antiFloodRef.current.validateImageFile(file);
    if (!fileCheck.valid) {
      triggerFloodWarning(fileCheck.reason);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const compressed = await compressImageFile(file, 1024, 0.75);
      const storagePath = `support_chats/${currentUser.uid}/${Date.now()}.${compressed.ext}`;
      const fileRef = storageRef(storage, storagePath);

      await uploadBytes(fileRef, compressed.blob, {
        contentType: compressed.contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      });
      const downloadUrl = await getDownloadURL(fileRef);

      antiFloodRef.current.recordImageSent();
      await handleSendMessage(null, downloadUrl);
    } catch (err) {
      console.warn('Erro ao fazer upload no Firebase Storage do suporte:', err);
      // Fallback seguro em dataUrl comprimida (máx ~80KB)
      const fallbackCompressed = await compressImageFile(file, 640, 0.55);
      if (fallbackCompressed.dataUrl && fallbackCompressed.dataUrl.length <= 140_000) {
        antiFloodRef.current.recordImageSent();
        await handleSendMessage(null, fallbackCompressed.dataUrl);
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chat com Administradores"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#15112b] rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-2xl overflow-hidden flex flex-col h-[580px] max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 px-4 py-3.5 text-white flex items-center justify-between shadow-sm relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm tracking-tight">Atendimento & Suporte</h3>
                <span className="flex items-center gap-0.5 text-[9px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 rounded font-semibold">
                  <ShieldCheck className="w-2.5 h-2.5" /> Oficial
                </span>
              </div>
              <p className="text-[11px] text-purple-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Fale diretamente com os Administradores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar chat de suporte"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-1.5 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/40 text-[11px] text-purple-700 dark:text-purple-300 flex items-center justify-between">
          <span>Mensagens privadas com a equipe administrativa.</span>
          <span className="font-semibold text-purple-500 dark:text-purple-400">Máx 200 carac.</span>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#faf9fe] dark:bg-[#0f0c23]">
          {messages.map((msg, index) => {
            const isMe = msg.senderRole === 'customer';
            const isOwner = msg.senderRole === 'owner';
            const timeStr = msg.createdAtMillis
              ? new Date(msg.createdAtMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${
                  isMe ? 'ml-auto' : 'mr-auto'
                }`}
              >
                {!isMe && (
                  <div className="flex items-center gap-1 mb-1 pl-1">
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      {isOwner ? 'Administrador Vendário' : msg.senderName || 'Suporte'}
                    </span>
                    <span className="text-[9px] bg-purple-600/15 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded font-extrabold uppercase">
                      Admin
                    </span>
                  </div>
                )}

                <div
                  className={`p-3 rounded-2xl shadow-sm relative group overflow-hidden break-words text-xs ${
                    isMe
                      ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-[#1a1535] text-slate-800 dark:text-slate-100 border border-purple-100 dark:border-purple-900/50 rounded-bl-none'
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden max-h-56 bg-black/10">
                      <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={msg.imageUrl}
                          alt="Anexo de suporte"
                          className="w-full h-auto object-cover rounded-xl hover:opacity-90 transition cursor-pointer"
                          loading="lazy"
                        />
                      </a>
                    </div>
                  )}

                  {msg.text && (
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                      isMe ? 'text-purple-200' : 'text-slate-400 dark:text-purple-400'
                    }`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>{timeStr}</span>
                    {isMe && <CheckCheck className="w-2.5 h-2.5 text-purple-200" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white dark:bg-[#15112b] border-t border-purple-100 dark:border-purple-900/50">
          {floodWarning && (
            <div className="mb-2 px-3.5 py-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{floodWarning}</span>
              </span>
              <button 
                type="button" 
                onClick={() => setFloodWarning('')}
                className="text-amber-700 dark:text-amber-300 hover:opacity-75 font-bold ml-2 px-1 text-sm leading-none"
              >
                ×
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || sending}
                aria-label="Anexar imagem"
                className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 transition active:scale-95 disabled:opacity-50"
              >
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <Image className="w-4 h-4" />
                )}
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  maxLength={200}
                  onChange={(e) => setInputMessage(e.target.value.slice(0, 200))}
                  placeholder="Escreva sua mensagem (máx 200 caracteres)..."
                  disabled={sending || uploadingImage}
                  className="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 dark:bg-[#1a1535] border border-purple-100 dark:border-purple-900/60 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
                />
                <span
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none ${
                    inputMessage.length >= 190
                      ? 'text-amber-500 font-bold'
                      : 'text-slate-400 dark:text-purple-400'
                  }`}
                >
                  {inputMessage.length}/200
                </span>
              </div>

              <button
                type="submit"
                disabled={(!inputMessage.trim() && !uploadingImage) || sending}
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-md shadow-purple-600/30 transition active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center justify-center"
                aria-label="Enviar mensagem"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
