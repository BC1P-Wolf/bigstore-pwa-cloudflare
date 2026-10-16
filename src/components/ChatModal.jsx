import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Headphones, Clock, Image, Loader2 } from 'lucide-react';
import { ref as dbRef, push as rtdbPush, onValue as rtdbOnValue, query as rtdbQuery, limitToLast } from 'firebase/database';
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

export default function ChatModal({ order, isOpen, onClose }) {
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
    if (!isOpen || !order?.id) return;

    let active = true;
    let unsubRtdb = null;

    const disconnect = () => {
      if (unsubRtdb) {
        try {
          unsubRtdb();
        } catch {}
        unsubRtdb = null;
      }
    };

    const connect = () => {
      disconnect();
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      try {
        // 1. Escuta em tempo real exclusivamente no Realtime Database via WebSocket (limitado às últimas 50 mensagens)
        const chatRtdbRef = dbRef(rtdb, `order_chats/${order.id}`);
        const chatQuery = rtdbQuery(chatRtdbRef, limitToLast(50));
        unsubRtdb = rtdbOnValue(
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
              // Ordena cronologicamente
              arr.sort((a, b) => (a.createdAtMillis || 0) - (b.createdAtMillis || 0));
              setMessages(arr);
            } else {
              setMessages([
                {
                  id: 'init-1',
                  senderRole: 'support',
                  senderName: 'Operador de Suporte',
                  text: `Olá! Seu pedido #${order.id.slice(-8)} está em progresso. Como posso ajudar você agora?`,
                  createdAtMillis: Date.now(),
                },
              ]);
            }
            setTimeout(scrollToBottom, 100);
          },
          (error) => {
            console.warn('Aviso no listener RTDB do chat:', error);
          }
        );
      } catch (err) {
        console.warn('Erro ao conectar ao RTDB para chat:', err);
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
  }, [isOpen, order?.id]);

  const handleSendMessage = async (e, imageUrl = null) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !imageUrl) return;
    if (sending) return;

    // 🛡️ Validação Anti-Flood para mensagens de texto
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
    const senderRole = userProfile?.role === 'owner' ? 'owner' : (userProfile?.role === 'operator' ? 'operator' : 'customer');
    const senderName = userProfile?.displayName || currentUser?.displayName || (senderRole === 'owner' ? 'Administrador' : 'Cliente');

    const messagePayload = {
      senderId: currentUser?.uid || 'guest',
      senderName,
      senderRole,
      text: textToSend || (imageUrl ? 'Enviou uma imagem' : ''),
      imageUrl: imageUrl || null,
      createdAt: nowMs,
      createdAtIso: new Date(nowMs).toISOString(),
    };

    try {
      // Envio em tempo real via Realtime Database (WebSocket com latência em milissegundos)
      const chatRtdbRef = dbRef(rtdb, `order_chats/${order.id}`);
      await rtdbPush(chatRtdbRef, messagePayload);
      if (!imageUrl) {
        antiFloodRef.current.recordMessageSent(textToSend);
      }
    } catch (err) {
      console.warn('Erro ao enviar mensagem no RTDB:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderId: currentUser?.uid || 'guest',
          senderName: userProfile?.displayName || 'Você',
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

  // Upload de anexos de imagem via Firebase Storage com compressão client-side e Cache-Control de 1 ano
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🛡️ Validação de Segurança e Anti-Flood no envio de anexos
    const fileCheck = antiFloodRef.current.validateImageFile(file);
    if (!fileCheck.valid) {
      triggerFloodWarning(fileCheck.reason);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const compressed = await compressImageFile(file, 1024, 0.75);
      const storagePath = `orders/${order.id}/attachments/${Date.now()}.${compressed.ext}`;
      const fileRef = storageRef(storage, storagePath);

      await uploadBytes(fileRef, compressed.blob, {
        contentType: compressed.contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      });
      const downloadUrl = await getDownloadURL(fileRef);

      antiFloodRef.current.recordImageSent();
      await handleSendMessage(null, downloadUrl);
    } catch (err) {
      console.warn('Erro ao fazer upload no Firebase Storage:', err);
      // Fallback seguro: comprime em alta taxa (máx ~80KB) para jamais estourar a banda do RTDB
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

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Chat de suporte do pedido">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#15112b] rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-2xl overflow-hidden flex flex-col h-[560px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chat Header */}
        <div className="p-4 bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-purple-200 border border-white/20">
              <Headphones className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Suporte do Pedido</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-[11px] text-purple-200 truncate max-w-[200px]">
                {order.productName} (#{order.id?.slice(-8)})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-purple-50 dark:bg-purple-950/40 px-4 py-2 border-b border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-[11px] text-purple-700 dark:text-purple-300">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5" />
            Atendimento em Tempo Real
          </span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            Status: Em Progresso
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#faf8ff] dark:bg-[#100d22]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-purple-400/60">
              <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">Nenhuma mensagem ainda.</p>
              <p className="text-[11px] mt-0.5">Envie uma mensagem abaixo para falar com o operador designado.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderRole === 'customer';
              const timeStr = msg.createdAtMillis
                ? new Date(msg.createdAtMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : typeof msg.createdAt === 'number'
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : msg.createdAt?.toMillis
                ? new Date(msg.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-baseline gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-purple-400">
                      {isMe ? 'Você' : (msg.senderName || 'Suporte')}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-purple-500">
                      {timeStr}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm space-y-1.5 ${
                      isMe
                        ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-[#20193d] border border-purple-100 dark:border-purple-800 text-slate-800 dark:text-purple-100 rounded-tl-none'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img 
                        src={msg.imageUrl} 
                        alt="Anexo" 
                        className="rounded-xl max-h-48 object-cover w-full border border-white/20"
                      />
                    )}
                    {msg.text && <div>{msg.text}</div>}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Alerta de Proteção Anti-Flood */}
        {floodWarning && (
          <div className="px-3.5 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-t border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center justify-between animate-in fade-in">
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

        {/* Input Bar com suporte a Upload no Firebase Storage */}
        <form 
          onSubmit={handleSendMessage}
          className="p-3 bg-white dark:bg-[#16122c] border-t border-purple-100 dark:border-purple-900/50 flex items-center gap-2"
        >
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
            disabled={uploadingImage}
            title="Enviar anexo ou print"
            className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center justify-center hover:bg-purple-100 transition active:scale-95"
          >
            {uploadingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            ) : (
              <Image className="w-4 h-4" />
            )}
          </button>

          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value.slice(0, 200))}
              maxLength={200}
              placeholder="Mensagem... (máx 200 caracteres)"
              aria-label="Mensagem para o suporte"
              className="w-full pl-3.5 pr-12 py-2.5 bg-purple-50/50 dark:bg-[#100c22] border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
            />
            <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none ${inputMessage.length >= 190 ? 'text-red-500' : 'text-slate-400 dark:text-purple-400'}`}>
              {inputMessage.length}/200
            </span>
          </div>

          <button
            type="submit"
            disabled={(!inputMessage.trim() && !uploadingImage) || sending}
            className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95 shadow-md shadow-purple-600/30"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
