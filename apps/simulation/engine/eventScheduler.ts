// Central Event Scheduler & Simulation Clock
// Strictly isolated to apps/web/src/simulation/engine/

export interface ScheduledTask {
  id: string;
  executeAtSec: number;
  description: string;
  run: () => Promise<void> | void;
}

export type ClockTickListener = (simTimeSec: number, realElapsedMs: number) => void;

export class EventScheduler {
  private simTimeSec = 0;
  private speed = 1;
  private isRunning = false;
  private timerId: number | null = null;
  private queue: ScheduledTask[] = [];
  private listeners: Set<ClockTickListener> = new Set();
  private lastTickRealTime = 0;

  constructor(initialSpeed = 1) {
    this.speed = initialSpeed;
  }

  public subscribeTick(listener: ClockTickListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public schedule(delaySec: number, description: string, task: () => Promise<void> | void): string {
    const id = `TASK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const executeAtSec = this.simTimeSec + Math.max(0.1, delaySec);
    this.queue.push({
      id,
      executeAtSec,
      description,
      run: task,
    });
    // Keep queue sorted by execution time
    this.queue.sort((a, b) => a.executeAtSec - b.executeAtSec);
    return id;
  }

  public cancel(taskId: string): void {
    this.queue = this.queue.filter((t) => t.id !== taskId);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickRealTime = performance.now();
    this.loop();
  }

  public pause(): void {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public reset(): void {
    this.pause();
    this.simTimeSec = 0;
    this.queue = [];
    this.notifyTick();
  }

  public setSpeed(multiplier: number): void {
    this.speed = Math.max(0.25, Math.min(20, multiplier));
  }

  public getSpeed(): number {
    return this.speed;
  }

  public getSimTime(): number {
    return this.simTimeSec;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public async step(stepSec = 1): Promise<void> {
    this.simTimeSec += stepSec;
    await this.processPendingTasks();
    this.notifyTick();
  }

  private loop = async (): Promise<void> => {
    if (!this.isRunning) return;

    const now = performance.now();
    const realDeltaMs = now - this.lastTickRealTime;
    this.lastTickRealTime = now;

    // Real tick interval is ~200ms
    const simDeltaSec = (realDeltaMs / 1000) * this.speed;
    this.simTimeSec += simDeltaSec;

    await this.processPendingTasks();
    this.notifyTick();

    if (this.isRunning) {
      this.timerId = window.setTimeout(this.loop, 200);
    }
  };

  private async processPendingTasks(): Promise<void> {
    while (this.queue.length > 0 && this.queue[0].executeAtSec <= this.simTimeSec) {
      const task = this.queue.shift();
      if (!task) break;

      try {
        await task.run();
      } catch (err) {
        console.error(`[EventScheduler] Error executing task "${task.description}":`, err);
      }
    }
  }

  private notifyTick(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.simTimeSec, performance.now());
      } catch (err) {
        console.error('[EventScheduler] Tick listener error:', err);
      }
    }
  }
}
