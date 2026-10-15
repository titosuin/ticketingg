/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Ticket } from '../engine/types.ts';
import { X, History, Tag, CheckCircle2 } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-400">
                IDENTIFICADOR CANÓNICO UUIDv7:
              </span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {ticket.id}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-slate-100 mt-1">
              {ticket.payload.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs font-mono">
          {/* Cuadrícula de Metadatos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">ESTADO ACTUAL</span>
              <span className="text-slate-100 font-bold font-mono">{ticket.state}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">SEVERIDAD</span>
              <span className="text-rose-400 font-bold font-mono">Nivel {ticket.severity}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">REINTENTOS</span>
              <span className="text-amber-400 font-mono font-bold">
                {ticket.dispatchTelemetry.retryCount} / {ticket.dispatchTelemetry.maxRetries}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">PRIORIDAD BASE</span>
              <span className="text-indigo-400 font-bold font-mono">{ticket.basePriorityScore} pts</span>
            </div>
          </div>

          {/* Descripción y Payload */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-bold text-[11px] block">PAYLOAD DEL PROBLEMA</span>
            <p className="text-slate-300 font-sans text-xs bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
              {ticket.payload.description}
            </p>
            {ticket.payload.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ticket.payload.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notas de Resolución si está completado */}
          {ticket.resolutionNotes && (
            <div className="space-y-1.5 bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-lg">
              <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                NOTAS DE CONFIRMACIÓN Y RESOLUCIÓN
              </span>
              <p className="text-emerald-200 font-sans text-xs">{ticket.resolutionNotes}</p>
            </div>
          )}

          {/* Historial de Auditoría Inmutable */}
          <div className="space-y-2">
            <span className="text-slate-300 font-bold text-[11px] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              TRAZA CRONOLÓGICA INMUTABLE ({ticket.dispatchTelemetry.auditTrail.length} TRANSICIONES)
            </span>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {ticket.dispatchTelemetry.auditTrail.map((entry, idx) => (
                <div
                  key={entry.transitionId || idx}
                  className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-2.5 text-[11px]"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-bold text-slate-200">
                      {entry.fromState ?? 'INICIO'} &rarr; {entry.toState}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {new Date(entry.timestamp).toISOString()}
                    </span>
                  </div>
                  <div className="text-slate-300 font-sans">{entry.reason}</div>
                  <div className="text-[10px] text-indigo-400/80 mt-1 font-mono">
                    Actor: {entry.actor}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
