/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { Ticket, Severity, TicketState, UserAccount } from '../engine/types.ts';
import {
  Search,
  Filter,
  Clock,
  TrendingUp,
  Tag,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  Lock,
} from 'lucide-react';

interface QueueExplorerProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  selectedStateFilter: TicketState | null;
  onClearFilter: () => void;
  currentUser?: UserAccount;
  onSimulateIdor?: () => void;
  idorAlert?: { message: string; code: string; targetId: string } | null;
  onDismissIdorAlert?: () => void;
}

export const QueueExplorer: React.FC<QueueExplorerProps> = ({
  tickets,
  onSelectTicket,
  selectedStateFilter,
  onClearFilter,
  currentUser,
  onSimulateIdor,
  idorAlert,
  onDismissIdorAlert,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');

  const isRequester = currentUser?.role === 'requester';

  const filtered = tickets.filter((t) => {
    if (selectedStateFilter && t.state !== selectedStateFilter) return false;
    if (severityFilter !== 'ALL' && t.severity !== severityFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = t.payload.title.toLowerCase().includes(term);
      const matchDesc = t.payload.description.toLowerCase().includes(term);
      const matchId = t.id.toLowerCase().includes(term);
      const matchTag = t.payload.tags.some((tag) => tag.toLowerCase().includes(term));
      const matchAuthor = t.author.name.toLowerCase().includes(term) || t.author.department.toLowerCase().includes(term);
      return matchTitle || matchDesc || matchId || matchTag || matchAuthor;
    }
    return true;
  });

  const getSevBadge = (sev: Severity) => {
    switch (sev) {
      case 4:
        return <span className="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-bold">CRÍTICO 4</span>;
      case 3:
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-semibold">ALTO 3</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">MEDIO 2</span>;
      case 1:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-300 border border-slate-500/30 font-mono">BAJO 1</span>;
    }
  };

  const getStateBadge = (state: TicketState) => {
    switch (state) {
      case 'QUEUED':
        return <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">ENCOLADO</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono animate-pulse">EN PROCESO</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">RESUELTO</span>;
      case 'REQUEUED':
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">REENCOLADO</span>;
      case 'DEAD_LETTER':
        return <span className="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-bold animate-pulse">MENSAJE MUERTO</span>;
    }
  };

  const formatDwell = (createdAt: number) => {
    const ms = Math.max(0, Date.now() - createdAt);
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  };

  const formatSla = (deadlineMs: number) => {
    const diff = deadlineMs - Date.now();
    if (diff <= 0) return <span className="text-rose-400 font-bold font-mono">SLA INCUMPLIDO</span>;
    if (diff < 300_000) return <span className="text-amber-400 font-bold font-mono">&lt; 5m restantes</span>;
    return <span className="text-slate-400 font-mono">{Math.round(diff / 60_000)}m restantes</span>;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
      {/* Alerta de Ataque IDOR / BOLA Interceptado */}
      {idorAlert && (
        <div className="mb-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-start justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold font-mono text-rose-300 text-sm">
                  [403 BOLA_ACCESS_DENIED] ATAQUE IDOR INTERCEPTADO Y BLOQUEADO
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono border border-rose-500/30 font-bold">
                  OWASP API #1 PREVENTED
                </span>
              </div>
              <p className="mt-1 text-rose-200/90 font-mono text-[11px] leading-relaxed">
                {idorAlert.message}
              </p>
              <p className="mt-1 text-slate-400 text-[11px] font-sans">
                El motor aplicó <strong>Row-Level Security (RLS)</strong> estricta. El usuario <code>{currentUser?.username}</code> ({currentUser?.id}) no tiene permisos para inspeccionar el ticket de otro solicitante.
              </p>
            </div>
          </div>
          {onDismissIdorAlert && (
            <button
              onClick={onDismissIdorAlert}
              className="text-rose-400 hover:text-rose-200 font-mono text-xs px-2 py-1 rounded bg-rose-950/60 border border-rose-800/80"
            >
              Cerrar &times;
            </button>
          )}
        </div>
      )}

      {/* Barra de Título y Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
              <span>{isRequester ? 'MIS TICKETS EN COLA (ROW-LEVEL SECURITY)' : 'COLA DE PRIORIDAD Y REPOSITORIO DE CICLO DE VIDA'}</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({filtered.length} visibles de {tickets.length} totales)
              </span>
            </h2>

            {isRequester && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserCheck className="w-3 h-3" />
                RLS ACTIVA (@{currentUser?.username})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isRequester
              ? 'Mostrando exclusivamente los tickets creados por tu cuenta. El contexto interno de infraestructura está protegido.'
              : 'Ordenado dinámicamente por Puntaje de Heap (Base + Envejecimiento / Aging + Urgencia SLA)'}
          </p>
        </div>

        {/* Acciones y Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Simular Ataque IDOR (para Solicitante) */}
          {isRequester && onSimulateIdor && (
            <button
              onClick={onSimulateIdor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors shadow-sm font-mono"
              title="Intenta consultar un ticket perteneciente a otro usuario para comprobar la denegación 403 BOLA"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Simular Ataque IDOR</span>
            </button>
          )}

          {/* Campo de búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar UUID, etiqueta, título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
            />
          </div>

          {/* Selector de Severidad */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
            <Filter className="w-3 h-3 text-slate-500 ml-2 mr-1" />
            {(['ALL', 4, 3, 2, 1] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 rounded font-mono text-[11px] transition-colors ${
                  severityFilter === sev
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev === 'ALL' ? 'TODOS' : `S${sev}`}
              </button>
            ))}
          </div>

          {selectedStateFilter && (
            <button
              onClick={onClearFilter}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition-colors"
            >
              Limpiar Estado: {selectedStateFilter} &times;
            </button>
          )}
        </div>
      </div>

      {/* Lista de Tickets */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center bg-slate-950/40">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center mb-3">
            <Tag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 font-mono">
            {tickets.length === 0 ? 'COLA COMPLETAMENTE LIMPIA (0 TICKETS)' : 'NO HAY RESULTADOS CON LOS FILTROS ACTUALES'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {tickets.length === 0
              ? 'El motor está en espera. Usa el botón superior para crear y encolar tus propios tickets personalizados con la sesión activa.'
              : 'Prueba restableciendo los filtros de severidad o el término de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t, index) => {
            const dynamicScore = Math.round(t.lastDynamicScore ?? t.basePriorityScore);
            const isBackoff = t.timestamps.backoffUntil && t.timestamps.backoffUntil > Date.now();

            return (
              <div
                key={t.id}
                onClick={() => onSelectTicket(t)}
                className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 transition-all cursor-pointer hover:bg-slate-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3 group"
              >
                {/* Sección Izquierda: Posición, Etiquetas, Título */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-xs font-mono font-bold text-slate-600 group-hover:text-slate-400 pt-0.5 w-6 text-right">
                    #{index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {getStateBadge(t.state)}
                      {getSevBadge(t.severity)}
                      <span className="text-xs font-mono text-slate-400 hover:text-indigo-300 font-semibold truncate">
                        {t.id}
                      </span>
                      {t.dispatchTelemetry.retryCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-semibold">
                          Reintentos: {t.dispatchTelemetry.retryCount}/{t.dispatchTelemetry.maxRetries}
                        </span>
                      )}
                      {isBackoff && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono animate-pulse">
                          En Espera (Backoff)
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                      {t.payload.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                      {t.payload.description}
                    </p>

                    {/* Metadatos y Etiquetas */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        Autor: <strong className="text-slate-400 font-normal">{t.author.name}</strong> ({t.author.department})
                      </span>
                      <span className="flex items-center gap-1">
                        Canal: <strong className="text-slate-400 font-normal">{t.author.channel}</strong>
                      </span>
                      {t.payload.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="flex items-center gap-0.5 text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sección Derecha: Puntaje Dinámico, Tiempo Dwell, SLA */}
                <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 border-slate-800/80 pt-2 lg:pt-0 shrink-0">
                  {/* Puntaje Dinámico */}
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs font-mono text-indigo-400 font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{dynamicScore}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Base: {t.basePriorityScore} + Aging
                    </span>
                  </div>

                  {/* Tiempo de Espera (Dwell) */}
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center justify-end gap-1 text-xs font-mono text-slate-300">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatDwell(t.timestamps.createdAt)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Tiempo en Espera
                    </span>
                  </div>

                  {/* Cuenta regresiva de SLA */}
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-mono">
                      {formatSla(t.slaDeadlineMs)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Meta de SLA
                    </span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-slate-900 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-300 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
