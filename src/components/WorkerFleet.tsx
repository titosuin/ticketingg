/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Ticket, Severity, RequeueStrategy } from '../engine/types.ts';
import { Headphones, CheckCircle2, RotateCcw, Clock, UserCheck, AlertCircle } from 'lucide-react';

export interface WorkerStatus {
  id: string;
  name: string;
  assignedTicket: Ticket | null;
  state: 'IDLE' | 'PROCESSING' | 'RESOLVING' | 'CRASHED';
  resolvedCount: number;
  requeuedCount: number;
  evictedCount: number;
  leaseRemainingMs: number;
  leaseTotalMs: number;
}

interface WorkerFleetProps {
  workers: WorkerStatus[];
  onManualAcquire: (workerId: string) => void;
  onCommitResolution: (workerId: string, ticketId: string) => void;
  onRequeue: (workerId: string, ticketId: string, strategy: RequeueStrategy) => void;
  onCrashWorker?: (workerId: string) => void;
  onHeartbeat: (workerId: string, ticketId: string) => void;
  onSelectTicket: (ticket: Ticket) => void;
  currentUser?: { role: string };
}

export const WorkerFleet: React.FC<WorkerFleetProps> = ({
  workers,
  onManualAcquire,
  onCommitResolution,
  onRequeue,
  onHeartbeat,
  onSelectTicket,
  currentUser,
}) => {
  if (currentUser?.role === 'requester') {
    return null;
  }

  const getPriorityBadge = (sev: Severity) => {
    switch (sev) {
      case 4:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">Urgente</span>;
      case 3:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">Alta</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">Media</span>;
      case 1:
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-slate-500/20 text-slate-300 font-semibold border border-slate-500/30">Baja</span>;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Panel de Atención de Agentes
            </h2>
            <p className="text-xs text-slate-400">
              Toma manual de tickets en cola y confirmación de soluciones
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
        {workers.map((w, index) => {
          const isAttending = w.assignedTicket !== null && w.state !== 'CRASHED';
          const isPaused = w.state === 'CRASHED';
          const agentName = `Agente Soporte ${index + 1}`;

          return (
            <div
              key={w.id}
              className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                isAttending
                  ? 'bg-slate-950/80 border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                  : isPaused
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Información del Agente */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isAttending
                          ? 'bg-emerald-400 animate-pulse'
                          : isPaused
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      {agentName}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isAttending
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : isPaused
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isAttending ? 'En Atención' : isPaused ? 'En Pausa' : 'Disponible'}
                  </span>
                </div>

                {/* Ticket en Atención */}
                {w.assignedTicket ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      {getPriorityBadge(w.assignedTicket.severity)}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {(w.leaseRemainingMs / 1000).toFixed(0)}s
                      </span>
                    </div>

                    <h4
                      onClick={() => onSelectTicket(w.assignedTicket!)}
                      className="text-xs font-medium text-slate-200 line-clamp-2 hover:text-indigo-300 cursor-pointer transition-colors"
                      title={w.assignedTicket.payload.title}
                    >
                      {w.assignedTicket.payload.title}
                    </h4>

                    <div className="mt-2 text-[10px] text-slate-400">
                      De: <span className="text-slate-300">{w.assignedTicket.author.name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-800/80 rounded-xl p-4 text-center mb-3">
                    <span className="text-xs text-slate-500">Sin ticket asignado</span>
                  </div>
                )}
              </div>

              {/* Botones de Acción en Español */}
              <div className="space-y-2 pt-1">
                {isAttending && w.assignedTicket ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onCommitResolution(w.id, w.assignedTicket!.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolver Ticket</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onRequeue(w.id, w.assignedTicket!.id, 'HEAD')}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                        title="Devolver a la cola para otro agente"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Devolver</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onHeartbeat(w.id, w.assignedTicket!.id)}
                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                        title="Extender tiempo de atención"
                      >
                        <Clock className="w-3 h-3" />
                        <span>+ Tiempo</span>
                      </button>
                    </div>
                  </>
                ) : isPaused ? (
                  <button
                    type="button"
                    onClick={() => onManualAcquire(w.id)}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Reactivar Agente
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onManualAcquire(w.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/15 transition-all cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Tomar Siguiente Ticket</span>
                  </button>
                )}

                {/* Contador simple de resueltos */}
                <div className="text-center text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                  Resueltos: <span className="font-semibold text-emerald-400">{w.resolvedCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
