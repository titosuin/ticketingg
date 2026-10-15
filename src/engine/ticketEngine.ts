/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Ticket,
  TicketState,
  Severity,
  EnqueueTicketInput,
  RequeueStrategy,
  QueueMetrics,
  AuditTransition,
} from './types.ts';
import { generateUUIDv7 } from './uuidv7.ts';
import { AsyncMutex } from './concurrency.ts';
import { IndexedPriorityQueue } from './priorityQueue.ts';

export interface EngineConfig {
  defaultLeaseTtlMs?: number;
  defaultMaxRetries?: number;
  agingRatePerMs?: number;
  slaUrgencyWeight?: number;
  baseBackoffMs?: number;
}

export class TicketEngine {
  private queue: IndexedPriorityQueue;
  private processingTickets: Map<string, Ticket> = new Map();
  private completedTickets: Map<string, Ticket> = new Map();
  private deadLetterTickets: Map<string, Ticket> = new Map();
  private allTickets: Map<string, Ticket> = new Map();

  private mutex: AsyncMutex = new AsyncMutex();
  private config: Required<EngineConfig>;

  // Running telemetry accumulators for O(1) metrics
  private totalCreatedCounter = 0;
  private totalCompletedDwellSumMs = 0;
  private totalCompletedCount = 0;
  private requeuedEventCount = 0;

  constructor(config: EngineConfig = {}) {
    this.config = {
      defaultLeaseTtlMs: config.defaultLeaseTtlMs ?? 5000, // 5 seconds default TTL
      defaultMaxRetries: config.defaultMaxRetries ?? 3,
      agingRatePerMs: config.agingRatePerMs ?? 0.05,
      slaUrgencyWeight: config.slaUrgencyWeight ?? 0.02,
      baseBackoffMs: config.baseBackoffMs ?? 2000,
    };

    this.queue = new IndexedPriorityQueue({
      agingRatePerMs: this.config.agingRatePerMs,
      slaWeight: this.config.slaUrgencyWeight,
    });
  }

  /**
   * Enqueue a new ticket into the engine.
   * Time Complexity: O(log N)
   */
  public async enqueue(
    input: EnqueueTicketInput,
    customPriority?: number,
    now: number = Date.now()
  ): Promise<Ticket> {
    return this.mutex.withLock(() => {
      const severity: Severity = input.severity ?? 2;
      const baseScores: Record<Severity, number> = {
        1: 100, // Low
        2: 250, // Medium
        3: 500, // High
        4: 1000, // Critical
      };

      const basePriorityScore = customPriority ?? input.customBaseScore ?? baseScores[severity];
      const maxRetries = input.maxRetries ?? this.config.defaultMaxRetries;
      const slaMinutes = input.slaMinutes ?? (severity === 4 ? 15 : severity === 3 ? 60 : severity === 2 ? 240 : 1440);
      const slaDeadlineMs = now + slaMinutes * 60_000;

      const ticketId = generateUUIDv7(now);

      const initialAudit: AuditTransition = {
        transitionId: generateUUIDv7(now),
        fromState: null,
        toState: 'QUEUED',
        timestamp: now,
        actor: input.author.id,
        reason: 'Ticket created and enqueued into priority queue',
        metadata: {
          channel: input.author.channel,
          severity,
          basePriorityScore,
          slaDeadlineMs,
        },
      };

      const ticket: Ticket = {
        id: ticketId,
        state: 'QUEUED',
        author: input.author,
        payload: {
          title: input.title,
          description: input.description,
          tags: input.tags,
          context: input.context,
        },
        severity,
        basePriorityScore,
        slaDeadlineMs,
        timestamps: {
          createdAt: now,
          enqueuedAt: now,
          assignedAt: null,
          resolvedAt: null,
          lastEvictionAt: null,
          leaseExpiresAt: null,
          backoffUntil: null,
        },
        dispatchTelemetry: {
          retryCount: 0,
          maxRetries,
          currentWorkerId: null,
          leaseTtlMs: this.config.defaultLeaseTtlMs,
          auditTrail: [initialAudit],
        },
      };

      this.allTickets.set(ticket.id, ticket);
      this.queue.enqueue(ticket, now);
      this.totalCreatedCounter++;

      return { ...ticket };
    });
  }

  /**
   * Peek at a window of tickets in the queue ordered by current effective priority: O(K log K)
   */
  public async peek_queue(
    limit: number = 10,
    offset: number = 0,
    now: number = Date.now()
  ): Promise<Ticket[]> {
    return this.mutex.withLock(() => {
      // First evict any expired leases
      this.internalEvictExpiredLeases(now);
      return this.queue.peekRange(limit, offset, now);
    });
  }

  /**
   * Atomic Lease Acquisition Protocol.
   * Extracts the highest priority eligible ticket and issues a time-bound lease to worker_id.
   * Guarantees race-condition freedom across concurrent worker threads.
   * Time Complexity: O(log N)
   */
  public async acquire_next(
    worker_id: string,
    lease_ttl_ms?: number,
    now: number = Date.now()
  ): Promise<Ticket | null> {
    return this.mutex.withLock(() => {
      // 1. Automatic housekeeping: evict expired worker leases back into queue
      this.internalEvictExpiredLeases(now);

      const effectiveTtl = lease_ttl_ms ?? this.config.defaultLeaseTtlMs;

      // 2. Extract next eligible candidate (handling backoff schedules)
      const ticket = this.extractEligibleTicket(now);
      if (!ticket) {
        return null;
      }

      // 3. FSM Validation: QUEUED -> PROCESSING
      if (ticket.state !== 'QUEUED') {
        throw new Error(
          `FSM Invariant Violation: Attempted to acquire ticket ${ticket.id} from invalid state '${ticket.state}'. Expected 'QUEUED'.`
        );
      }

      // 4. Atomic Lease Assignment
      ticket.state = 'PROCESSING';
      ticket.dispatchTelemetry.currentWorkerId = worker_id;
      ticket.dispatchTelemetry.leaseTtlMs = effectiveTtl;
      ticket.timestamps.assignedAt = now;
      ticket.timestamps.leaseExpiresAt = now + effectiveTtl;

      // 5. Audit Trail Transition Record
      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'QUEUED',
        toState: 'PROCESSING',
        timestamp: now,
        actor: worker_id,
        reason: `Atomic lease acquired with TTL of ${effectiveTtl}ms`,
        metadata: {
          workerId: worker_id,
          leaseExpiresAt: ticket.timestamps.leaseExpiresAt,
          leaseTtlMs: effectiveTtl,
        },
      });

      this.processingTickets.set(ticket.id, ticket);
      return { ...ticket };
    });
  }

  /**
   * Commits the definitive resolution of a ticket.
   * Transitions ticket from PROCESSING to COMPLETED.
   * Time Complexity: O(1)
   */
  public async commit_resolution(
    ticket_id: string,
    worker_id: string,
    resolution_notes: string,
    closing_metadata?: Record<string, unknown>,
    now: number = Date.now()
  ): Promise<Ticket> {
    return this.mutex.withLock(() => {
      const ticket = this.processingTickets.get(ticket_id);
      if (!ticket) {
        // Check if ticket is in completed or DLQ or was evicted
        const existing = this.allTickets.get(ticket_id);
        if (!existing) {
          throw new Error(`Ticket ${ticket_id} not found.`);
        }
        throw new Error(
          `Cannot commit resolution: Ticket ${ticket_id} is in state '${existing.state}', not 'PROCESSING'.`
        );
      }

      // Verify Worker Identity (Prevent unauthorized commit)
      if (ticket.dispatchTelemetry.currentWorkerId !== worker_id) {
        throw new Error(
          `Lease Conflict: Ticket ${ticket_id} is leased to '${ticket.dispatchTelemetry.currentWorkerId}', but worker '${worker_id}' attempted commit.`
        );
      }

      // Verify Lease Expiration
      if (ticket.timestamps.leaseExpiresAt && now > ticket.timestamps.leaseExpiresAt) {
        // Lease has expired! Reclaim and evict immediately
        this.internalEvictSingleLease(ticket, now, `Worker commit attempted after lease expiration`);
        throw new Error(
          `Lease Expired: Worker '${worker_id}' lease on ticket ${ticket_id} expired at ${ticket.timestamps.leaseExpiresAt} (now: ${now}). Ticket was evicted.`
        );
      }

      // FSM Transition: PROCESSING -> COMPLETED
      ticket.state = 'COMPLETED';
      ticket.timestamps.resolvedAt = now;
      ticket.resolutionNotes = resolution_notes;
      ticket.closingMetadata = closing_metadata;

      // Calculate dwell time metrics
      const totalLifecycleDwell = now - ticket.timestamps.createdAt;
      this.totalCompletedDwellSumMs += totalLifecycleDwell;
      this.totalCompletedCount++;

      // Audit entry
      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'PROCESSING',
        toState: 'COMPLETED',
        timestamp: now,
        actor: worker_id,
        reason: 'Ticket successfully resolved and committed',
        metadata: {
          resolutionNotes: resolution_notes,
          closingMetadata: closing_metadata,
          lifecycleDwellMs: totalLifecycleDwell,
        },
      });

      this.processingTickets.delete(ticket_id);
      this.completedTickets.set(ticket_id, ticket);

      return { ...ticket };
    });
  }

  /**
   * Requeues an in-flight ticket (e.g. worker transient failure, rejection, or backoff).
   * Transitions PROCESSING -> REQUEUED -> QUEUED (or DEAD_LETTER if retries exhausted).
   * Strategies:
   * - 'HEAD': Priority boost (LIFO burst) for immediate remedial processing.
   * - 'TAIL': Enqueued with normal priority at tail.
   * - 'EXPONENTIAL_BACKOFF': Deferred by 2^(retries-1) * baseBackoffMs.
   * Time Complexity: O(log N)
   */
  public async requeue(
    ticket_id: string,
    reason: string,
    strategy: RequeueStrategy = 'EXPONENTIAL_BACKOFF',
    now: number = Date.now()
  ): Promise<Ticket> {
    return this.mutex.withLock(() => {
      const ticket = this.processingTickets.get(ticket_id);
      if (!ticket) {
        const existing = this.allTickets.get(ticket_id);
        if (!existing) {
          throw new Error(`Ticket ${ticket_id} not found.`);
        }
        throw new Error(
          `Cannot requeue: Ticket ${ticket_id} is in state '${existing.state}', not 'PROCESSING'.`
        );
      }

      this.processingTickets.delete(ticket_id);
      this.requeuedEventCount++;

      // Increment retry counter
      ticket.dispatchTelemetry.retryCount++;
      const currentRetries = ticket.dispatchTelemetry.retryCount;
      const maxRetries = ticket.dispatchTelemetry.maxRetries;

      // Step 1: Transition to REQUEUED state
      ticket.state = 'REQUEUED';
      ticket.failureReason = reason;

      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'PROCESSING',
        toState: 'REQUEUED',
        timestamp: now,
        actor: ticket.dispatchTelemetry.currentWorkerId ?? 'SYSTEM',
        reason,
        metadata: {
          retryCount: currentRetries,
          maxRetries,
          strategy,
        },
      });

      // Clear current worker lock
      ticket.dispatchTelemetry.currentWorkerId = null;
      ticket.timestamps.leaseExpiresAt = null;

      // Step 2: Evaluate Dead Letter Queue condition
      if (currentRetries >= maxRetries) {
        // Exceeded max retries -> Isolate to DEAD_LETTER
        ticket.state = 'DEAD_LETTER';
        ticket.dispatchTelemetry.auditTrail.push({
          transitionId: generateUUIDv7(now),
          fromState: 'REQUEUED',
          toState: 'DEAD_LETTER',
          timestamp: now,
          actor: 'SYSTEM_DLQ_ROUTER',
          reason: `Exceeded maximum retry limit (${currentRetries}/${maxRetries}). Isolated for forensic audit.`,
          metadata: {
            fatalReason: reason,
            totalRetries: currentRetries,
          },
        });

        this.deadLetterTickets.set(ticket.id, ticket);
        return { ...ticket };
      }

      // Step 3: Re-enter QUEUED with chosen strategy
      ticket.state = 'QUEUED';
      ticket.timestamps.enqueuedAt = now;

      if (strategy === 'HEAD') {
        // High priority boost to jump to head of queue
        ticket.basePriorityScore += 2000;
        ticket.timestamps.backoffUntil = null;
      } else if (strategy === 'TAIL') {
        // Standard placement without boost
        ticket.timestamps.backoffUntil = null;
      } else if (strategy === 'EXPONENTIAL_BACKOFF') {
        // Delay release: baseBackoff * 2^(retryCount - 1)
        const delayMs = this.config.baseBackoffMs * Math.pow(2, currentRetries - 1);
        ticket.timestamps.backoffUntil = now + delayMs;
      }

      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'REQUEUED',
        toState: 'QUEUED',
        timestamp: now,
        actor: 'SYSTEM_DISPATCH',
        reason: `Re-enqueued with strategy: ${strategy}`,
        metadata: {
          strategy,
          backoffUntil: ticket.timestamps.backoffUntil,
          newBasePriority: ticket.basePriorityScore,
        },
      });

      this.queue.enqueue(ticket, now);
      return { ...ticket };
    });
  }

  /**
   * Heartbeat to extend active worker lease TTL: O(1)
   */
  public async heartbeat_lease(
    ticket_id: string,
    worker_id: string,
    extension_ms?: number,
    now: number = Date.now()
  ): Promise<Ticket> {
    return this.mutex.withLock(() => {
      const ticket = this.processingTickets.get(ticket_id);
      if (!ticket) {
        throw new Error(`Ticket ${ticket_id} is not currently in PROCESSING.`);
      }

      if (ticket.dispatchTelemetry.currentWorkerId !== worker_id) {
        throw new Error(`Worker '${worker_id}' does not own active lease for ${ticket_id}.`);
      }

      const ext = extension_ms ?? this.config.defaultLeaseTtlMs;
      ticket.timestamps.leaseExpiresAt = now + ext;

      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'PROCESSING',
        toState: 'PROCESSING',
        timestamp: now,
        actor: worker_id,
        reason: `Lease extended by ${ext}ms (Heartbeat)`,
        metadata: { newExpiresAt: ticket.timestamps.leaseExpiresAt },
      });

      return { ...ticket };
    });
  }

  /**
   * Periodic or on-demand eviction of expired worker leases.
   */
  public async evict_expired_leases(now: number = Date.now()): Promise<number> {
    return this.mutex.withLock(() => {
      return this.internalEvictExpiredLeases(now);
    });
  }

  /**
   * Replay a ticket from the Dead Letter Queue back into active circulation.
   */
  public async replay_dlq_ticket(
    ticket_id: string,
    reset_retries: boolean = true,
    now: number = Date.now()
  ): Promise<Ticket> {
    return this.mutex.withLock(() => {
      const ticket = this.deadLetterTickets.get(ticket_id);
      if (!ticket) {
        throw new Error(`Ticket ${ticket_id} not found in Dead Letter Queue.`);
      }

      this.deadLetterTickets.delete(ticket_id);

      if (reset_retries) {
        ticket.dispatchTelemetry.retryCount = 0;
      }

      ticket.state = 'QUEUED';
      ticket.timestamps.enqueuedAt = now;
      ticket.timestamps.backoffUntil = null;

      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'DEAD_LETTER',
        toState: 'QUEUED',
        timestamp: now,
        actor: 'ADMIN_REPLAY',
        reason: 'Forensic operator replayed ticket back into active dispatch queue',
        metadata: { resetRetries: reset_retries },
      });

      this.queue.enqueue(ticket, now);
      return { ...ticket };
    });
  }

  /**
   * Retrieves high-frequency O(1) telemetry and metrics snapshot.
   */
  public get_metrics(now: number = Date.now()): QueueMetrics {
    const totalQueued = this.queue.size();
    const severityCounts = this.queue.getSeverityCounts();
    const { totalDwellMs, oldestDwellMs } = this.queue.getTotalCurrentDwellMs(now);

    const avgDwell = totalQueued > 0 ? Math.round(totalDwellMs / totalQueued) : 0;

    // Active leases list with countdown
    const activeLeases = Array.from(this.processingTickets.values()).map((t) => ({
      ticketId: t.id,
      workerId: t.dispatchTelemetry.currentWorkerId ?? 'UNKNOWN',
      remainingMs: Math.max(0, (t.timestamps.leaseExpiresAt ?? now) - now),
      expiresAt: t.timestamps.leaseExpiresAt ?? now,
      severity: t.severity,
    }));

    // Count tickets nearing or breached SLA
    let slaBreachRiskCount = 0;
    for (const t of this.queue.getAll()) {
      if (t.slaDeadlineMs - now < 300_000) {
        // Less than 5 minutes to breach or already breached
        slaBreachRiskCount++;
      }
    }

    return {
      totalQueued,
      processingCount: this.processingTickets.size,
      completedCount: this.completedTickets.size,
      requeuedCount: this.requeuedEventCount,
      deadLetterCount: this.deadLetterTickets.size,
      totalCreated: this.totalCreatedCounter,
      countBySeverity: severityCounts,
      avgDwellTimeMs: avgDwell,
      totalCompletedDwellSumMs: this.totalCompletedDwellSumMs,
      oldestQueuedDwellMs: oldestDwellMs,
      slaBreachRiskCount,
      activeLeases,
    };
  }

  public get_ticket(id: string): Ticket | null {
    const t = this.allTickets.get(id);
    return t ? { ...t } : null;
  }

  public get_all_tickets(): Ticket[] {
    return Array.from(this.allTickets.values()).map((t) => ({ ...t }));
  }

  public get_dlq_tickets(): Ticket[] {
    return Array.from(this.deadLetterTickets.values()).map((t) => ({ ...t }));
  }

  public get_completed_tickets(): Ticket[] {
    return Array.from(this.completedTickets.values()).map((t) => ({ ...t }));
  }

  public get_processing_tickets(): Ticket[] {
    return Array.from(this.processingTickets.values()).map((t) => ({ ...t }));
  }

  // --- Internal Helper Methods ---

  private extractEligibleTicket(now: number): Ticket | null {
    const deferredList: Ticket[] = [];
    let chosen: Ticket | null = null;

    while (!this.queue.isEmpty()) {
      const top = this.queue.extractMax(now);
      if (!top) break;

      // Check if ticket is still under exponential backoff delay
      if (top.timestamps.backoffUntil && top.timestamps.backoffUntil > now) {
        deferredList.push(top);
      } else {
        chosen = top;
        break;
      }
    }

    // Re-insert deferred tickets back into queue
    for (const deferred of deferredList) {
      this.queue.enqueue(deferred, now);
    }

    return chosen;
  }

  private internalEvictExpiredLeases(now: number): number {
    let evictedCount = 0;
    for (const ticket of this.processingTickets.values()) {
      if (ticket.timestamps.leaseExpiresAt && now > ticket.timestamps.leaseExpiresAt) {
        this.internalEvictSingleLease(
          ticket,
          now,
          `Lease TTL of ${ticket.dispatchTelemetry.leaseTtlMs}ms expired without worker heartbeat`
        );
        evictedCount++;
      }
    }
    return evictedCount;
  }

  private internalEvictSingleLease(ticket: Ticket, now: number, reason: string): void {
    const workerId = ticket.dispatchTelemetry.currentWorkerId;
    this.processingTickets.delete(ticket.id);

    ticket.timestamps.lastEvictionAt = now;
    ticket.dispatchTelemetry.retryCount++;
    const retries = ticket.dispatchTelemetry.retryCount;
    const maxRetries = ticket.dispatchTelemetry.maxRetries;

    ticket.dispatchTelemetry.auditTrail.push({
      transitionId: generateUUIDv7(now),
      fromState: 'PROCESSING',
      toState: 'REQUEUED',
      timestamp: now,
      actor: 'SYSTEM_LEASE_EVICTOR',
      reason,
      metadata: {
        abandonedByWorker: workerId,
        retryCount: retries,
        maxRetries,
      },
    });

    ticket.dispatchTelemetry.currentWorkerId = null;
    ticket.timestamps.leaseExpiresAt = null;

    if (retries >= maxRetries) {
      ticket.state = 'DEAD_LETTER';
      ticket.dispatchTelemetry.auditTrail.push({
        transitionId: generateUUIDv7(now),
        fromState: 'REQUEUED',
        toState: 'DEAD_LETTER',
        timestamp: now,
        actor: 'SYSTEM_DLQ_ROUTER',
        reason: `Exceeded max retries after lease eviction (${retries}/${maxRetries})`,
      });
      this.deadLetterTickets.set(ticket.id, ticket);
    } else {
      ticket.state = 'QUEUED';
      ticket.timestamps.enqueuedAt = now;
      // Head boost to prioritize recovery
      ticket.basePriorityScore += 500;
      this.queue.enqueue(ticket, now);
    }
  }
}
