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
  Tag,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Inbox,
  User,
  MessageSquare,
} from 'lucide-react';

export type StateCategoryFilter = 'ALL' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'DEAD_LETTER';

interface QueueExplorerProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  selectedStateFilter?: TicketState | null;
  onClearFilter?: () => void;
  currentUser?: UserAccount;
  onSimulateIdor?: () => void;
  idorAlert?: { message: string; code: string; targetId: string } | null;
  onDismissIdorAlert?: () => void;
}

export const QueueExplorer: React.FC<QueueExplorerProps> = ({
  tickets,
  onSelectTicket,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StateCategoryFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Severity | 'ALL'>('ALL');

  const isRequester = currentUser?.role === 'requester';

  const filtered = tickets.filter((t) => {
    // Filtro por Estado en Español
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'QUEUED' && t.state !== 'QUEUED' && t.state !== 'REQUEUED') return false;
      if (statusFilter === 'PROCESSING' && t.state !== 'PROCESSING') return false;
      if (statusFilter === 'COMPLETED' && t.state !== 'COMPLETED') return false;
      if (statusFilter === 'DEAD_LETTER' && t.state !== 'DEAD_LETTER') return false;
    }

    // Filtro por Prioridad
    if (priorityFilter !== 'ALL' && t.severity !== priorityFilter) return false;

    // Filtro por Búsqueda de texto
    if (searchTerm.trim()) {
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

  const getPriorityBadge = (sev: Severity) => {
    switch (sev) {
      case 4:
        return <span className="px-2 py-0.5 rounded text-xs bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">Urgente</span>;
      case 3:
        return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">Alta</span>;
      case 2:
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">Media</span>;
      case 1:
      default:
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-500/15 text-slate-300 border border-slate-500/30 font-medium">Baja</span>;
    }
  };

  const getStatusBadge = (state: TicketState) => {
    switch (state) {
      case 'QUEUED':
      case 'REQUEUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <Inbox className="w-3 h-3 text-indigo-400" />
            EN COLA
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse">
            <Clock className="w-3 h-3 text-cyan-400" />
            EN ATENCIÓN
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            RESUELTO
          </span>
        );
      case 'DEAD_LETTER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            CON ERROR
          </span>
        );
    }
  };

  const formatCreationDate = (createdAt: number) => {
    const d = new Date(createdAt);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Barra de Filtros en Español */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>{isRequester ? 'Mis Solicitudes de Soporte' : 'Lista General de Tickets'}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isRequester
              ? 'Consulta el estado en tiempo real de tus solicitudes reportadas'
              : 'Gestión y seguimiento de incidentes de todos los departamentos'}
          </p>
        </div>

        {/* Buscador y Filtros */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por asunto o etiqueta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52 sm:w-64"
            />
          </div>

          {/* Selector de Estado en Español */}
          <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs">
            {(
              [
                { key: 'ALL', label: 'TODOS' },
                { key: 'QUEUED', label: 'EN COLA' },
                { key: 'PROCESSING', label: 'EN ATENCIÓN' },
                { key: 'COMPLETED', label: 'RESUELTOS' },
                { key: 'DEAD_LETTER', label: 'CON ERROR' },
              ] as const
            ).map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filtro de Prioridad */}
          <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
            {(
              [
                { key: 'ALL', label: 'Todas' },
                { key: 4, label: 'Urgente' },
                { key: 3, label: 'Alta' },
                { key: 2, label: 'Media' },
                { key: 1, label: 'Baja' },
              ] as const
            ).map((p) => (
              <button
                key={String(p.key)}
                type="button"
                onClick={() => setPriorityFilter(p.key)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  priorityFilter === p.key
                    ? 'bg-slate-800 text-indigo-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Tickets */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-950/40">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center mb-3">
            <Tag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">
            {tickets.length === 0 ? 'No hay tickets registrados' : 'No se encontraron tickets con los filtros seleccionados'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {tickets.length === 0
              ? 'Crea un nuevo ticket utilizando el botón "+ Nuevo Ticket" de la barra superior.'
              : 'Prueba cambiando los filtros de estado, prioridad o término de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTicket(t)}
              className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition-all cursor-pointer hover:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              {/* Información Principal del Ticket */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {getStatusBadge(t.state)}
                  {getPriorityBadge(t.severity)}
                  <span className="text-xs text-slate-400">
                    {formatCreationDate(t.timestamps.createdAt)}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                  {t.payload.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                  {t.payload.description}
                </p>

                {/* Autor y Etiquetas */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.author.name}</span>
                    <span className="text-slate-400">({t.author.department})</span>
                  </span>

                  {t.payload.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-400"
                    >
                      #{tag}
                    </span>
                  ))}

                  {t.comments && t.comments.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                      <MessageSquare className="w-3 h-3 text-zinc-400" />
                      <span>{t.comments.length}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Botón Ver Detalle */}
              <div className="flex items-center justify-end shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-300 transition-all text-xs font-medium">
                  <span>Ver Detalle</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
