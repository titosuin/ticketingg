/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TicketEngine } from './engine/ticketEngine.ts';
import type {
  Ticket,
  QueueMetrics,
  EnqueueTicketInput,
  RequeueStrategy,
  UserAccount,
} from './engine/types.ts';
import { defaultAuthManager, AuthManager } from './engine/security.ts';
import { appDatabase } from './engine/database.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { Header } from './components/Header.tsx';
import { WorkerFleet, WorkerStatus } from './components/WorkerFleet.tsx';
import { QueueExplorer } from './components/QueueExplorer.tsx';
import { DLQInspector } from './components/DLQInspector.tsx';
import { EnqueueModal } from './components/EnqueueModal.tsx';
import { TicketDetailModal } from './components/TicketDetailModal.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';
import { AppTour } from './components/AppTour.tsx';
import { Inbox, Clock, CheckCircle2, AlertOctagon } from 'lucide-react';

const INITIAL_WORKERS: WorkerStatus[] = [
  { id: 'worker-1', name: 'Agente 1', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 15000 },
  { id: 'worker-2', name: 'Agente 2', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 15000 },
  { id: 'worker-3', name: 'Agente 3', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 15000 },
  { id: 'worker-4', name: 'Agente 4', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 15000 },
  { id: 'worker-5', name: 'Agente 5', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 15000 },
];

export default function App() {
  const engineRef = useRef<TicketEngine>(new TicketEngine({ defaultLeaseTtlMs: 15000, defaultMaxRetries: 3 }));
  const authManagerRef = useRef<AuthManager>(defaultAuthManager);

  // Sesión Activa RBAC
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => appDatabase.getSavedSession());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'main' | 'dlq'>('main');

  const [metrics, setMetrics] = useState<QueueMetrics>(engineRef.current.get_metrics());
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>(INITIAL_WORKERS);

  // Modales y Tour Guiado
  const [isEnqueueOpen, setIsEnqueueOpen] = useState(false);
  const [inspectTicket, setInspectTicket] = useState<Ticket | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(() => !localStorage.getItem('aegisflow_tour_completed'));

  // Sincronización del estado del motor y persistencia
  const refreshEngineState = useCallback(() => {
    const engine = engineRef.current;
    const m = engine.get_metrics();
    setMetrics(m);
    const tickets = engine.get_all_tickets();
    setAllTickets(tickets);
    appDatabase.saveTicketsBatch(tickets);
  }, []);

  // Cargar tickets guardados en base de datos al inicio
  useEffect(() => {
    const init = async () => {
      const savedTickets = appDatabase.getAllTickets();
      if (savedTickets.length > 0) {
        for (const t of savedTickets) {
          await engineRef.current.enqueue({
            title: t.payload.title,
            description: t.payload.description,
            tags: t.payload.tags,
            severity: t.severity,
            author: t.author,
            slaMinutes: t.payload.slaMinutes,
            maxRetries: t.dispatchTelemetry.maxRetries,
            context: t.payload.context,
          });
        }
      }
      refreshEngineState();
    };
    init();
  }, [refreshEngineState]);

  // Bucle de temporización para agentes y leases
  useEffect(() => {
    const timer = setInterval(async () => {
      const engine = engineRef.current;
      const now = Date.now();

      const evicted = await engine.evict_expired_leases(now);
      if (evicted > 0) {
        refreshEngineState();
      }

      setWorkers((prevWorkers) =>
        prevWorkers.map((w) => {
          if (w.assignedTicket) {
            const currentTicket = engine.get_ticket(w.assignedTicket.id);
            if (!currentTicket || currentTicket.state !== 'PROCESSING' || currentTicket.dispatchTelemetry.currentWorkerId !== w.id) {
              return {
                ...w,
                assignedTicket: null,
                state: 'IDLE',
                leaseRemainingMs: 0,
                evictedCount: w.evictedCount + (currentTicket?.state === 'REQUEUED' || currentTicket?.state === 'DEAD_LETTER' ? 1 : 0),
              };
            }

            const remaining = Math.max(0, (currentTicket.timestamps.leaseExpiresAt ?? now) - now);
            return {
              ...w,
              leaseRemainingMs: remaining,
              assignedTicket: currentTicket,
            };
          }
          return w;
        })
      );

      refreshEngineState();
    }, 300);

    return () => clearInterval(timer);
  }, [refreshEngineState]);

  // Acciones de Ticket
  const handleEnqueue = async (input: EnqueueTicketInput) => {
    const newTicket = await engineRef.current.enqueue(input);
    appDatabase.saveTicket(newTicket);
    refreshEngineState();
  };

  const handleManualAcquire = async (workerId: string) => {
    const ticket = await engineRef.current.acquire_next(workerId, 15000);
    if (ticket) {
      appDatabase.saveTicket(ticket);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                assignedTicket: ticket,
                state: 'PROCESSING',
                leaseRemainingMs: 15000,
                leaseTotalMs: 15000,
              }
            : w
        )
      );
      refreshEngineState();
    }
  };

  const handleCommitResolution = async (workerId: string, ticketId: string) => {
    try {
      const ticket = await engineRef.current.commit_resolution(
        ticketId,
        workerId,
        `Solución validada y completada por el ${workerId}`
      );
      appDatabase.saveTicket(ticket);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                assignedTicket: null,
                state: 'IDLE',
                resolvedCount: w.resolvedCount + 1,
                leaseRemainingMs: 0,
              }
            : w
        )
      );
      refreshEngineState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequeue = async (workerId: string, ticketId: string, strategy: RequeueStrategy) => {
    try {
      const ticket = await engineRef.current.requeue(
        ticketId,
        'Devuelto a la cola para reasignación de atención',
        strategy
      );
      appDatabase.saveTicket(ticket);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                assignedTicket: null,
                state: 'IDLE',
                requeuedCount: w.requeuedCount + 1,
                leaseRemainingMs: 0,
              }
            : w
        )
      );
      refreshEngineState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleHeartbeat = async (workerId: string, ticketId: string) => {
    try {
      await engineRef.current.heartbeat_lease(ticketId, workerId, 10000);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                leaseRemainingMs: w.leaseRemainingMs + 10000,
                leaseTotalMs: Math.max(w.leaseTotalMs, w.leaseRemainingMs + 10000),
              }
            : w
        )
      );
      refreshEngineState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplayDLQ = async (ticketId: string, resetRetries: boolean) => {
    const ticket = await engineRef.current.replay_dlq_ticket(ticketId, resetRetries);
    if (ticket) appDatabase.saveTicket(ticket);
    refreshEngineState();
  };

  const handleLogout = () => {
    appDatabase.clearSession();
    setCurrentUser(null);
  };

  // Tickets visibles según rol (RLS estricto para Solicitante)
  const visibleTickets = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'requester') {
      return engineRef.current.get_tickets_for_user(currentUser);
    }
    return allTickets;
  }, [currentUser, allTickets]);

  // Si no hay sesión iniciada, mostrar LoginScreen
  if (!currentUser) {
    return (
      <LoginScreen
        authManager={authManagerRef.current}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          refreshEngineState();
        }}
      />
    );
  }

  const isRequester = currentUser.role === 'requester';

  // Cálculos de resumen para Solicitante
  const myQueuedCount = visibleTickets.filter((t) => t.state === 'QUEUED' || t.state === 'REQUEUED').length;
  const myProcessingCount = visibleTickets.filter((t) => t.state === 'PROCESSING').length;
  const myCompletedCount = visibleTickets.filter((t) => t.state === 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Encabezado Limpio */}
      <Header
        currentUser={currentUser}
        onOpenEnqueue={() => setIsEnqueueOpen(true)}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onLogout={handleLogout}
        dlqCount={metrics.deadLetterCount}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* VISTA PARA SOLICITANTE (Desarrollador) */}
        {isRequester && (
          <>
            {/* 3 Tarjetas de Resumen Simples */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                <div className="p-3 rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    En Espera
                  </span>
                  <span className="text-2xl font-bold text-white">
                    {myQueuedCount}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    En Atención
                  </span>
                  <span className="text-2xl font-bold text-white">
                    {myProcessingCount}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Resueltos
                  </span>
                  <span className="text-2xl font-bold text-white">
                    {myCompletedCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Lista de Solicitudes Propias */}
            <QueueExplorer
              tickets={visibleTickets}
              onSelectTicket={(t) => setInspectTicket(t)}
              currentUser={currentUser}
            />
          </>
        )}

        {/* VISTA PARA SOPORTE Y ADMINISTRADORES */}
        {!isRequester && (
          <>
            {/* 4 Tarjetas de Resumen Simples */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0">
                  <Inbox className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    En Cola
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-white">
                    {metrics.totalQueued}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400 shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    En Atención
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-white">
                    {metrics.activeLeases.length}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Resueltos
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-white">
                    {metrics.totalResolved}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-rose-500/15 text-rose-400 shrink-0">
                  <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Con Error
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-white">
                    {metrics.deadLetterCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Vista DLQ (Con Error) si está activa */}
            {activeView === 'dlq' ? (
              <DLQInspector
                dlqTickets={engineRef.current.get_dlq_tickets()}
                onReplayTicket={handleReplayDLQ}
                onSelectTicket={(t) => setInspectTicket(t)}
              />
            ) : (
              <>
                {/* Panel de Atención de Agentes */}
                <WorkerFleet
                  workers={workers}
                  onManualAcquire={handleManualAcquire}
                  onCommitResolution={handleCommitResolution}
                  onRequeue={handleRequeue}
                  onHeartbeat={handleHeartbeat}
                  onSelectTicket={(t) => setInspectTicket(t)}
                  currentUser={currentUser}
                />

                {/* Lista General de Tickets */}
                <QueueExplorer
                  tickets={visibleTickets}
                  onSelectTicket={(t) => setInspectTicket(t)}
                  currentUser={currentUser}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Modales */}
      <EnqueueModal
        isOpen={isEnqueueOpen}
        onClose={() => setIsEnqueueOpen(false)}
        onEnqueue={handleEnqueue}
        currentUser={currentUser}
      />

      <TicketDetailModal
        ticket={inspectTicket}
        onClose={() => setInspectTicket(null)}
      />

      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        authManager={authManagerRef.current}
        currentUser={currentUser}
        onSelectUser={(u) => {
          setCurrentUser(u);
          appDatabase.saveSession(u);
          refreshEngineState();
        }}
        onUsersUpdated={() => refreshEngineState()}
      />

      {/* Tour Guiado Interactivo */}
      <AppTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        userName={currentUser.name}
        userRole={currentUser.role}
      />

      {/* Pie de Página Limpio */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>AegisFlow Enterprise &bull; Sistema Inteligente de Despacho &amp; Tickets</span>
        <span className="text-slate-400">Conectado como <strong className="text-slate-200">{currentUser.name}</strong></span>
      </footer>
    </div>
  );
}
