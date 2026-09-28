import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreaker } from './circuit-breaker.js';

export const SERVICE_NAMES = [
  'inventory',
  'orders',
  'payments',
  'notifications',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface ServiceRoute {
  name: ServiceName;
  url: string;
  /** Public prefixes under `/api` owned by the service. */
  prefixes: string[];
  /** Long-lived responses (SSE) must not time out. */
  streaming: boolean;
  breaker: CircuitBreaker;
}

const ROUTES: Record<ServiceName, { prefixes: string[]; port: number }> = {
  inventory: { prefixes: ['/products', '/reservations'], port: 8001 },
  orders: { prefixes: ['/orders'], port: 3001 },
  payments: { prefixes: ['/payments'], port: 8002 },
  notifications: { prefixes: ['/notifications'], port: 3002 },
};

/** Where every downstream service lives, from `<NAME>_URL` environment variables. */
@Injectable()
export class ServicesRegistry {
  readonly routes: ServiceRoute[];

  constructor(config: ConfigService) {
    const threshold = Number(config.get('BREAKER_THRESHOLD', '5'));
    const coolDown = Number(config.get('BREAKER_COOLDOWN_MS', '10000'));
    this.routes = SERVICE_NAMES.map((name) => ({
      name,
      url: config
        .get<string>(
          `${name.toUpperCase()}_URL`,
          `http://localhost:${ROUTES[name].port}`,
        )
        .replace(/\/$/, ''),
      prefixes: ROUTES[name].prefixes,
      streaming: name === 'notifications',
      breaker: new CircuitBreaker(threshold, coolDown),
    }));
  }

  get(name: string): ServiceRoute | undefined {
    return this.routes.find((r) => r.name === name);
  }
}
