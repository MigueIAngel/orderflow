import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let time: number;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    time = 0;
    breaker = new CircuitBreaker(3, 1000, () => time);
  });

  it('opens after the failure threshold', () => {
    breaker.failure();
    breaker.failure();
    expect(breaker.canRequest()).toBe(true);
    breaker.failure();
    expect(breaker.state).toBe('open');
    expect(breaker.canRequest()).toBe(false);
    expect(breaker.retryAfterMs()).toBe(1000);
  });

  it('a success resets the failure count', () => {
    breaker.failure();
    breaker.failure();
    breaker.success();
    breaker.failure();
    expect(breaker.state).toBe('closed');
  });

  it('lets one trial through after the cool-down', () => {
    for (let i = 0; i < 3; i++) breaker.failure();
    time = 1000;
    expect(breaker.state).toBe('half-open');
    expect(breaker.canRequest()).toBe(true);
  });

  it('closes again when the trial succeeds', () => {
    for (let i = 0; i < 3; i++) breaker.failure();
    time = 1500;
    breaker.success();
    expect(breaker.state).toBe('closed');
  });

  it('re-opens immediately when the trial fails', () => {
    for (let i = 0; i < 3; i++) breaker.failure();
    time = 1500;
    breaker.failure();
    expect(breaker.state).toBe('open');
    expect(breaker.retryAfterMs()).toBe(1000);
  });
});
