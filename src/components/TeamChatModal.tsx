/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, UserAccount } from '../engine/types.ts';
import { appDatabase } from '../engine/database.ts';
import {
  MessageSquare,
  Hash,
  Send,
  X,
  Shield,
  Headphones,
  UserCheck,
  Users,
} from 'lucide-react';

interface TeamChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
}

const CHANNELS = [
  { id: 'general', name: 'general', desc: 'Coordinación operativa y anuncios generales' },
  { id: 'incidentes', name: 'incidentes', desc: 'Canal de guardia para incidentes críticos P0/P1' },
  { id: 'infraestructura', name: 'infraestructura', desc: 'Despliegues, bases de datos y clusters' },
];

export const TeamChatModal: React.FC<TeamChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar mensajes del canal activo
  useEffect(() => {
    if (!isOpen) return;
    const msgs = appDatabase.getChatMessages(activeChannel);
    setMessages(msgs);
  }, [isOpen, activeChannel]);

  // Auto-scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      channelId: activeChannel,
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    appDatabase.saveChatMessage(newMsg);
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'system_admin':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
            <Shield className="w-2.5 h-2.5 text-rose-400" />
            Admin
          </span>
        );
      case 'ticket_admin':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
            <Headphones className="w-2.5 h-2.5 text-amber-400" />
            Soporte
          </span>
        );
      case 'requester':
      default:
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
            <UserCheck className="w-2.5 h-2.5 text-cyan-400" />
            Solicitante
          </span>
        );
    }
  };

  const currentChannelInfo = CHANNELS.find((c) => c.id === activeChannel) || CHANNELS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl h-[600px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera Superior */}
        <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700/60 text-zinc-200">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">
                  Chat de Equipo
                </h2>
                <span className="text-[10px] text-zinc-400 font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/50">
                  AegisFlow
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Canal: <span className="text-zinc-200 font-mono font-medium">#{currentChannelInfo.name}</span> &bull; {currentChannelInfo.desc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Principal: Sidebar de Canales + Conversación */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar de Canales */}
          <div className="w-48 sm:w-56 bg-zinc-950/60 border-r border-zinc-800/80 p-3 space-y-1 shrink-0">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 block">
              Canales
            </span>
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                  activeChannel === ch.id
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                <Hash className="w-3.5 h-3.5 text-zinc-400" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}

            <div className="pt-4 border-t border-zinc-800/60 mt-4">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 block">
                Miembros Activos
              </span>
              <div className="space-y-1.5 px-2 py-1 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-zinc-300">Julio (Admin)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-zinc-300">Domingo (Admin)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-zinc-300">Equipo Técnico</span>
                </div>
              </div>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-900/50">
            {/* Flujo de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                  <Hash className="w-8 h-8 text-zinc-400 mb-2" />
                  <p className="text-sm font-medium text-zinc-300">
                    Comienza la conversación en #{currentChannelInfo.name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                    {currentChannelInfo.desc}
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === currentUser.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-3 text-xs ${
                        isMe ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-200 font-semibold text-xs shrink-0">
                        {m.senderName.charAt(0).toUpperCase()}
                      </div>

                      {/* Contenido */}
                      <div className={`max-w-[75%] ${isMe ? 'text-right' : 'text-left'}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : ''}`}>
                          <span className="font-semibold text-zinc-200">
                            {m.senderName}
                          </span>
                          {getRoleTag(m.senderRole)}
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {formatTime(m.timestamp)}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-zinc-800/90 text-zinc-200 border border-zinc-700/60 rounded-tl-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input para Escribir Mensaje */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Mensaje a #${currentChannelInfo.name}...`}
                className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all cursor-pointer shadow-sm"
                title="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
