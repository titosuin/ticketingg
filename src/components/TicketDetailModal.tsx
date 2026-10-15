/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { Ticket, TicketState, Severity, UserAccount, TicketComment } from '../engine/types.ts';
import { appDatabase } from '../engine/database.ts';
import {
  X,
  History,
  Tag,
  CheckCircle2,
  User,
  Clock,
  AlertCircle,
  Building2,
  MessageSquare,
  Send,
  Shield,
  Headphones,
  UserCheck,
} from 'lucide-react';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onRequeue?: (ticketId: string) => void;
  currentUser?: UserAccount | null;
  onTicketUpdated?: (updatedTicket: Ticket) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket: initialTicket,
  onClose,
  currentUser,
  onTicketUpdated,
}) => {
  const [ticket, setTicket] = useState<Ticket | null>(initialTicket);
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [newCommentText, setNewCommentText] = useState('');

  // Sincronizar si cambia el ticket seleccionado
  React.useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  if (!ticket) return null;

  const comments = ticket.comments || [];

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentUser) return;

    const comment: TicketComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      content: newCommentText.trim(),
      timestamp: Date.now(),
    };

    const updated = appDatabase.addTicketComment(ticket.id, comment);
    if (updated) {
      setTicket(updated);
      if (onTicketUpdated) onTicketUpdated(updated);
    }
    setNewCommentText('');
  };

  const getStatusLabel = (state: TicketState) => {
    switch (state) {
      case 'QUEUED':
      case 'REQUEUED':
        return { text: 'En Cola', bg: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
      case 'PROCESSING':
        return { text: 'En Atención', bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30' };
      case 'COMPLETED':
        return { text: 'Resuelto', bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
      case 'DEAD_LETTER':
        return { text: 'Con Error', bg: 'bg-rose-500/10 text-rose-300 border-rose-500/30' };
    }
  };

  const getPriorityLabel = (sev: Severity) => {
    switch (sev) {
      case 4:
        return { text: 'Urgente P0', color: 'text-rose-400' };
      case 3:
        return { text: 'Alta P1', color: 'text-amber-400' };
      case 2:
        return { text: 'Media P2', color: 'text-blue-400' };
      case 1:
      default:
        return { text: 'Baja P3', color: 'text-zinc-400' };
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const translateStateTransition = (state: TicketState | null) => {
    if (!state) return 'Creado';
    switch (state) {
      case 'QUEUED':
        return 'En Cola';
      case 'PROCESSING':
        return 'En Atención';
      case 'COMPLETED':
        return 'Resuelto';
      case 'REQUEUED':
        return 'Reencolado';
      case 'DEAD_LETTER':
        return 'Con Error';
    }
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

  const statusInfo = getStatusLabel(ticket.state);
  const priorityInfo = getPriorityLabel(ticket.severity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusInfo.bg}`}>
                  {statusInfo.text}
                </span>
                <span className={`text-xs font-semibold ${priorityInfo.color}`}>
                  {priorityInfo.text}
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  ID: {ticket.id.slice(0, 18)}...
                </span>
              </div>
              <h2 className="text-base font-bold text-zinc-100 tracking-tight leading-snug">
                {ticket.payload.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pestañas: Detalles & Historial / Conversación */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Detalles & Historial</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Conversación ({comments.length})</span>
            </button>
          </div>
        </div>

        {/* Contenido según Pestaña */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {activeTab === 'details' ? (
            <>
              {/* Tarjeta de Metadatos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
                <div>
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    Autor
                  </span>
                  <span className="text-zinc-200 font-medium">{ticket.author.name}</span>
                </div>

                <div>
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    Departamento
                  </span>
                  <span className="text-zinc-200 font-medium">{ticket.author.department}</span>
                </div>

                <div>
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    Fecha de Creación
                  </span>
                  <span className="text-zinc-200 font-medium text-xs">
                    {formatDate(ticket.timestamps.createdAt)}
                  </span>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 mb-2">
                  Descripción del Incidente
                </h3>
                <p className="text-zinc-200 text-sm bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 leading-relaxed whitespace-pre-wrap">
                  {ticket.payload.description}
                </p>

                {ticket.payload.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {ticket.payload.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800"
                      >
                        <Tag className="w-3 h-3 text-zinc-400" />
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas de Solución */}
              {ticket.resolutionNotes && (
                <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl space-y-1.5">
                  <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Resolución Aplicada
                  </h3>
                  <p className="text-emerald-200 text-xs leading-relaxed">
                    {ticket.resolutionNotes}
                  </p>
                </div>
              )}

              {/* Motivo de Error */}
              {ticket.failureReason && (
                <div className="bg-rose-950/20 border border-rose-800/40 p-4 rounded-xl space-y-1.5">
                  <h3 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Motivo del Error (DLQ)
                  </h3>
                  <p className="text-rose-200 text-xs leading-relaxed">
                    {ticket.failureReason}
                  </p>
                </div>
              )}

              {/* Registro de Auditoría */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 mb-2.5 flex items-center gap-2">
                  <History className="w-4 h-4 text-zinc-400" />
                  <span>Historial de Auditoría ({ticket.dispatchTelemetry.auditTrail.length} eventos)</span>
                </h3>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {ticket.dispatchTelemetry.auditTrail.map((entry, idx) => (
                    <div
                      key={entry.transitionId || idx}
                      className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 text-xs"
                    >
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="font-semibold text-zinc-200">
                          {translateStateTransition(entry.fromState)} &rarr; {translateStateTransition(entry.toState)}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {formatDate(entry.timestamp)}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs">
                        {entry.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Pestaña: Conversación & Chat del Ticket */
            <div className="space-y-4">
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400">
                    Aún no hay comentarios en este ticket. Deja el primer mensaje para coordinar la solución.
                  </div>
                ) : (
                  comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200 text-xs">
                            {cmt.authorName}
                          </span>
                          {getRoleTag(cmt.authorRole)}
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {formatDate(cmt.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {cmt.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Formulario para nuevo comentario */}
              {currentUser && (
                <form onSubmit={handleAddComment} className="pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Escribe una respuesta o nota técnica..."
                      className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Responder</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
