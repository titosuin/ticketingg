/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Layers, Lock, Shield, Cpu, Clock } from 'lucide-react';

export const ArchitectureDocs: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-slate-100">
              ESPECIFICACIÓN ARQUITECTÓNICA Y CONTRATOS FORMALES
            </h1>
            <p className="text-xs text-slate-400">
              Motor de Flujo y Despacho de Tickets Empresarial &bull; Whitepaper de Ingeniería de Sistemas Distribuidos
            </p>
          </div>
        </div>
      </div>

      {/* 1. Modelo Formal y FSM */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold font-mono text-indigo-400 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span>1. Modelo Formal y Máquina de Estados Finitos Estricta (FSM)</span>
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          El ciclo de vida del ticket está regido estrictamente por una Máquina de Estados Finitos (FSM) determinista donde cada transición es atómica, no reentrante e inserta un evento inmutable en el registro de auditoría cronológico del ticket.
        </p>

        {/* Tabla de Transiciones */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border border-slate-800 rounded-lg">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2.5">Estado Origen</th>
                <th className="p-2.5">Estado Destino</th>
                <th className="p-2.5">Disparador / Método</th>
                <th className="p-2.5">Guardas y Condiciones Previas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="p-2.5 text-slate-500">INICIO</td>
                <td className="p-2.5 text-indigo-400 font-bold">QUEUED</td>
                <td className="p-2.5"><code>enqueue()</code></td>
                <td className="p-2.5 text-slate-400">Generación de UUIDv7 canónico ordenable temporalmente y asignación de prioridad base</td>
              </tr>
              <tr>
                <td className="p-2.5 text-indigo-400 font-bold">QUEUED</td>
                <td className="p-2.5 text-cyan-400 font-bold">PROCESSING</td>
                <td className="p-2.5"><code>acquire_next()</code></td>
                <td className="p-2.5 text-slate-400">Bloqueo atómico AsyncMutex; asigna worker_id y lease con expiración TTL</td>
              </tr>
              <tr>
                <td className="p-2.5 text-cyan-400 font-bold">PROCESSING</td>
                <td className="p-2.5 text-emerald-400 font-bold">COMPLETED</td>
                <td className="p-2.5"><code>commit_resolution()</code></td>
                <td className="p-2.5 text-slate-400">El ID de trabajador coincide con el lease; el lease no ha expirado (<code>now &le; lease_expires_at</code>)</td>
              </tr>
              <tr>
                <td className="p-2.5 text-cyan-400 font-bold">PROCESSING</td>
                <td className="p-2.5 text-amber-400 font-bold">REQUEUED</td>
                <td className="p-2.5"><code>requeue()</code> / Expulsión</td>
                <td className="p-2.5 text-slate-400">Incrementa contador de reintentos; libera el bloqueo del trabajador actual</td>
              </tr>
              <tr>
                <td className="p-2.5 text-amber-400 font-bold">REQUEUED</td>
                <td className="p-2.5 text-rose-400 font-bold">DEAD_LETTER</td>
                <td className="p-2.5">Enrutador DLQ</td>
                <td className="p-2.5 text-slate-400">Se activa automáticamente si <code>retry_count &ge; max_retries</code> (por defecto 3)</td>
              </tr>
              <tr>
                <td className="p-2.5 text-amber-400 font-bold">REQUEUED</td>
                <td className="p-2.5 text-indigo-400 font-bold">QUEUED</td>
                <td className="p-2.5">Reingreso Programado</td>
                <td className="p-2.5 text-slate-400">Si <code>retry_count &lt; max_retries</code>; aplica estrategia HEAD, TAIL o BACKOFF</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Complejidad Algorítmica */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          <span>2. Complejidad Algorítmica y Estructuras de Datos</span>
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          La cola de prioridad se implementa mediante un <strong>Max-Heap Binario Indexado</strong> optimizado con una tabla hash inversa de posiciones (<code>idToIndex: Map&lt;string, number&gt;</code>) y registros de métricas incrementales, cumpliendo estrictamente con las cotas Big-O:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border border-slate-800 rounded-lg">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2.5">Operación</th>
                <th className="p-2.5">Complejidad Temporal</th>
                <th className="p-2.5">Estructura de Datos y Mecanismo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              <tr>
                <td className="p-2.5 font-bold"><code>enqueue()</code></td>
                <td className="p-2.5 text-emerald-400 font-bold">O(log N)</td>
                <td className="p-2.5 text-slate-400">Inserción al final del arreglo + siftUp ascendente con puntuación dinámica</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold"><code>acquire_next()</code></td>
                <td className="p-2.5 text-emerald-400 font-bold">O(log N)</td>
                <td className="p-2.5 text-slate-400">Extracción de la raíz (extractMax) + siftDown descendente con exclusión atómica</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold"><code>peek_queue()</code></td>
                <td className="p-2.5 text-emerald-400 font-bold">O(1) / O(K log K)</td>
                <td className="p-2.5 text-slate-400">Acceso a la cabeza en O(1); inspección de ventana de K elementos en O(K log K)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold"><code>commit_resolution()</code></td>
                <td className="p-2.5 text-emerald-400 font-bold">O(1)</td>
                <td className="p-2.5 text-slate-400">Búsqueda directa por clave hash y remoción del registro de procesamiento</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold"><code>get_metrics()</code></td>
                <td className="p-2.5 text-emerald-400 font-bold">O(1)</td>
                <td className="p-2.5 text-slate-400">Lectura de acumuladores e índices enteros en memoria (dwell, severidades, totales)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold"><code>remove(id)</code></td>
                <td className="p-2.5 text-emerald-400 font-bold">O(log N)</td>
                <td className="p-2.5 text-slate-400">Búsqueda en O(1) vía <code>idToIndex</code> + intercambio con el último nodo + reequilibrio</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Prevención de Inanición */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold font-mono text-purple-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>3. Prevención de Inanición (Fórmula de Envejecimiento y Demostración Matemática)</span>
        </h2>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-purple-300">
          <div className="font-bold text-slate-200 mb-2">Fórmula de Puntuación Efectiva Dinámica:</div>
          <div>P_eff(t) = P_base + &alpha; &times; (t - t_enqueued) + &beta; &times; Urgencia_SLA(t) - Penalizacion_Backoff</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Donde &alpha; = 0.05 puntos/ms (50 pts/segundo), &beta; = multiplicador de proximidad a SLA
          </div>
        </div>

        <div className="text-xs text-slate-300 font-sans space-y-2">
          <p className="font-semibold text-slate-200">Teorema Formal de Inmunidad a la Inanición (Starvation-Freedom):</p>
          <p>
            Sea $T_L$ un ticket de baja prioridad con puntuación base $P_L = 100$ encolado en el instante $t_0$. Sea $T_H$ un ticket de alta prioridad con puntuación base $P_H = 1000$ ingresado en $t_1 &gt; t_0$.
          </p>
          <p className="font-mono bg-slate-950 p-3 rounded border border-slate-800 text-[11px] text-slate-300">
            P_eff(T_L, t) &gt; P_eff(T_H, t) &iff; 100 + &alpha; &times; (t - t_0) &gt; 1000 + &alpha; &times; (t - t_1)
            <br />
            &alpha; &times; (t_1 - t_0) &gt; 900 &rArr; &Delta;t_wait &gt; (P_H - P_L) / &alpha;
          </p>
          <p>
            Dado que &Delta;t_wait = 900 / 0.05 = 18,000ms (18 segundos) es estrictamente finito, cualquier ticket de baja prioridad tiene garantizado superar en puntuación efectiva a tickets de mayor severidad recién llegados tras un tiempo finito de retención en cola, eliminando totalmente la inversión de prioridades.
          </p>
        </div>
      </section>

      {/* 4. Protocolo de Lease */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <span>4. Protocolo Atómico de Bloqueo por Lease y Esgrima Distribuida (Fencing)</span>
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          Para evitar condiciones de carrera y procesamiento duplicado al escalar a $K$ trabajadores concurrentes:
        </p>

        <ul className="text-xs font-mono space-y-2 text-slate-300 list-disc list-inside">
          <li>
            <strong className="text-slate-100">Adquisición por Lease:</strong> Al llamar a <code>acquire_next()</code>, el ticket se extrae del heap y recibe un bloqueo temporal: <code>lease_expires_at = now + lease_ttl</code>.
          </li>
          <li>
            <strong className="text-slate-100">Token de Esgrima (Fencing):</strong> Cada confirmación de resolución valida que el <code>worker_id</code> de la llamada coincida estrictamente con el titular del lease activo.
          </li>
          <li>
            <strong className="text-slate-100">Renovación por Heartbeat:</strong> Tareas que requieren cómputo extendido emiten <code>heartbeat_lease()</code> periódicamente para extender el TTL antes de su vencimiento.
          </li>
          <li>
            <strong className="text-slate-100">Expulsión y Recuperación ante Caídas:</strong> Si un trabajador se cae o se desconecta, el motor detecta <code>now &gt; lease_expires_at</code>, registra un evento de auditoría de expulsión, incrementa <code>retry_count</code> y reencola el ticket con prioridad de recuperación. Cero tickets perdidos.
          </li>
        </ul>
      </section>

      {/* 5. Requeue y DLQ */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold font-mono text-rose-400 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>5. Estrategias de Reingreso y Aislamiento en DLQ</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-amber-400 font-bold block mb-1">HEAD (Ráfaga LIFO)</span>
            <p className="text-slate-400 font-sans text-[11px]">
              Aplica un impulso de prioridad (+2000 pts) para que el ticket sea atendido de inmediato por el siguiente trabajador libre.
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-indigo-400 font-bold block mb-1">TAIL (Reingreso Estándar)</span>
            <p className="text-slate-400 font-sans text-[11px]">
              Reencola con marca de tiempo actual como una llegada ordinaria, sujeta a las curvas normales de envejecimiento.
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-purple-400 font-bold block mb-1">BACKOFF EXPONENCIAL</span>
            <p className="text-slate-400 font-sans text-[11px]">
              Programa un retraso progresivo: T_delay = T_base &times; 2^(retry - 1). El ticket queda en espera hasta que expire el backoff.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-rose-950/20 border border-rose-800/40 rounded-lg text-xs font-mono text-rose-200">
          <span className="font-bold text-rose-400 block mb-1">Regla de Aislamiento en DLQ:</span>
          Cuando <code>retry_count &ge; max_retries</code> (3 por defecto), el ticket transiciona incondicionalmente a <code>DEAD_LETTER</code> para proteger a los trabajadores de fallos recurrentes (poison pills), manteniendo intacto su historial forense completo.
        </div>
      </section>
    </div>
  );
};
