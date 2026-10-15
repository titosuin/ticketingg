/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Ticket, TicketState, Severity } from '../engine/types.ts';
import { X, History, Tag, CheckCircle2, User, Clock, AlertCircle, Building2 } from 'lucide-react';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onRequeue?: (ticketId: string) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
}) => {
  if (!ticket) return null;

  const getStatusLabel = (state: TicketState) => {
    switch (state) {
      case 'QUEUED':
      case 'REQUEUED':
        return { text: 'En Cola', bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
      case 'PROCESSING':
        return { text: 'En Atención', bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
      case 'COMPLETED':
        return { text: 'Resuelto', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      case 'DEAD_LETTER':
        return { text: 'Con Error', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    }
  };

  const getPriorityLabel = (sev: Severity) => {
    switch (sev) {
      case 4:
        return { text: 'Urgente', color: 'text-rose-400' };
      case 3:
        return { text: 'Alta', color: 'text-amber-400' };
      case 2:
        return { text: 'Media', color: 'text-blue-400' };
      case 1:
      default:
        return { text: 'Baja', color: 'text-slate-400' };
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
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

  const statusInfo = getStatusLabel(ticket.state);
  const priorityInfo = getPriorityLabel(ticket.severity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg}`}>
                {statusInfo.text}
              </span>
              <span className={`text-xs font-semibold ${priorityInfo.color}`}>
                Prioridad {priorityInfo.text}
              </span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {ticket.payload.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Desplazable */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Tarjeta de Metadatos: Autor, Departamento, Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Autor
              </span>
              <span className="text-slate-200 font-medium">{ticket.author.name}</span>
            </div>

            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Departamento
              </span>
              <span className="text-slate-200 font-medium">{ticket.author.department}</span>
            </div>

            <div>
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Fecha de Creación
              </span>
              <span className="text-slate-200 font-medium text-xs">
                {formatDate(ticket.timestamps.createdAt)}
              </span>
            </div>
          </div>

          {/* Descripción del Problema */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 mb-2">
              Descripción del Problema
            </h3>
            <p className="text-slate-200 text-sm bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 leading-relaxed whitespace-pre-wrap">
              {ticket.payload.description}
            </p>

            {ticket.payload.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {ticket.payload.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800"
                  >
                    <Tag className="w-3 h-3" />
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notas de Solución si el ticket está resuelto */}
          {ticket.resolutionNotes && (
            <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl space-y-1.5">
              <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Notas de Solución
              </h3>
              <p className="text-emerald-200 text-xs leading-relaxed">
                {ticket.resolutionNotes}
              </p>
            </div>
          )}

          {/* Motivo de Falla si está en Error */}
          {ticket.failureReason && (
            <div className="bg-rose-950/20 border border-rose-800/40 p-4 rounded-xl space-y-1.5">
              <h3 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Motivo del Error
              </h3>
              <p className="text-rose-200 text-xs leading-relaxed">
                {ticket.failureReason}
              </p>
            </div>
          )}

          {/* Historial del Ticket en Español */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Historial del Ticket ({ticket.dispatchTelemetry.auditTrail.length} eventos)</span>
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {ticket.dispatchTelemetry.auditTrail.map((entry, idx) => (
                <div
                  key={entry.transitionId || idx}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-semibold text-slate-200">
                      {translateStateTransition(entry.fromState)} &rarr; {translateStateTransition(entry.toState)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    {entry.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
