/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { QueueMetrics, TicketState } from '../engine/types.ts';
import { ArrowRight, Lock, CheckCircle2, RotateCw, Skull, Layers, Info } from 'lucide-react';

interface FSMVisualizerProps {
  metrics: QueueMetrics;
  onFilterState?: (state: TicketState | null) => void;
  selectedStateFilter?: TicketState | null;
}

export const FSMVisualizer: React.FC<FSMVisualizerProps> = ({
  metrics,
  onFilterState,
  selectedStateFilter,
}) => {
  const nodes = [
    {
      state: 'QUEUED' as TicketState,
      label: 'ENCOLADO (QUEUED)',
      count: metrics.totalQueued,
      color: 'border-indigo-500/50 bg-indigo-950/30 text-indigo-300',
      activeColor: 'ring-2 ring-indigo-400 bg-indigo-900/40',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      rule: 'Max-Heap de prioridad O(log N) con envejecimiento dinámico contra inanición y urgencia SLA',
    },
    {
      state: 'PROCESSING' as TicketState,
      label: 'EN PROCESO (PROCESSING)',
      count: metrics.processingCount,
      color: 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300',
      activeColor: 'ring-2 ring-cyan-400 bg-cyan-900/40',
      icon: <Lock className="w-4 h-4 text-cyan-400" />,
      rule: 'Bloqueo Lease con TTL (5s por defecto). Auto-expulsión si el trabajador se detiene',
    },
    {
      state: 'COMPLETED' as TicketState,
      label: 'RESUELTO (COMPLETED)',
      count: metrics.completedCount,
      color: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300',
      activeColor: 'ring-2 ring-emerald-400 bg-emerald-900/40',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      rule: 'Estado terminal inmutable. Requiere token de lease válido y notas de cierre',
    },
    {
      state: 'REQUEUED' as TicketState,
      label: 'REENCOLADO (REQUEUED)',
      count: metrics.requeuedCount,
      color: 'border-amber-500/50 bg-amber-950/30 text-amber-300',
      activeColor: 'ring-2 ring-amber-400 bg-amber-900/40',
      icon: <RotateCw className="w-4 h-4 text-amber-400" />,
      rule: 'Evaluación de reintentos: si superan el máximo pasa a DLQ; si no, reingresa (HEAD/TAIL/BACKOFF)',
    },
    {
      state: 'DEAD_LETTER' as TicketState,
      label: 'MENSAJES MUERTOS (DLQ)',
      count: metrics.deadLetterCount,
      color: 'border-rose-500/50 bg-rose-950/30 text-rose-300',
      activeColor: 'ring-2 ring-rose-400 bg-rose-900/40',
      icon: <Skull className="w-4 h-4 text-rose-400" />,
      rule: 'Aislamiento de contención para auditoría forense con su historial cronológico intacto',
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            MÁQUINA DE ESTADOS FINITOS (FSM) &bull; TOPOLOGÍA DE CICLO DE VIDA
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          Haz clic en cualquier estado para filtrar tickets &bull; 0 Condiciones de Carrera Garantizadas
        </div>
      </div>

      {/* Tubería de Nodos */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {nodes.map((node, index) => {
          const isSelected = selectedStateFilter === node.state;
          return (
            <div key={node.state} className="relative flex flex-col justify-between">
              <button
                onClick={() => onFilterState && onFilterState(isSelected ? null : node.state)}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${node.color} ${
                  isSelected ? node.activeColor : 'hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {node.icon}
                    <span className="font-mono font-bold text-xs">{node.label}</span>
                  </div>
                  <span className="text-sm font-mono font-bold px-2 py-0.5 rounded bg-slate-950/60">
                    {node.count}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{node.rule}</p>
              </button>

              {/* Flecha indicadora */}
              {index < 3 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600 pointer-events-none">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reglas e Invariantes */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-300 font-semibold">Invariantes Estrictos:</span>
          <span className="flex items-center gap-1 text-cyan-400">
            &bull; QUEUED &rarr; PROCESSING (Bloqueo Atómico Lease)
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            &bull; PROCESSING &rarr; COMPLETED (Resolución Definitiva)
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            &bull; PROCESSING &rarr; REQUEUED (Fallo / Expulsión)
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            &bull; REQUEUED &rarr; DEAD_LETTER (&ge;3 Reintentos)
          </span>
        </div>
        {selectedStateFilter && (
          <button
            onClick={() => onFilterState && onFilterState(null)}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline font-sans"
          >
            Quitar Filtro ({selectedStateFilter})
          </button>
        )}
      </div>
    </div>
  );
};
