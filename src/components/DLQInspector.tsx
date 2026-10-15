/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { Ticket } from '../engine/types.ts';
import { ShieldAlert, RotateCcw, CheckCircle2, History } from 'lucide-react';

interface DLQInspectorProps {
  dlqTickets: Ticket[];
  onReplayTicket: (ticketId: string, resetRetries: boolean) => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export const DLQInspector: React.FC<DLQInspectorProps> = ({
  dlqTickets,
  onReplayTicket,
}) => {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(
    dlqTickets.length > 0 ? dlqTickets[0] : null
  );

  return (
    <div className="space-y-6">
      {/* Banner Explicativo */}
      <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold font-mono text-rose-300">
              COLA DE MENSAJES MUERTOS (DLQ) &bull; CÁMARA DE AUDITORÍA FORENSE
            </h2>
            <p className="text-xs text-rose-200/70 mt-1 max-w-3xl">
              Los tickets son derivados aquí una vez que los reintentos alcanzan o superan el umbral límite (<code>max_retries</code>).
              Los incidentes quedan en aislamiento preventivo para proteger a los consumidores de fallos en cascada, preservando la traza cronológica completa e inmutable para análisis de causa raíz y reincorporación manual por operadores.
            </p>
          </div>
        </div>
      </div>

      {/* Cuadrícula Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Incidentes Aislados */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase">
              Incidentes en Cuarentena ({dlqTickets.length})
            </h3>
            <span className="text-[10px] font-mono text-slate-500">MÁX. REINTENTOS: 3</span>
          </div>

          {dlqTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/40 mb-2" />
              <span>La DLQ está vacía. Cero incidentes aislados.</span>
              <p className="text-[11px] text-slate-600 mt-1">
                Puedes simular fallas continuas o caídas de trabajadores para probar el enrutamiento a DLQ.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {dlqTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-700 ring-1 ring-rose-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-rose-400 font-bold">
                        {t.id.slice(0, 18)}...
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold">
                        {t.dispatchTelemetry.retryCount}/{t.dispatchTelemetry.maxRetries} Reintentos
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">
                      {t.payload.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-mono">
                      Motivo: {t.failureReason ?? 'Límite máximo de reintentos agotado'}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                      <span>Autor: {t.author.name}</span>
                      <span className="text-slate-400">{t.dispatchTelemetry.auditTrail.length} eventos de auditoría</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Detalle Forense y Registro Inmutable */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          {selectedTicket ? (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
                <div>
                  <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider block">
                    REGISTRO DE AUDITORÍA FORENSE
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    {selectedTicket.id}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReplayTicket(selectedTicket.id, true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reincorporar a la Cola Activa</span>
                  </button>
                </div>
              </div>

              {/* Descripción del Problema y Detalles de Origen */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">TÍTULO DEL INCIDENTE</span>
                  <span className="text-slate-200 font-semibold">{selectedTicket.payload.title}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">AUTOR DE ORIGEN</span>
                  <span className="text-slate-300">{selectedTicket.author.name} ({selectedTicket.author.department})</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px]">PAYLOAD DEL PROBLEMA</span>
                  <p className="text-slate-300 font-sans mt-0.5">{selectedTicket.payload.description}</p>
                </div>
              </div>

              {/* Historial de Auditoría Inmutable */}
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5 mb-3">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Traza Cronológica Inmutable ({selectedTicket.dispatchTelemetry.auditTrail.length} Transiciones)</span>
                </h4>

                <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {selectedTicket.dispatchTelemetry.auditTrail.map((entry, idx) => (
                    <div key={entry.transitionId || idx} className="relative pl-8 group">
                      <span className="absolute left-2.5 top-1.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-indigo-400 group-hover:scale-125 transition-transform" />

                      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
                              {entry.fromState ?? 'INICIO'} &rarr; {entry.toState}
                            </span>
                            <span className="text-slate-500 text-[10px]">&bull;</span>
                            <span className="text-indigo-300 text-[10px] font-semibold">Actor: {entry.actor}</span>
                          </div>
                          <span className="text-slate-500 text-[10px]">
                            {new Date(entry.timestamp).toISOString().slice(11, 23)}
                          </span>
                        </div>

                        <p className="text-slate-300 text-[11px] mt-1 font-sans">{entry.reason}</p>

                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <div className="mt-2 p-1.5 bg-slate-900 rounded font-mono text-[10px] text-slate-400 overflow-x-auto">
                            <code>{JSON.stringify(entry.metadata)}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500 font-mono text-xs">
              Selecciona un ticket de la columna izquierda para inspeccionar sus registros forenses.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
