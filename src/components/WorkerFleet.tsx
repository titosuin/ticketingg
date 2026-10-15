/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Ticket, Severity, RequeueStrategy } from '../engine/types.ts';
import { Cpu, CheckCircle2, RotateCw, AlertOctagon, Heart, Zap, Clock } from 'lucide-react';

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
  onCrashWorker: (workerId: string) => void;
  onHeartbeat: (workerId: string, ticketId: string) => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export const WorkerFleet: React.FC<WorkerFleetProps> = ({
  workers,
  onManualAcquire,
  onCommitResolution,
  onRequeue,
  onCrashWorker,
  onHeartbeat,
  onSelectTicket,
}) => {
  const getSevBadge = (sev: Severity) => {
    switch (sev) {
      case 4:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold">CRÍTICO 4</span>;
      case 3:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-semibold">ALTO 3</span>;
      case 2:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-mono">MEDIO 2</span>;
      case 1:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-500/20 text-slate-300 font-mono">BAJO 1</span>;
    }
  };

  const getWorkerStateLabel = (state: WorkerStatus['state']) => {
    switch (state) {
      case 'IDLE':
        return 'INACTIVO';
      case 'PROCESSING':
        return 'PROCESANDO';
      case 'RESOLVING':
        return 'RESOLVIENDO';
      case 'CRASHED':
        return 'CAÍDO';
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            FLOTA DE TRABAJADORES DISTRIBUIDA (5 PROCESADORES CONCURRENTES)
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
            K=5 AGENTES
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-mono">
          Despacho Atómico &bull; Protocolo Seguro de Lease con TTL &bull; Auto-Expulsión
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {workers.map((w) => {
          const isProcessing = w.assignedTicket !== null && w.state !== 'CRASHED';
          const isCrashed = w.state === 'CRASHED';
          const leasePct = w.leaseTotalMs > 0 ? Math.max(0, Math.min(100, (w.leaseRemainingMs / w.leaseTotalMs) * 100)) : 0;

          return (
            <div
              key={w.id}
              className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
                isCrashed
                  ? 'bg-rose-950/20 border-rose-800/60 ring-1 ring-rose-500/40'
                  : isProcessing
                  ? 'bg-cyan-950/20 border-cyan-800/60'
                  : 'bg-slate-950/50 border-slate-800'
              }`}
            >
              {/* Encabezado del Trabajador */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCrashed
                          ? 'bg-rose-500 animate-ping'
                          : isProcessing
                          ? 'bg-cyan-400 animate-pulse'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-xs font-mono font-bold text-slate-200">{w.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      isCrashed
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : isProcessing
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {getWorkerStateLabel(w.state)}
                  </span>
                </div>

                {/* Ticket Asignado o Espacio Vacío */}
                {w.assignedTicket ? (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 mb-2.5">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      {getSevBadge(w.assignedTicket.severity)}
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">
                        {w.assignedTicket.id.slice(0, 13)}...
                      </span>
                    </div>

                    <h4
                      onClick={() => onSelectTicket(w.assignedTicket!)}
                      className="text-xs font-semibold text-slate-200 line-clamp-1 hover:text-indigo-300 cursor-pointer"
                      title={w.assignedTicket.payload.title}
                    >
                      {w.assignedTicket.payload.title}
                    </h4>

                    {/* Barra de Cuenta Regresiva de Lease */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          Lease TTL:
                        </span>
                        <span className={w.leaseRemainingMs < 1500 ? 'text-rose-400 font-bold' : 'text-cyan-300'}>
                          {(w.leaseRemainingMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${leasePct}%` }}
                          className={`h-full transition-all duration-200 ${
                            leasePct < 25 ? 'bg-rose-500' : leasePct < 50 ? 'bg-amber-500' : 'bg-cyan-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-800 rounded-lg p-3 text-center mb-2.5">
                    <span className="text-[11px] text-slate-500 font-mono">Sin lease activo</span>
                  </div>
                )}
              </div>

              {/* Botones de Acción del Trabajador */}
              <div className="space-y-1.5 pt-1">
                {isProcessing && w.assignedTicket ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Confirmar Resolución */}
                      <button
                        onClick={() => onCommitResolution(w.id, w.assignedTicket!.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition-colors"
                        title="Confirmar resolución y liberar lease"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Resolver</span>
                      </button>

                      {/* Extender Lease con Heartbeat */}
                      <button
                        onClick={() => onHeartbeat(w.id, w.assignedTicket!.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition-colors"
                        title="Emitir heartbeat para extender el lease 3 segundos"
                      >
                        <Heart className="w-3 h-3" />
                        <span>Extender</span>
                      </button>
                    </div>

                    {/* Estrategias de Retorno */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onRequeue(w.id, w.assignedTicket!.id, 'HEAD')}
                        className="flex items-center justify-center gap-1 px-1.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[10px] font-mono transition-colors"
                        title="Fallar y reencolar en HEAD (urgente LIFO)"
                      >
                        <RotateCw className="w-2.5 h-2.5" />
                        <span>Req: HEAD</span>
                      </button>

                      <button
                        onClick={() => onRequeue(w.id, w.assignedTicket!.id, 'EXPONENTIAL_BACKOFF')}
                        className="flex items-center justify-center gap-1 px-1.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[10px] font-mono transition-colors"
                        title="Fallar y reencolar con Backoff Exponencial"
                      >
                        <RotateCw className="w-2.5 h-2.5" />
                        <span>Req: Backoff</span>
                      </button>
                    </div>

                    {/* Simular Caída del Trabajador */}
                    <button
                      onClick={() => onCrashWorker(w.id)}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono transition-colors"
                      title="Simular caída súbita para comprobar la expulsión automática de lease"
                    >
                      <AlertOctagon className="w-3 h-3 text-rose-400" />
                      <span>Simular Caída (Probar Expulsión)</span>
                    </button>
                  </>
                ) : isCrashed ? (
                  <button
                    onClick={() => onManualAcquire(w.id)}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <span>Reiniciar Trabajador</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onManualAcquire(w.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                    title="Adquirir atómicamente el ticket de mayor prioridad disponible"
                  >
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span>Adquirir Siguiente Ticket</span>
                  </button>
                )}

                {/* Estadísticas del Trabajador */}
                <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1.5 border-t border-slate-800/80">
                  <span className="text-emerald-400 font-semibold" title="Tickets resueltos y confirmados">✓ {w.resolvedCount}</span>
                  <span className="text-amber-400" title="Tickets reencolados por fallas">↻ {w.requeuedCount}</span>
                  <span className="text-rose-400" title="Tickets expulsados por expiración de lease">✕ {w.evictedCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
