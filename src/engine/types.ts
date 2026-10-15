/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TicketState = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'REQUEUED' | 'DEAD_LETTER';

export const SeverityLevel = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export type Severity = 1 | 2 | 3 | 4; // 1: Low, 2: Medium, 3: High, 4: Critical

export type IngestChannel = 'API' | 'WEBHOOK' | 'PORTAL' | 'SLACK' | 'EMAIL' | 'MONITORING';

export type RequeueStrategy = 'HEAD' | 'TAIL' | 'EXPONENTIAL_BACKOFF';

export interface AuditTransition {
  transitionId: string;
  fromState: TicketState | null;
  toState: TicketState;
  timestamp: number;
  actor: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface TicketAuthor {
  id: string;
  name: string;
  department: string;
  channel: IngestChannel;
}

export interface TicketPayload {
  title: string;
  description: string;
  tags: string[];
  context?: Record<string, unknown>;
}

export interface TicketTimestamps {
  createdAt: number;
  enqueuedAt: number;
  assignedAt: number | null;
  resolvedAt: number | null;
  lastEvictionAt: number | null;
  leaseExpiresAt: number | null;
  backoffUntil: number | null;
}

export interface DispatchTelemetry {
  retryCount: number;
  maxRetries: number;
  currentWorkerId: string | null;
  leaseTtlMs: number;
  auditTrail: AuditTransition[];
}

export interface Ticket {
  readonly id: string; // Canonical UUIDv7
  state: TicketState;
  author: TicketAuthor;
  payload: TicketPayload;
  severity: Severity;
  basePriorityScore: number;
  slaDeadlineMs: number; // Absolute timestamp target
  timestamps: TicketTimestamps;
  dispatchTelemetry: DispatchTelemetry;
  resolutionNotes?: string;
  closingMetadata?: Record<string, unknown>;
  failureReason?: string;
  lastDynamicScore?: number;
}

export interface QueueMetrics {
  totalQueued: number;
  processingCount: number;
  completedCount: number;
  requeuedCount: number;
  deadLetterCount: number;
  totalCreated: number;
  countBySeverity: Record<Severity, number>;
  avgDwellTimeMs: number;
  totalCompletedDwellSumMs: number;
  oldestQueuedDwellMs: number;
  slaBreachRiskCount: number;
  activeLeases: {
    ticketId: string;
    workerId: string;
    remainingMs: number;
    expiresAt: number;
    severity: Severity;
  }[];
}

export interface EnqueueTicketInput {
  title: string;
  description: string;
  tags: string[];
  severity?: Severity;
  author: TicketAuthor;
  maxRetries?: number;
  slaMinutes?: number;
  context?: Record<string, unknown>;
  customBaseScore?: number;
}
