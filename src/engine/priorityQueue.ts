/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Ticket, Severity } from './types.ts';

export interface PriorityCalculatorOptions {
  agingRatePerMs?: number; // Rate at which queued tickets gain priority per ms (Starvation Prevention)
  slaWeight?: number; // Multiplier for SLA urgency countdown
}

/**
 * Calculates the dynamic effective score of a ticket at a given point in time.
 * Implements Starvation Prevention via monotonic aging + SLA deadline proximity boost.
 *
 * Formula:
 * Score(t) = BaseScore + (t - EnqueuedAt) * AgingRate + SLA_Urgency_Factor
 */
export function calculateDynamicScore(
  ticket: Ticket,
  now: number = Date.now(),
  options: PriorityCalculatorOptions = {}
): number {
  const agingRate = options.agingRatePerMs ?? 0.05; // 50 score points per second
  const slaWeight = options.slaWeight ?? 0.02;

  // 1. Monotonic aging component (prevents low-priority starvation)
  const dwellTimeMs = Math.max(0, now - ticket.timestamps.enqueuedAt);
  const agingBoost = dwellTimeMs * agingRate;

  // 2. SLA countdown urgency factor
  const timeToSlaMs = ticket.slaDeadlineMs - now;
  let slaBoost = 0;
  if (timeToSlaMs <= 0) {
    // SLA Breached: immediate maximum escalation boost
    slaBoost = 5000 + Math.abs(timeToSlaMs) * slaWeight;
  } else if (timeToSlaMs < 60_000) {
    // Under 1 minute to breach
    slaBoost = (60_000 - timeToSlaMs) * slaWeight * 2;
  }

  // 3. Penalty if under backoff delay
  const isBackoff = ticket.timestamps.backoffUntil && ticket.timestamps.backoffUntil > now;
  const backoffPenalty = isBackoff ? 1_000_000 : 0;

  const totalScore = ticket.basePriorityScore + agingBoost + slaBoost - backoffPenalty;
  return totalScore;
}

/**
 * Indexed Binary Max-Heap Priority Queue.
 *
 * Algorithmic Bounds:
 * - Enqueue: O(log N)
 * - ExtractMax: O(log N)
 * - PeekMax: O(1)
 * - RemoveById: O(log N) (via internal index map)
 * - Size, Severity Breakdown, Dwell-Sum: O(1)
 */
export class IndexedPriorityQueue {
  private heap: Ticket[] = [];
  private idToIndex: Map<string, number> = new Map();
  private severityCounts: Record<Severity, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  private options: PriorityCalculatorOptions;

  constructor(options: PriorityCalculatorOptions = {}) {
    this.options = options;
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public getSeverityCounts(): Record<Severity, number> {
    return { ...this.severityCounts };
  }

  public contains(id: string): boolean {
    return this.idToIndex.has(id);
  }

  /**
   * Enqueue a ticket into the binary heap: O(log N)
   */
  public enqueue(ticket: Ticket, now: number = Date.now()): void {
    if (this.idToIndex.has(ticket.id)) {
      this.update(ticket, now);
      return;
    }

    ticket.lastDynamicScore = calculateDynamicScore(ticket, now, this.options);
    const index = this.heap.length;
    this.heap.push(ticket);
    this.idToIndex.set(ticket.id, index);
    this.severityCounts[ticket.severity]++;

    this.siftUp(index, now);
  }

  /**
   * Peek at the highest priority ticket without removing: O(1)
   */
  public peek(now: number = Date.now()): Ticket | null {
    if (this.heap.length === 0) return null;
    this.recalculateTopIfNeeded(now);
    return this.heap[0] ?? null;
  }

  /**
   * Extracts and returns the highest priority ticket: O(log N)
   */
  public extractMax(now: number = Date.now()): Ticket | null {
    if (this.heap.length === 0) return null;

    // Refresh scores for top elements to respect aging dynamics
    this.recalculateTopIfNeeded(now);

    const maxTicket = this.heap[0];
    this.swap(0, this.heap.length - 1);
    this.heap.pop();
    this.idToIndex.delete(maxTicket.id);
    this.severityCounts[maxTicket.severity]--;

    if (this.heap.length > 0) {
      this.siftDown(0, now);
    }

    return maxTicket;
  }

  /**
   * Removes a specific ticket by ID: O(log N)
   */
  public remove(id: string, now: number = Date.now()): Ticket | null {
    const index = this.idToIndex.get(id);
    if (index === undefined) return null;

    const removedTicket = this.heap[index];
    const lastIndex = this.heap.length - 1;

    if (index === lastIndex) {
      this.heap.pop();
      this.idToIndex.delete(id);
      this.severityCounts[removedTicket.severity]--;
      return removedTicket;
    }

    this.swap(index, lastIndex);
    this.heap.pop();
    this.idToIndex.delete(id);
    this.severityCounts[removedTicket.severity]--;

    // Rebalance from the replaced position
    this.siftDown(index, now);
    this.siftUp(index, now);

    return removedTicket;
  }

  /**
   * Updates an existing ticket's priority score and rebalances: O(log N)
   */
  public update(ticket: Ticket, now: number = Date.now()): void {
    const index = this.idToIndex.get(ticket.id);
    if (index === undefined) {
      this.enqueue(ticket, now);
      return;
    }

    this.heap[index] = ticket;
    ticket.lastDynamicScore = calculateDynamicScore(ticket, now, this.options);
    this.siftDown(index, now);
    this.siftUp(index, now);
  }

  /**
   * Peek a window of tickets ordered by current dynamic priority without modifying the heap: O(K log K)
   */
  public peekRange(limit: number, offset: number = 0, now: number = Date.now()): Ticket[] {
    const scoredList = this.heap.map((t) => {
      const score = calculateDynamicScore(t, now, this.options);
      t.lastDynamicScore = score;
      return { ticket: t, score };
    });

    // Sort descending by dynamic score
    scoredList.sort((a, b) => b.score - a.score);

    return scoredList.slice(offset, offset + limit).map((item) => item.ticket);
  }

  /**
   * Rebalances and updates scores across the entire heap: O(N)
   */
  public refreshScores(now: number = Date.now()): void {
    for (let i = 0; i < this.heap.length; i++) {
      this.heap[i].lastDynamicScore = calculateDynamicScore(this.heap[i], now, this.options);
    }
    // Heapify bottom-up O(N)
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.siftDown(i, now);
    }
  }

  /**
   * Returns total cumulative dwell time of currently queued tickets
   */
  public getTotalCurrentDwellMs(now: number = Date.now()): { totalDwellMs: number; oldestDwellMs: number } {
    let totalDwellMs = 0;
    let oldestDwellMs = 0;
    for (const t of this.heap) {
      const dwell = Math.max(0, now - t.timestamps.enqueuedAt);
      totalDwellMs += dwell;
      if (dwell > oldestDwellMs) {
        oldestDwellMs = dwell;
      }
    }
    return { totalDwellMs, oldestDwellMs };
  }

  public getAll(): Ticket[] {
    return [...this.heap];
  }

  // --- Internal Heap Mechanics ---

  private recalculateTopIfNeeded(now: number): void {
    if (this.heap.length <= 1) return;
    // Check if dynamic aging or backoff has altered relative order between root and children
    this.refreshScores(now);
  }

  private siftUp(index: number, now: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const currentScore = this.getScore(this.heap[current], now);
      const parentScore = this.getScore(this.heap[parent], now);

      if (currentScore > parentScore) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number, now: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      let largest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      if (left < length && this.getScore(this.heap[left], now) > this.getScore(this.heap[largest], now)) {
        largest = left;
      }

      if (right < length && this.getScore(this.heap[right], now) > this.getScore(this.heap[largest], now)) {
        largest = right;
      }

      if (largest !== current) {
        this.swap(current, largest);
        current = largest;
      } else {
        break;
      }
    }
  }

  private getScore(ticket: Ticket, now: number): number {
    return calculateDynamicScore(ticket, now, this.options);
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
    this.idToIndex.set(this.heap[i].id, i);
    this.idToIndex.set(this.heap[j].id, j);
  }
}
