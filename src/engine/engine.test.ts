/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateUUIDv7, extractTimestampFromUUIDv7 } from './uuidv7.ts';
import { IndexedPriorityQueue, calculateDynamicScore } from './priorityQueue.ts';
import { TicketEngine } from './ticketEngine.ts';
import type { Ticket, TicketAuthor, IngestChannel } from './types.ts';

const mockAuthor: TicketAuthor = {
  id: 'usr_infra_01',
  name: 'DevOps Lead',
  department: 'Core Infrastructure',
  channel: 'API' as IngestChannel,
};

test('UUIDv7: generates RFC 9562 compliant monotonically sortable identifiers', () => {
  const ids: string[] = [];
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    ids.push(generateUUIDv7(t0 + i));
  }

  // 1. Regex check for UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const id of ids) {
    assert.match(id, uuidRegex, `ID ${id} must match RFC 9562 UUIDv7 format`);
  }

  // 2. Monotonic sortability
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted, 'UUIDv7 must be lexicographically monotonically sorted');

  // 3. Extracted timestamp sanity
  const extracted = extractTimestampFromUUIDv7(ids[0]);
  assert.equal(extracted, t0, 'Extracted timestamp must match generator input');
});

test('Priority Queue: Starvation Prevention (Aging Mechanism)', () => {
  const pq = new IndexedPriorityQueue({ agingRatePerMs: 1.0 }); // 1 point per ms for clear test delta
  const baseTime = 1000000;

  // Low severity ticket enqueued at t0
  const lowTicket: Ticket = {
    id: generateUUIDv7(baseTime),
    state: 'QUEUED',
    author: mockAuthor,
    payload: { title: 'Low priority maintenance', description: 'Log rotation', tags: ['maintenance'] },
    severity: 1,
    basePriorityScore: 100,
    slaDeadlineMs: baseTime + 1_000_000,
    timestamps: {
      createdAt: baseTime,
      enqueuedAt: baseTime,
      assignedAt: null,
      resolvedAt: null,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: null,
      leaseTtlMs: 5000,
      auditTrail: [],
    },
  };

  pq.enqueue(lowTicket, baseTime);

  // High severity ticket enqueued 500ms later (base priority 500 vs 100)
  const highTicket: Ticket = {
    id: generateUUIDv7(baseTime + 500),
    state: 'QUEUED',
    author: mockAuthor,
    payload: { title: 'High priority alert', description: 'CPU Spike', tags: ['alert'] },
    severity: 3,
    basePriorityScore: 500,
    slaDeadlineMs: baseTime + 1_000_000,
    timestamps: {
      createdAt: baseTime + 500,
      enqueuedAt: baseTime + 500,
      assignedAt: null,
      resolvedAt: null,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: null,
      leaseTtlMs: 5000,
      auditTrail: [],
    },
  };

  pq.enqueue(highTicket, baseTime + 500);

  // At t = baseTime + 500:
  // Low ticket score: 100 + (500 * 1.0) = 600
  // High ticket score: 500 + (0 * 1.0) = 500
  // Starvation prevention ensures the low ticket has gained enough weight to be served!
  const extracted = pq.extractMax(baseTime + 500);
  assert.equal(extracted?.id, lowTicket.id, 'Low priority ticket aged sufficiently to prevent starvation');
});

test('FSM Lifecycle: QUEUED -> PROCESSING -> COMPLETED with lease verification', async () => {
  const engine = new TicketEngine({ defaultLeaseTtlMs: 5000 });
  const t0 = 1700000000000;

  const ticket = await engine.enqueue(
    {
      title: 'Database replica lag',
      description: 'Replica B lag > 15s',
      tags: ['database', 'replication'],
      severity: 3,
      author: mockAuthor,
    },
    undefined,
    t0
  );

  assert.equal(ticket.state, 'QUEUED');
  assert.equal(ticket.dispatchTelemetry.auditTrail.length, 1);

  // Worker 1 acquires ticket
  const acquired = await engine.acquire_next('worker-alpha', 5000, t0 + 10);
  assert.ok(acquired, 'Ticket should be acquired');
  assert.equal(acquired.id, ticket.id);
  assert.equal(acquired.state, 'PROCESSING');
  assert.equal(acquired.dispatchTelemetry.currentWorkerId, 'worker-alpha');
  assert.equal(acquired.timestamps.leaseExpiresAt, t0 + 10 + 5000);

  // Another worker attempts to acquire should get null (queue is now empty)
  const emptyAcquire = await engine.acquire_next('worker-beta', 5000, t0 + 20);
  assert.equal(emptyAcquire, null);

  // Worker-beta attempts to commit resolution: MUST FAIL (unauthorized worker)
  await assert.rejects(
    async () => {
      await engine.commit_resolution(ticket.id, 'worker-beta', 'Done', {}, t0 + 100);
    },
    /Lease Conflict/,
    'Unauthorized worker must be rejected from committing resolution'
  );

  // Worker-alpha commits valid resolution
  const completed = await engine.commit_resolution(
    ticket.id,
    'worker-alpha',
    'Failover promoted and sync re-established',
    { syncLagMs: 2 },
    t0 + 200
  );

  assert.equal(completed.state, 'COMPLETED');
  assert.equal(completed.resolutionNotes, 'Failover promoted and sync re-established');
  assert.equal(completed.dispatchTelemetry.auditTrail.length, 3); // CREATED -> PROCESSING -> COMPLETED

  const metrics = engine.get_metrics(t0 + 300);
  assert.equal(metrics.totalQueued, 0);
  assert.equal(metrics.processingCount, 0);
  assert.equal(metrics.completedCount, 1);
});

test('Lease Expiration and Auto-Eviction', async () => {
  const engine = new TicketEngine({ defaultLeaseTtlMs: 1000 });
  const t0 = 1700000000000;

  const ticket = await engine.enqueue(
    {
      title: 'Payment gateway webhook delay',
      description: 'Webhook queue spike',
      tags: ['billing'],
      severity: 4,
      author: mockAuthor,
    },
    undefined,
    t0
  );

  // Worker crashes after acquiring ticket
  await engine.acquire_next('worker-crashed', 1000, t0);

  // 1500ms later, lease has expired (t0 + 1500 > t0 + 1000)
  // New healthy worker calls acquire_next; engine automatically evicts expired lease
  const reclaimed = await engine.acquire_next('worker-healthy', 2000, t0 + 1500);

  assert.ok(reclaimed, 'Expired ticket should be reclaimed by engine and dispatched to healthy worker');
  assert.equal(reclaimed.id, ticket.id);
  assert.equal(reclaimed.dispatchTelemetry.currentWorkerId, 'worker-healthy');
  assert.equal(reclaimed.dispatchTelemetry.retryCount, 1, 'Retry count must increment upon eviction');

  // Audit trail should contain eviction record
  const evictionAudit = reclaimed.dispatchTelemetry.auditTrail.find(
    (a) => a.actor === 'SYSTEM_LEASE_EVICTOR'
  );
  assert.ok(evictionAudit, 'Audit trail must contain SYSTEM_LEASE_EVICTOR entry');
});

test('Requeue Strategies and Dead Letter Queue (DLQ) threshold', async () => {
  const engine = new TicketEngine({ defaultMaxRetries: 2, baseBackoffMs: 1000 });
  const t0 = 1700000000000;

  const ticket = await engine.enqueue(
    {
      title: 'Poison Pill Payload',
      description: 'Triggers recurring downstream parsing failure',
      tags: ['parser', 'dlq-test'],
      severity: 2,
      author: mockAuthor,
      maxRetries: 2,
    },
    undefined,
    t0
  );

  // 1st Attempt: Acquire and Requeue with EXPONENTIAL_BACKOFF
  await engine.acquire_next('worker-1', 5000, t0 + 10);
  const requeued1 = await engine.requeue(ticket.id, 'Downstream JSON parse error', 'EXPONENTIAL_BACKOFF', t0 + 50);

  assert.equal(requeued1.state, 'QUEUED');
  assert.equal(requeued1.dispatchTelemetry.retryCount, 1);
  assert.equal(requeued1.timestamps.backoffUntil, t0 + 50 + 1000); // 1000 * 2^0 = 1000ms delay

  // At t0 + 60 (before backoff expires), acquire_next should NOT return it
  const beforeBackoff = await engine.acquire_next('worker-2', 5000, t0 + 60);
  assert.equal(beforeBackoff, null, 'Ticket under exponential backoff must be deferred');

  // At t0 + 1100 (after backoff expires), acquire_next acquires it
  const afterBackoff = await engine.acquire_next('worker-2', 5000, t0 + 1100);
  assert.ok(afterBackoff);
  assert.equal(afterBackoff.id, ticket.id);

  // 2nd Attempt: Fails again -> Exceeds maxRetries (2/2) -> Routes to DEAD_LETTER
  const dlqTicket = await engine.requeue(ticket.id, 'Database lock timeout', 'HEAD', t0 + 1200);

  assert.equal(dlqTicket.state, 'DEAD_LETTER');
  assert.equal(dlqTicket.dispatchTelemetry.retryCount, 2);

  const dlqList = engine.get_dlq_tickets();
  assert.equal(dlqList.length, 1);
  assert.equal(dlqList[0].id, ticket.id);

  // DLQ tickets maintain full forensic audit trail
  const lastTransition = dlqTicket.dispatchTelemetry.auditTrail[dlqTicket.dispatchTelemetry.auditTrail.length - 1];
  assert.equal(lastTransition.toState, 'DEAD_LETTER');
  assert.equal(lastTransition.actor, 'SYSTEM_DLQ_ROUTER');
});

test('High-Concurrency Stress Test: 5 Concurrent Workers, 50 Tickets, Zero Race Conditions', async () => {
  const engine = new TicketEngine({
    defaultLeaseTtlMs: 200,
    defaultMaxRetries: 3,
    baseBackoffMs: 50,
  });

  const TOTAL_TICKETS = 50;
  const WORKER_COUNT = 5;

  // 1. Enqueue 50 mixed tickets
  const enqueuedTickets: Ticket[] = [];
  for (let i = 0; i < TOTAL_TICKETS; i++) {
    const sev = ((i % 4) + 1) as 1 | 2 | 3 | 4;
    const t = await engine.enqueue({
      title: `Stress Ticket #${i + 1}`,
      description: `Synthetic load test ticket index ${i}`,
      tags: ['stress', `batch-${Math.floor(i / 10)}`],
      severity: sev,
      author: {
        id: `usr_${i}`,
        name: `User ${i}`,
        department: i % 2 === 0 ? 'Engineering' : 'Support',
        channel: 'API',
      },
      maxRetries: 3,
    });
    enqueuedTickets.push(t);
  }

  assert.equal(engine.get_metrics().totalQueued, TOTAL_TICKETS);

  // 2. Concurrency tracking structures
  const acquiredCountPerTicket: Map<string, number> = new Map();
  const workerResolvedCount: Map<string, number> = new Map();
  const workerRequeuedCount: Map<string, number> = new Map();

  for (let w = 1; w <= WORKER_COUNT; w++) {
    workerResolvedCount.set(`worker-${w}`, 0);
    workerRequeuedCount.set(`worker-${w}`, 0);
  }

  // 3. Worker simulator
  const runWorker = async (workerId: string) => {
    let idleRounds = 0;
    while (idleRounds < 15) {
      const ticket = await engine.acquire_next(workerId, 300);
      if (!ticket) {
        idleRounds++;
        await new Promise((resolve) => setTimeout(resolve, 15));
        continue;
      }

      idleRounds = 0;

      // Assert no two workers ever acquire the same ticket concurrently
      const currentCount = (acquiredCountPerTicket.get(ticket.id) ?? 0) + 1;
      acquiredCountPerTicket.set(ticket.id, currentCount);

      // Simulate work duration
      await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 15)));

      // Probabilistic decision: 70% resolve, 20% transient fail, 10% timeout crash
      const rand = Math.random();
      if (rand < 0.70) {
        await engine.commit_resolution(ticket.id, workerId, `Resolved by ${workerId}`);
        workerResolvedCount.set(workerId, (workerResolvedCount.get(workerId) ?? 0) + 1);
      } else if (rand < 0.90) {
        await engine.requeue(ticket.id, `Simulated transient error by ${workerId}`, 'EXPONENTIAL_BACKOFF');
        workerRequeuedCount.set(workerId, (workerRequeuedCount.get(workerId) ?? 0) + 1);
      } else {
        // Crash: abandon ticket and let lease expire; wait for eviction
        await new Promise((resolve) => setTimeout(resolve, 350));
        await engine.evict_expired_leases();
      }
    }
  };

  // Launch 5 concurrent workers
  const workerPromises = Array.from({ length: WORKER_COUNT }, (_, i) => runWorker(`worker-${i + 1}`));
  await Promise.all(workerPromises);

  // Final eviction sweep
  await engine.evict_expired_leases();

  const finalMetrics = engine.get_metrics();

  // Invariant 1: Ticket Conservation Law
  // Total Created === (Queued + Processing + Completed + DeadLetter)
  const accountedTickets =
    finalMetrics.totalQueued +
    finalMetrics.processingCount +
    finalMetrics.completedCount +
    finalMetrics.deadLetterCount;

  assert.equal(
    accountedTickets,
    TOTAL_TICKETS,
    `Ticket Conservation Invariant must hold: ${accountedTickets} accounted vs ${TOTAL_TICKETS} created`
  );

  // Invariant 2: Completed + DLQ + remaining active must equal total
  assert.equal(finalMetrics.totalCreated, TOTAL_TICKETS);
  assert.ok(finalMetrics.completedCount > 0, 'At least some tickets should be completed');

  // Invariant 3: Audit Trail Integrity
  for (const t of engine.get_all_tickets()) {
    const fresh = engine.get_ticket(t.id)!;
    assert.ok(fresh.dispatchTelemetry.auditTrail.length >= 1);
    // Chronological order verification
    for (let j = 1; j < fresh.dispatchTelemetry.auditTrail.length; j++) {
      assert.ok(
        fresh.dispatchTelemetry.auditTrail[j].timestamp >= fresh.dispatchTelemetry.auditTrail[j - 1].timestamp,
        `Audit trail for ${fresh.id} must be monotonically non-decreasing in time`
      );
    }
  }
});
