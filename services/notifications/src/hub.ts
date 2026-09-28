import { EventEmitter } from 'node:events';
import type { Notification } from './notifications.js';

/** In-process fan-out to every open SSE connection. */
export class NotificationHub {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(notification: Notification) {
    this.emitter.emit('notification', notification);
  }

  subscribe(listener: (n: Notification) => void): () => void {
    this.emitter.on('notification', listener);
    return () => this.emitter.off('notification', listener);
  }

  get subscribers() {
    return this.emitter.listenerCount('notification');
  }
}
