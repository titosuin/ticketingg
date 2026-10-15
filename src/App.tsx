/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TicketEngine } from './engine/ticketEngine.ts';
import type {
  Ticket,
  TicketState,
  QueueMetrics,
  EnqueueTicketInput,
  RequeueStrategy,
  UserAccount,
} from './engine/types.ts';
import { defaultAuthManager, SecurityViolationError, AuthManager } from './engine/security.ts';
import { appDatabase } from './engine/database.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { Header } from './components/Header.tsx';
import { MetricsBar } from './components/MetricsBar.tsx';
import { FSMVisualizer } from './components/FSMVisualizer.tsx';
import { WorkerFleet, WorkerStatus } from './components/WorkerFleet.tsx';
import { QueueExplorer } from './components/QueueExplorer.tsx';
import { DLQInspector } from './components/DLQInspector.tsx';
import { ConcurrencyRunner } from './components/ConcurrencyRunner.tsx';
import { ArchitectureDocs } from './components/ArchitectureDocs.tsx';
import { EnqueueModal } from './components/EnqueueModal.tsx';
import { TicketDetailModal } from './components/TicketDetailModal.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';

const INITIAL_WORKERS: WorkerStatus[] = [
  { id: 'worker-alpha', name: 'Trabajador Alfa', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-beta', name: 'Trabajador Beta', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-gamma', name: 'Trabajador Gamma', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-delta', name: 'Trabajador Delta', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-epsilon', name: 'Trabajador Épsilon', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
];

export default function App() {
  const engineRef = useRef<TicketEngine>(new TicketEngine({ defaultLeaseTtlMs: 6000, defaultMaxRetries: 3 }));
  const authManagerRef = useRef<AuthManager>(defaultAuthManager);

  // Sesión Activa RBAC (Autenticación Persistente)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => appDatabase.getSavedSession());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [idorAlert, setIdorAlert] = useState<{ message: string; code: string; targetId: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'main' | 'dlq' | 'concurrency' | 'architecture'>('main');
  // Auto-resolución desactivada por directiva: los tickets permanecen en cola hasta que un operador los tome
  const [isSimRunning, setIsSimRunning] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [selectedStateFilter, setSelectedStateFilter] = useState<TicketState | null>(null);

  const [metrics, setMetrics] = useState<QueueMetrics>(engineRef.current.get_metrics());
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>(INITIAL_WORKERS);

  // Modales
  const [isEnqueueOpen, setIsEnqueueOpen] = useState(false);
  const [inspectTicket, setInspectTicket] = useState<Ticket | null>(null);

  // Redirigir a 'main' si el usuario cambia a 'requester' y estaba en pestaña admin
  useEffect(() => {
    if (currentUser?.role === 'requester' && activeTab !== 'main') {
      setActiveTab('main');
    }
  }, [currentUser, activeTab]);

  // Sincronización del estado del motor y base de datos
  const refreshEngineState = useCallback(() => {
    const engine = engineRef.current;
    const m = engine.get_metrics();
    setMetrics(m);
    const tickets = engine.get_all_tickets();
    setAllTickets(tickets);
    appDatabase.saveTicketsBatch(tickets);
  }, []);

  // Cargar tickets persistentes desde la Base de Datos al inicializar
  useEffect(() => {
    const init = async () => {
      const savedTickets = appDatabase.getAllTickets();
      if (savedTickets.length > 0) {
        // Restaurar tickets en el motor
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

  // Bucle de latido: actualiza temporizadores de lease y expulsa vencidos si el worker expira
  useEffect(() => {
    const timer = setInterval(async () => {
      const engine = engineRef.current;
      const now = Date.now();

      // Expulsar leases vencidos automáticamente si el lease llega a 0
      const evicted = await engine.evict_expired_leases(now);
      if (evicted > 0) {
        refreshEngineState();
      }

      // Actualizar contadores de trabajadores en procesamiento manual
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
    }, 250);

    return () => clearInterval(timer);
  }, [refreshEngineState]);

  // Manejadores para acciones del operador
  const handleEnqueue = async (input: EnqueueTicketInput) => {
    const newTicket = await engineRef.current.enqueue(input);
    appDatabase.saveTicket(newTicket);
    refreshEngineState();
  };

  const handleBurstEnqueue = async () => {
    if (!currentUser || currentUser.role === 'requester') return;
    const engine = engineRef.current;
    const channels = ['API', 'WEBHOOK', 'MONITORING', 'SLACK', 'PORTAL'] as const;
    const departments = ['Ingeniería de Plataforma', 'Plataforma de Datos', 'Operaciones de Seguridad', 'Servicios de Pago', 'Infraestructura Core'];

    for (let i = 0; i < 5; i++) {
      const sev = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      const t = await engine.enqueue({
        title: `Evento de Ráfaga de Ingesta #${Math.floor(Math.random() * 9000 + 1000)}`,
        description: `Paquete sintético de alta concurrencia verificando reequilibrio de heap y bloqueos atómicos sin condiciones de carrera.`,
        tags: ['rafaga', `nivel-${sev}`, 'carga-sintetica'],
        severity: sev,
        author: {
          id: `usr_${Math.floor(Math.random() * 1000)}`,
          name: `Agente Sintético ${i + 1}`,
          department: departments[i % departments.length],
          channel: channels[i % channels.length],
        },
        maxRetries: 3,
        slaMinutes: sev === 4 ? 15 : sev === 3 ? 45 : 120,
      });
      appDatabase.saveTicket(t);
    }
    refreshEngineState();
  };

  const handleReset = async () => {
    if (!currentUser || currentUser.role === 'requester') return;
    engineRef.current = new TicketEngine({ defaultLeaseTtlMs: 6000, defaultMaxRetries: 3 });
    setWorkers(INITIAL_WORKERS);
    appDatabase.clearAllTickets();
    refreshEngineState();
  };

  const handleManualAcquire = async (workerId: string) => {
    const ticket = await engineRef.current.acquire_next(workerId, 6000);
    if (ticket) {
      appDatabase.saveTicket(ticket);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                assignedTicket: ticket,
                state: 'PROCESSING',
                leaseRemainingMs: 6000,
                leaseTotalMs: 6000,
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
        `Resolución confirmada manualmente por el operador vía ${workerId}`
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
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleRequeue = async (workerId: string, ticketId: string, strategy: RequeueStrategy) => {
    try {
      const ticket = await engineRef.current.requeue(
        ticketId,
        `Reencolado manual por operador con estrategia: ${strategy}`,
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
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleHeartbeat = async (workerId: string, ticketId: string) => {
    try {
      await engineRef.current.heartbeat_lease(ticketId, workerId, 4000);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId
            ? {
                ...w,
                leaseRemainingMs: w.leaseRemainingMs + 4000,
                leaseTotalMs: Math.max(w.leaseTotalMs, w.leaseRemainingMs + 4000),
              }
            : w
        )
      );
      refreshEngineState();
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleCrashWorker = (workerId: string) => {
    setWorkers((prev) =>
      prev.map((w) =>
        w.id === workerId
          ? {
              ...w,
              state: 'CRASHED',
            }
          : w
      )
    );
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

  // Manejador para simulación de ataque IDOR
  const handleSimulateIdor = () => {
    if (!currentUser) return;
    const all = engineRef.current.get_all_tickets();
    const foreignTicket = all.find((t) => t.author.id !== currentUser.id) || all[0];
    const targetId = foreignTicket ? foreignTicket.id : '018bcfe5-6800-7000-81ec-dfe5dca0ed87';

    try {
      engineRef.current.get_ticket_secure(targetId, currentUser);
      setIdorAlert({
        code: 'INSECURE_ACCESS_PERMITTED',
        message: `Acceso no denegado para el ticket ${targetId}`,
        targetId,
      });
    } catch (err: unknown) {
      if (err instanceof SecurityViolationError) {
        setIdorAlert({
          code: err.code,
          message: err.message,
          targetId,
        });
      } else if (err instanceof Error) {
        setIdorAlert({
          code: 'BOLA_ACCESS_DENIED',
          message: err.message,
          targetId,
        });
      }
    }
  };

  // Manejador para inyección forense a DLQ con secretos reales
  const handleInjectSensitiveDLQ = async () => {
    if (!currentUser) return;
    const engine = engineRef.current;
    const now = Date.now();

    const injected = await engine.enqueue({
      title: 'Fuga de Credenciales Forense en Microservicio de Pagos',
      description:
        'Error crítico en pasarela: timeout conectando a postgres://app_user:s3cr3tP@ss!@pg-cluster.internal:5432/finance_db con JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIERldiJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      tags: ['seguridad', 'jwt', 'postgres', 'dlq-forensic-test'],
      severity: 4,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        department: currentUser.department,
        channel: 'API',
      },
      maxRetries: 2,
      context: {
        connectionString: 'postgres://operator_admin:MasterKeySecret2026@10.0.0.1:5432/ledger',
        apiSecretKey: 'mock_api_key_998877665544332211aabbcc',
        bearerToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        privatePassword: 'plain_text_dev_password_do_not_share',
      },
    });

    await engine.acquire_next('worker-sec-tester', 3000, now + 10);
    await engine.requeue(
      injected.id,
      'Fallo transitorio conectando a redis://cache.internal:6379/0 con JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      'HEAD',
      now + 20
    );

    await engine.acquire_next('worker-sec-tester', 3000, now + 30);
    const dlqT = await engine.requeue(
      injected.id,
      'Fallo irrecuperable en postgres://admin_root:SuperSecretP@ssword@database.prod:5432/vault con API Key mock_api_key_8833771199',
      'HEAD',
      now + 40
    );

    appDatabase.saveTicket(dlqT);
    refreshEngineState();
    setActiveTab('dlq');
  };

  // Si no hay sesión autenticada, mostrar pantalla de inicio de sesión seguro
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

  // Tickets visibles para el usuario actual según Row-Level Security
  const visibleTickets =
    currentUser.role === 'requester'
      ? engineRef.current.get_tickets_for_user(currentUser)
      : allTickets;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Encabezado Global con Switcher RBAC y Logout */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSimRunning={isSimRunning}
        setIsSimRunning={setIsSimRunning}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        onOpenEnqueue={() => setIsEnqueueOpen(true)}
        onBurstEnqueue={handleBurstEnqueue}
        onReset={handleReset}
        dlqCount={metrics.deadLetterCount}
        totalQueued={metrics.totalQueued}
        currentUser={currentUser}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Área de Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {/* Barra de Métricas O(1) en Tiempo Real */}
        <MetricsBar metrics={metrics} />

        {/* Vistas Dinámicas */}
        {activeTab === 'main' && (
          <div className="space-y-6">
            {/* Visualizador de Máquina de Estados Finitos */}
            <FSMVisualizer
              metrics={metrics}
              selectedStateFilter={selectedStateFilter}
              onFilterState={(st) => setSelectedStateFilter(st)}
            />

            {/* Flota Distribuida de 5 Trabajadores (Oculta para Solicitantes) */}
            {currentUser.role !== 'requester' && (
              <WorkerFleet
                workers={workers}
                onManualAcquire={handleManualAcquire}
                onCommitResolution={handleCommitResolution}
                onRequeue={handleRequeue}
                onCrashWorker={handleCrashWorker}
                onHeartbeat={handleHeartbeat}
                onSelectTicket={(t) => setInspectTicket(t)}
                currentUser={currentUser}
              />
            )}

            {/* Explorador de Cola de Prioridad y Repositorio */}
            <QueueExplorer
              tickets={visibleTickets}
              selectedStateFilter={selectedStateFilter}
              onClearFilter={() => setSelectedStateFilter(null)}
              onSelectTicket={(t) => setInspectTicket(t)}
              currentUser={currentUser}
              onSimulateIdor={handleSimulateIdor}
              idorAlert={idorAlert}
              onDismissIdorAlert={() => setIdorAlert(null)}
            />
          </div>
        )}

        {activeTab === 'dlq' && currentUser.role !== 'requester' && (
          <DLQInspector
            dlqTickets={engineRef.current.get_dlq_tickets()}
            onReplayTicket={handleReplayDLQ}
            onSelectTicket={(t) => setInspectTicket(t)}
            onInjectSensitiveDLQ={handleInjectSensitiveDLQ}
          />
        )}

        {activeTab === 'concurrency' && currentUser.role !== 'requester' && <ConcurrencyRunner />}

        {activeTab === 'architecture' && currentUser.role !== 'requester' && <ArchitectureDocs />}
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
          setIdorAlert(null);
          appDatabase.saveSession(u);
          refreshEngineState();
        }}
        onUsersUpdated={() => refreshEngineState()}
      />

      {/* Pie de Página */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Motor de Flujo y Despacho de Tickets Empresarial &bull; Fencing Tokens RFC 9562</span>
        <span className="text-emerald-400 font-bold">Base de Datos: SQLite / Persistent Storage Activa</span>
      </footer>
    </div>
  );
}
