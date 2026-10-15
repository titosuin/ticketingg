/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Asynchronous FIFO Mutex lock for atomic execution of critical sections.
 * Guarantees serial execution without race conditions across multiple
 * asynchronous workers competing for the queue.
 */
export class AsyncMutex {
  private queue: (() => void)[] = [];
  private locked = false;

  public async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release());
      });
    });
  }

  public release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Executes a callback within the protected atomic lock scope.
   */
  public async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    const unlock = await this.acquire();
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  public isLocked(): boolean {
    return this.locked;
  }

  public waitingCount(): number {
    return this.queue.length;
  }
}
