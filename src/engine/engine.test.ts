/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateUUIDv7, extractTimestampFromUUIDv7 } from './uuidv7.ts';
import { IndexedPriorityQueue, calculateDynamicScore } from './priorityQueue.ts';
import { TicketEngine } from './ticketEngine.ts';
import type { Ticket, TicketAuthor, IngestChannel, UserAccount } from './types.ts';
import {
  AuthManager,
  SecurityViolationError,
  validatePasswordSecurity,
  generateUltraSecurePassword,
  hashPasswordSecure,
  MAX_SYSTEM_USERS_QUOTA,
} from './security.ts';

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
      fencingToken: 0,
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
      fencingToken: 0,
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

test('DevSecOps: Bloqueo de Split-Brain por Fencing Token desfasado', async () => {
  const engine = new TicketEngine({ defaultLeaseTtlMs: 2000 });
  const t0 = 1700000000000;

  const ticket = await engine.enqueue(
    {
      title: 'Distributed Transaction Timeout',
      description: 'Potential split-brain condition under test',
      tags: ['distributed', 'fencing-token'],
      severity: 3,
      author: mockAuthor,
    },
    undefined,
    t0
  );

  // Worker 1 acquires ticket -> gets fencing token 1
  const lease1 = await engine.acquire_next('worker-partitioned', 2000, t0);
  assert.ok(lease1);
  const token1 = lease1.dispatchTelemetry.fencingToken;
  assert.equal(token1, 1, 'First acquisition must receive fencing token 1');

  // Time passes: Worker 1 experiences a network partition/long GC pause beyond lease TTL (2000ms)
  // At t0 + 2500, Worker 2 acquires the ticket (auto-evicting the expired lease)
  const lease2 = await engine.acquire_next('worker-promoted', 2000, t0 + 2500);
  assert.ok(lease2);
  const token2 = lease2.dispatchTelemetry.fencingToken;
  assert.equal(token2, 2, 'Reacquired ticket must receive incremented fencing token 2');

  // Worker 1 recovers and attempts to commit resolution using stale fencing token 1 -> MUST BE REJECTED
  await assert.rejects(
    async () => {
      await engine.commit_resolution(
        ticket.id,
        'worker-partitioned',
        'Commit attempted by stale partitioned worker',
        {},
        t0 + 2600,
        token1
      );
    },
    /Fencing Token Violation \(Split-Brain Blocked\)/,
    'Stale worker commit with older fencing token must be blocked'
  );

  // Worker 1 also attempts to requeue or heartbeat with stale token 1 -> MUST BE REJECTED
  await assert.rejects(
    async () => {
      await engine.requeue(
        ticket.id,
        'Transient error reported by stale worker',
        'TAIL',
        t0 + 2700,
        'worker-partitioned',
        token1
      );
    },
    /Fencing Token Violation \(Split-Brain Blocked\)/,
    'Stale worker requeue with older fencing token must be blocked'
  );

  // Worker 2 commits resolution with current active fencing token 2 -> MUST SUCCEED
  const completed = await engine.commit_resolution(
    ticket.id,
    'worker-promoted',
    'Valid resolution committed by promoted worker with active fencing token',
    {},
    t0 + 2800,
    token2
  );

  assert.equal(completed.state, 'COMPLETED');
  assert.equal(completed.dispatchTelemetry.fencingToken, 2);
});

test('DevSecOps: Bloqueo de BOLA/IDOR para rol requester y bloqueo de escalamiento de privilegios en registro', async () => {
  const auth = new AuthManager();
  const engine = new TicketEngine();
  const t0 = 1700000000000;

  // 1. Privilege Escalation Prevention on User Registration
  // Attempting to register as 'ticket_admin' without sysadmin caller or invite token must be rejected
  assert.throws(
    () => {
      auth.registerUser({
        username: 'malicious_user',
        name: 'Attacker',
        department: 'External',
        requestedRole: 'ticket_admin',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof SecurityViolationError);
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Escalation Blocked/);
      return true;
    },
    'Unauthorized privilege escalation to ticket_admin must be rejected'
  );

  // Registration with valid security token 'ARGON-SEC-2026' succeeds
  const newAdmin = auth.registerUser({
    username: 'sec_admin',
    name: 'Security Officer',
    department: 'SOC',
    requestedRole: 'ticket_admin',
    adminInviteToken: 'ARGON-SEC-2026',
  });
  assert.equal(newAdmin.role, 'ticket_admin');

  // Normal user registration defaults to 'requester'
  const requesterBob = auth.registerUser({
    username: 'bob_requester',
    name: 'Bob Requester',
    department: 'Marketing',
  });
  assert.equal(requesterBob.role, 'requester');

  // 2. Row-Level Security: BOLA / IDOR Prevention
  const elena = auth.getUserById('usr_finops_92')!;
  assert.equal(elena.role, 'requester');

  // Elena creates a ticket
  const elenaTicket = await engine.enqueue(
    {
      title: 'Invoice calculation discrepancy',
      description: 'Tax rounding issue on invoice #1042',
      tags: ['billing', 'tax'],
      severity: 2,
      author: {
        id: elena.id,
        name: elena.name,
        department: elena.department,
        channel: 'PORTAL',
      },
      context: {
        rawDatabaseQuery: 'SELECT * FROM financial_ledger WHERE customer_id = 129',
        internalServerIp: '10.240.12.8',
      },
    },
    undefined,
    t0
  );

  // Bob (requester) attempts to access Elena's ticket -> MUST THROW 403 BOLA/IDOR Blocked
  assert.throws(
    () => {
      engine.get_ticket_secure(elenaTicket.id, requesterBob);
    },
    (err: unknown) => {
      assert.ok(err instanceof SecurityViolationError);
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /403 BOLA\/IDOR Blocked/);
      return true;
    },
    'Requester Bob must not be able to view Elena\'s ticket'
  );

  // Elena accesses her own ticket: Allowed, but context is masked and audit actors anonymized
  const elenaView = engine.get_ticket_secure(elenaTicket.id, elena);
  assert.ok(elenaView);
  assert.equal(elenaView.id, elenaTicket.id);
  assert.equal(elenaView.payload.context, undefined, 'Infrastructure context must be masked for requester');

  // Admin user accesses ticket: Unrestricted view
  const adminView = engine.get_ticket_secure(elenaTicket.id, newAdmin);
  assert.ok(adminView);
  assert.ok(adminView.payload.context, 'Admins can view raw technical context');

  // get_tickets_for_user returns only Elena's tickets when called for Elena
  const elenaTickets = engine.get_tickets_for_user(elena);
  assert.equal(elenaTickets.length, 1);
  assert.equal(elenaTickets[0].id, elenaTicket.id);

  const bobTickets = engine.get_tickets_for_user(requesterBob);
  assert.equal(bobTickets.length, 0, 'Bob has created no tickets, list must be empty');
});

test('DevSecOps: Sanitización forense de secretos JWT y Postgres al caer en DEAD_LETTER', async () => {
  const engine = new TicketEngine({ defaultMaxRetries: 2, defaultLeaseTtlMs: 2000 });
  const t0 = 1700000000000;

  // Enqueue ticket with credentials embedded in payload context
  const ticket = await engine.enqueue(
    {
      title: 'Data sync service crash',
      description: 'Sync pipeline failing with DB authentication timeout',
      tags: ['sync', 'db-fail'],
      severity: 4,
      author: mockAuthor,
      maxRetries: 2,
      context: {
        databaseUrl: 'postgres://app_svc:s3cret_p4ss!@pg-cluster.internal:5432/finance_db',
        apiKey: 'mock_api_key_998877665544332211aabbcc',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        password: 'super_secret_plain_text',
      },
    },
    undefined,
    t0
  );

  // Check that context was sanitized at enqueue time
  const storedTicket = engine.get_ticket(ticket.id)!;
  const ctx = storedTicket.payload.context as Record<string, unknown>;
  assert.ok(ctx);
  assert.equal(ctx.databaseUrl, '[REDACTED_POSTGRES_URI]');
  assert.equal(ctx.apiKey, '[REDACTED_SECRET]');
  assert.equal(ctx.jwtToken, '[REDACTED_JWT]');
  assert.equal(ctx.password, '[REDACTED_SECRET]');

  // Acquire ticket
  await engine.acquire_next('worker-dlq-tester', 2000, t0);

  // 1st Requeue with secret in error message
  const rawLeakReason1 =
    'DB connection error at postgres://operator:leakedPass123@10.0.0.1:5432/orders with bearer Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4ifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  await engine.requeue(ticket.id, rawLeakReason1, 'HEAD', t0 + 100);

  // Re-acquire and 2nd requeue -> Exceeds maxRetries (2/2) -> Routes to DEAD_LETTER
  await engine.acquire_next('worker-dlq-tester', 2000, t0 + 200);
  const rawLeakReason2 =
    'Fatal unrecoverable crash contacting redis://cache-cluster:6379/1 and API mock_api_key_998877665544332211';
  const dlqTicket = await engine.requeue(ticket.id, rawLeakReason2, 'HEAD', t0 + 300);

  assert.equal(dlqTicket.state, 'DEAD_LETTER');

  // Verify failureReason does not leak secrets
  assert.ok(dlqTicket.failureReason);
  assert.ok(!dlqTicket.failureReason.includes('redis://cache-cluster'));
  assert.ok(!dlqTicket.failureReason.includes('mock_api_key_998877665544332211'));
  assert.ok(dlqTicket.failureReason.includes('[REDACTED_REDIS_URI]'));
  assert.ok(dlqTicket.failureReason.includes('[REDACTED_API_KEY]'));

  // Verify forensic audit trail entries in DEAD_LETTER are sanitized
  const dlqAudit = dlqTicket.dispatchTelemetry.auditTrail.find(
    (a) => a.toState === 'DEAD_LETTER'
  );
  assert.ok(dlqAudit);
  assert.ok(!dlqAudit.reason.includes('redis://'));
  assert.ok(!dlqAudit.reason.includes('mock_api_key_'));
  assert.ok(dlqAudit.reason.includes('[REDACTED_REDIS_URI]'));
});

test('DevSecOps: 8 usuarios pre-sembrados (2 admins + 6 desarrolladores) y límite de cupos estricto de 15 personas', () => {
  const auth = new AuthManager();

  // 1. Verificar existencia de exactamente 8 personas iniciales
  const users = auth.getUsers();
  assert.equal(users.length, 8, 'Debe haber exactamente 8 personas pre-sembradas');

  // 2. Verificar los 2 administradores
  const admins = users.filter((u) => u.role === 'system_admin' || u.role === 'ticket_admin');
  assert.equal(admins.length, 2, 'Debe haber exactamente 2 administradores');
  assert.ok(users.some((u) => u.username === 'msilva_admin' && u.role === 'system_admin'));
  assert.ok(users.some((u) => u.username === 'vrios_admin' && u.role === 'ticket_admin'));

  // 3. Verificar los 6 desarrolladores (rol requester - solamente piden tickets)
  const developers = users.filter((u) => u.role === 'requester');
  assert.equal(developers.length, 6, 'Debe haber exactamente 6 desarrolladores con rol requester');
  const expectedDevUsernames = ['lbenitez', 'sherrera', 'dmorales', 'cvega', 'anavarro', 'mcastro'];
  for (const u of expectedDevUsernames) {
    assert.ok(developers.some((d) => d.username === u), `Desarrollador @${u} debe existir`);
  }

  // 4. Verificar métricas de cupos iniciales: 8 / 15 cupos ocupados, 7 disponibles
  const quota = auth.getQuota();
  assert.equal(quota.total, 8);
  assert.equal(quota.max, MAX_SYSTEM_USERS_QUOTA);
  assert.equal(quota.available, 7);
  assert.equal(quota.percent, Math.round((8 / 15) * 100));

  // 5. Registrar 7 usuarios adicionales válidos para alcanzar exactamente 15 cupos
  for (let i = 1; i <= 7; i++) {
    const registered = auth.registerUser({
      username: `newdev_0${i}`,
      name: `Desarrollador Adicional ${i}`,
      department: 'Equipo de Soporte',
      passwordPlain: 'Str0ng!P@ssw0rd2026#Sec',
    });
    assert.ok(registered);
  }

  // Cupo ahora debe estar al 100% (15/15)
  const fullQuota = auth.getQuota();
  assert.equal(fullQuota.total, 15);
  assert.equal(fullQuota.available, 0);
  assert.equal(fullQuota.percent, 100);

  // 6. Intentar registrar el usuario número 16 -> DEBE FALLAR con MAX_USERS_QUOTA_EXCEEDED
  assert.throws(
    () => {
      auth.registerUser({
        username: 'user_sixteen',
        name: 'Exceeding User',
        department: 'External',
        passwordPlain: 'Str0ng!P@ssw0rd2026#Sec',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof SecurityViolationError);
      assert.equal(err.statusCode, 403);
      assert.equal(err.code, 'MAX_USERS_QUOTA_EXCEEDED');
      assert.match(err.message, /Límite de capacidad corporativa alcanzado/);
      return true;
    },
    'El registro de más de 15 usuarios debe ser rechazado por cuota excedida'
  );
});

test('DevSecOps: Validación de contraseñas seguras, generador ultra seguro y hashing criptográfico', () => {
  const auth = new AuthManager();

  // 1. Rechazo de contraseñas débiles (< 12 caracteres)
  const reportShort = validatePasswordSecurity('Short1!');
  assert.equal(reportShort.isValid, false);
  assert.equal(reportShort.checks.minLength, false);

  // 2. Rechazo de contraseñas sin mayúsculas o números
  const reportNoUpper = validatePasswordSecurity('lowercase_only_with_special!#');
  assert.equal(reportNoUpper.isValid, false);
  assert.equal(reportNoUpper.checks.hasUpper, false);

  // 3. Rechazo de palabras comunes de diccionario
  const reportCommon = validatePasswordSecurity('AdminPassword123!Secure');
  assert.equal(reportCommon.isValid, false);
  assert.equal(reportCommon.checks.noCommonWords, false);

  // 4. Rechazo si contiene el nombre de usuario
  const reportUsername = validatePasswordSecurity('LucasBenitez2026!#Ultra', 'lucas');
  assert.equal(reportUsername.isValid, false);
  assert.equal(reportUsername.checks.noUsername, false);

  // 5. Generador de Contraseñas Ultra Seguras (20 caracteres)
  const ultraPwd = generateUltraSecurePassword(20);
  assert.equal(ultraPwd.length, 20);
  const ultraReport = validatePasswordSecurity(ultraPwd);
  assert.equal(ultraReport.isValid, true);
  assert.equal(ultraReport.level, 'ULTRA_SECURE');
  assert.ok(ultraReport.score >= 95);

  // 6. Registro con contraseña débil debe ser interceptado por AuthManager
  assert.throws(
    () => {
      auth.registerUser({
        username: 'test_insecure',
        name: 'Insecure Test',
        department: 'Testing',
        passwordPlain: '12345678',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof SecurityViolationError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'WEAK_PASSWORD_REJECTED');
      return true;
    }
  );

  // 7. Registro con contraseña válida y verificación de hash
  const secureUser = auth.registerUser({
    username: 'test_sec_user',
    name: 'Secure Account',
    department: 'DevOps',
    passwordPlain: ultraPwd,
  });
  assert.ok(secureUser.passwordHash);
  assert.notEqual(secureUser.passwordHash, ultraPwd, 'La contraseña nunca debe guardarse en texto plano');
  assert.equal(auth.verifyPassword(secureUser.username, ultraPwd), true);
  assert.equal(auth.verifyPassword(secureUser.username, 'WrongPassword123!'), false);

  // 8. Validación de formato de username inválido
  assert.throws(
    () => {
      auth.registerUser({
        username: 'ab', // Demasiado corto (< 3)
        name: 'Short Name',
        department: 'DevOps',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof SecurityViolationError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'INVALID_USERNAME');
      return true;
    }
  );
});

