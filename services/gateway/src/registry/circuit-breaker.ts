export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Stops sending traffic to an upstream that keeps failing.
 *
 * closed → (N consecutive failures) → open → (cool-down elapsed) → half-open
 * half-open → one success closes it again, one failure re-opens it.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private _state: CircuitState = 'closed';

  constructor(
    private readonly threshold = 5,
    private readonly coolDownMs = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): CircuitState {
    if (
      this._state === 'open' &&
      this.now() - this.openedAt >= this.coolDownMs
    ) {
      this._state = 'half-open';
    }
    return this._state;
  }

  canRequest(): boolean {
    return this.state !== 'open';
  }

  success() {
    this.failures = 0;
    this._state = 'closed';
  }

  failure() {
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this._state = 'open';
      this.openedAt = this.now();
    }
  }

  /** Milliseconds until a trial request is allowed again. */
  retryAfterMs(): number {
    if (this.state !== 'open') return 0;
    return Math.max(0, this.coolDownMs - (this.now() - this.openedAt));
  }
}
