/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TicketEngine } from './engine/ticketEngine.ts';
import type { Ticket, TicketState, QueueMetrics, EnqueueTicketInput, RequeueStrategy } from './engine/types.ts';
import { INITIAL_SEED_TICKETS } from './engine/demoData.ts';
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

const INITIAL_WORKERS: WorkerStatus[] = [
  { id: 'worker-alpha', name: 'Trabajador Alfa', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-beta', name: 'Trabajador Beta', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-gamma', name: 'Trabajador Gamma', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-delta', name: 'Trabajador Delta', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
  { id: 'worker-epsilon', name: 'Trabajador Épsilon', assignedTicket: null, state: 'IDLE', resolvedCount: 0, requeuedCount: 0, evictedCount: 0, leaseRemainingMs: 0, leaseTotalMs: 5000 },
];

export default function App() {
  const engineRef = useRef<TicketEngine>(new TicketEngine({ defaultLeaseTtlMs: 6000, defaultMaxRetries: 3 }));
  const [activeTab, setActiveTab] = useState<'main' | 'dlq' | 'concurrency' | 'architecture'>('main');
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [selectedStateFilter, setSelectedStateFilter] = useState<TicketState | null>(null);

  const [metrics, setMetrics] = useState<QueueMetrics>(engineRef.current.get_metrics());
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>(INITIAL_WORKERS);

  // Modales
  const [isEnqueueOpen, setIsEnqueueOpen] = useState(false);
  const [inspectTicket, setInspectTicket] = useState<Ticket | null>(null);

  // Sincronización del estado del motor
  const refreshEngineState = useCallback(() => {
    const engine = engineRef.current;
    const m = engine.get_metrics();
    setMetrics(m);
    setAllTickets(engine.get_all_tickets());
  }, []);

  // Inicializar tickets de muestra
  useEffect(() => {
    const init = async () => {
      const engine = engineRef.current;
      for (const item of INITIAL_SEED_TICKETS) {
        await engine.enqueue(item);
      }
      refreshEngineState();
    };
    init();
  }, [refreshEngineState]);

  // Bucle de latido: actualiza temporizadores de lease y expulsa vencidos
  useEffect(() => {
    const timer = setInterval(async () => {
      const engine = engineRef.current;
      const now = Date.now();

      // Expulsar leases vencidos automáticamente
      const evicted = await engine.evict_expired_leases(now);
      if (evicted > 0) {
        refreshEngineState();
      }

      // Actualizar contadores de trabajadores
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

  // Ciclo autónomo de simulación de 5 trabajadores
  useEffect(() => {
    if (!isSimRunning) return;

    const intervalMs = Math.max(200, Math.floor(1200 / simSpeed));
    const simInterval = setInterval(async () => {
      const engine = engineRef.current;
      const now = Date.now();

      setWorkers((prevWorkers) => {
        const nextWorkers = [...prevWorkers];

        const idleIndices = nextWorkers
          .map((w, idx) => (w.state === 'IDLE' ? idx : -1))
          .filter((idx) => idx !== -1);

        const busyIndices = nextWorkers
          .map((w, idx) => (w.state === 'PROCESSING' && w.assignedTicket ? idx : -1))
          .filter((idx) => idx !== -1);

        // 1. Si hay un trabajador inactivo, intentar adquirir el siguiente ticket
        if (idleIndices.length > 0 && Math.random() < 0.85) {
          const targetIdx = idleIndices[Math.floor(Math.random() * idleIndices.length)];
          const worker = nextWorkers[targetIdx];

          engine.acquire_next(worker.id, 6000, now).then((ticket) => {
            if (ticket) {
              setWorkers((current) =>
                current.map((cw) =>
                  cw.id === worker.id
                    ? {
                        ...cw,
                        assignedTicket: ticket,
                        state: 'PROCESSING',
                        leaseRemainingMs: 6000,
                        leaseTotalMs: 6000,
                      }
                    : cw
                )
              );
              refreshEngineState();
            }
          });
        }

        // 2. Si hay trabajadores ocupados, avanzar uno hacia resolución o reintento
        if (busyIndices.length > 0 && Math.random() < 0.65) {
          const busyIdx = busyIndices[Math.floor(Math.random() * busyIndices.length)];
          const worker = nextWorkers[busyIdx];
          const ticket = worker.assignedTicket!;

          const roll = Math.random();
          if (roll < 0.75) {
            // Confirmar resolución
            engine
              .commit_resolution(
                ticket.id,
                worker.id,
                `Resolución confirmada y auditada automáticamente por ${worker.name}`,
                { resueltoEn: now, duracionMs: now - ticket.timestamps.createdAt },
                now
              )
              .then(() => {
                setWorkers((current) =>
                  current.map((cw) =>
                    cw.id === worker.id
                      ? {
                          ...cw,
                          assignedTicket: null,
                          state: 'IDLE',
                          resolvedCount: cw.resolvedCount + 1,
                          leaseRemainingMs: 0,
                        }
                      : cw
                  )
                );
                refreshEngineState();
              })
              .catch(() => {});
          } else if (roll < 0.93) {
            // Reencolado por fallo transitorio
            const strategy: RequeueStrategy = Math.random() < 0.5 ? 'HEAD' : 'EXPONENTIAL_BACKOFF';
            engine
              .requeue(
                ticket.id,
                `Timeout transitorio de microservicio detectado en ${worker.name}`,
                strategy,
                now
              )
              .then(() => {
                setWorkers((current) =>
                  current.map((cw) =>
                    cw.id === worker.id
                      ? {
                          ...cw,
                          assignedTicket: null,
                          state: 'IDLE',
                          requeuedCount: cw.requeuedCount + 1,
                          leaseRemainingMs: 0,
                        }
                      : cw
                  )
                );
                refreshEngineState();
              })
              .catch(() => {});
          } else {
            // Heartbeat para extender lease
            engine.heartbeat_lease(ticket.id, worker.id, 4000, now).catch(() => {});
          }
        }

        return nextWorkers;
      });
    }, intervalMs);

    return () => clearInterval(simInterval);
  }, [isSimRunning, simSpeed, refreshEngineState]);

  // Manejadores para acciones del operador
  const handleEnqueue = async (input: EnqueueTicketInput) => {
    await engineRef.current.enqueue(input);
    refreshEngineState();
  };

  const handleBurstEnqueue = async () => {
    const engine = engineRef.current;
    const channels = ['API', 'WEBHOOK', 'MONITORING', 'SLACK', 'PORTAL'] as const;
    const departments = ['Ingeniería de Plataforma', 'Plataforma de Datos', 'Operaciones de Seguridad', 'Servicios de Pago', 'Infraestructura Core'];

    for (let i = 0; i < 5; i++) {
      const sev = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      await engine.enqueue({
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
    }
    refreshEngineState();
  };

  const handleReset = async () => {
    engineRef.current = new TicketEngine({ defaultLeaseTtlMs: 6000, defaultMaxRetries: 3 });
    setWorkers(INITIAL_WORKERS);
    for (const item of INITIAL_SEED_TICKETS) {
      await engineRef.current.enqueue(item);
    }
    refreshEngineState();
  };

  const handleManualAcquire = async (workerId: string) => {
    const ticket = await engineRef.current.acquire_next(workerId, 6000);
    if (ticket) {
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
      await engineRef.current.commit_resolution(
        ticketId,
        workerId,
        `Resolución manual confirmada por el operador vía ${workerId}`
      );
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
      await engineRef.current.requeue(
        ticketId,
        `Reencolado manual por operador con estrategia: ${strategy}`,
        strategy
      );
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
    await engineRef.current.replay_dlq_ticket(ticketId, resetRetries);
    refreshEngineState();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Encabezado Global */}
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

            {/* Flota Distribuida de 5 Trabajadores */}
            <WorkerFleet
              workers={workers}
              onManualAcquire={handleManualAcquire}
              onCommitResolution={handleCommitResolution}
              onRequeue={handleRequeue}
              onCrashWorker={handleCrashWorker}
              onHeartbeat={handleHeartbeat}
              onSelectTicket={(t) => setInspectTicket(t)}
            />

            {/* Explorador de Cola de Prioridad y Repositorio */}
            <QueueExplorer
              tickets={allTickets}
              selectedStateFilter={selectedStateFilter}
              onClearFilter={() => setSelectedStateFilter(null)}
              onSelectTicket={(t) => setInspectTicket(t)}
            />
          </div>
        )}

        {activeTab === 'dlq' && (
          <DLQInspector
            dlqTickets={engineRef.current.get_dlq_tickets()}
            onReplayTicket={handleReplayDLQ}
            onSelectTicket={(t) => setInspectTicket(t)}
          />
        )}

        {activeTab === 'concurrency' && <ConcurrencyRunner />}

        {activeTab === 'architecture' && <ArchitectureDocs />}
      </main>

      {/* Modales */}
      <EnqueueModal
        isOpen={isEnqueueOpen}
        onClose={() => setIsEnqueueOpen(false)}
        onEnqueue={handleEnqueue}
      />

      <TicketDetailModal
        ticket={inspectTicket}
        onClose={() => setInspectTicket(null)}
      />

      {/* Pie de Página */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Motor de Flujo y Despacho de Tickets Empresarial &bull; Ingeniería de Sistemas Distribuidos &bull; Identificadores Monótonos UUIDv7
      </footer>
    </div>
  );
}
