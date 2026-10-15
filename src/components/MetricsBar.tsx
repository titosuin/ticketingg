/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { QueueMetrics, Severity } from '../engine/types.ts';
import { Clock, AlertTriangle, Layers, Cpu, CheckCircle2, RotateCw, ShieldX } from 'lucide-react';

interface MetricsBarProps {
  metrics: QueueMetrics;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  };

  const sevColors: Record<Severity, { bg: string; text: string; label: string }> = {
    4: { bg: 'bg-rose-500', text: 'text-rose-400', label: 'Crítico' },
    3: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Alto' },
    2: { bg: 'bg-blue-500', text: 'text-blue-400', label: 'Medio' },
    1: { bg: 'bg-slate-500', text: 'text-slate-400', label: 'Bajo' },
  };

  const totalQueued = metrics.totalQueued;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Profundidad de Cola (O(1)) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-mono font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            PROFUNDIDAD
          </span>
          <span className="text-[10px] text-slate-500 font-mono">O(1)</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-100">{metrics.totalQueued}</span>
          <span className="text-xs text-slate-400">tickets</span>
        </div>
        {/* Barra de distribución por severidad */}
        <div className="mt-2">
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
            {([4, 3, 2, 1] as Severity[]).map((sev) => {
              const count = metrics.countBySeverity[sev] || 0;
              const pct = totalQueued > 0 ? (count / totalQueued) * 100 : 0;
              return (
                <div
                  key={sev}
                  style={{ width: `${pct}%` }}
                  className={`${sevColors[sev].bg} transition-all duration-300`}
                  title={`${sevColors[sev].label}: ${count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
            <span className="text-rose-400 font-semibold">C:{metrics.countBySeverity[4] || 0}</span>
            <span className="text-amber-400">A:{metrics.countBySeverity[3] || 0}</span>
            <span className="text-blue-400">M:{metrics.countBySeverity[2] || 0}</span>
            <span className="text-slate-400">B:{metrics.countBySeverity[1] || 0}</span>
          </div>
        </div>
      </div>

      {/* 2. En Proceso (Leases Activos) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-mono font-medium flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            EN PROCESO
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Lease TTL</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-cyan-300">{metrics.processingCount}</span>
          <span className="text-xs text-slate-400">en vuelo</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          {metrics.activeLeases.length} bloqueos &bull; TTL: 5s
        </p>
      </div>

      {/* 3. Completados */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-mono font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            RESUELTOS
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Cierre</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-400">{metrics.completedCount}</span>
          <span className="text-xs text-slate-400">confirmados</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          Total creados: {metrics.totalCreated}
        </p>
      </div>

      {/* 4. Eventos Reencolados */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-mono font-medium flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            REENCOLADOS
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Reingresos</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-400">{metrics.requeuedCount}</span>
          <span className="text-xs text-slate-400">reintentos</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          HEAD &bull; TAIL &bull; BACKOFF
        </p>
      </div>

      {/* 5. Mensajes Muertos (DLQ) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-mono font-medium flex items-center gap-1.5">
            <ShieldX className="w-3.5 h-3.5 text-rose-400" />
            MENSAJES MUERTOS
          </span>
          <span className="text-[10px] text-slate-500 font-mono">DLQ</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold font-mono ${metrics.deadLetterCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
            {metrics.deadLetterCount}
          </span>
          <span className="text-xs text-slate-400">aislados</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          Límite superado (máx. 3)
        </p>
      </div>

      {/* 6. Tiempo de Espera (Dwell Time) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-mono font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            RETENCIÓN MEDIO
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Dwell</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold font-mono text-purple-300">{formatMs(metrics.avgDwellTimeMs)}</span>
          <span className="text-[10px] text-slate-400">espera prom.</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2">
          <span>Más antiguo: {formatMs(metrics.oldestQueuedDwellMs)}</span>
          {metrics.slaBreachRiskCount > 0 && (
            <span className="text-amber-400 flex items-center gap-0.5 font-bold">
              <AlertTriangle className="w-3 h-3" /> {metrics.slaBreachRiskCount} en riesgo
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
