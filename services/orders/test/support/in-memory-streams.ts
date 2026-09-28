import {
  ReadOptions,
  StreamEntry,
  StreamsClient,
} from '../../src/messaging/streams.client.js';

interface Group {
  delivered: number;
  pending: Map<string, StreamEntry>;
}

/** Minimal in-memory Redis Streams with consumer groups, good enough for tests. */
export class InMemoryStreams extends StreamsClient {
  readonly streams = new Map<string, StreamEntry[]>();
  private readonly groups = new Map<string, Group>();
  private seq = 0;

  entries(stream: string) {
    return this.streams.get(stream) ?? [];
  }

  events(stream: string) {
    return this.entries(stream).map((e) => JSON.parse(e.fields.event));
  }

  pendingCount(stream: string, group: string) {
    return this.groups.get(`${stream}/${group}`)?.pending.size ?? 0;
  }

  async publish(stream: string, fields: Record<string, string>) {
    const id = `${Date.now()}-${this.seq++}`;
    this.streams.set(stream, [...this.entries(stream), { id, fields }]);
    return id;
  }

  async ensureGroup(stream: string, group: string) {
    const key = `${stream}/${group}`;
    if (!this.groups.has(key)) {
      this.groups.set(key, { delivered: 0, pending: new Map() });
    }
  }

  async readGroup(
    stream: string,
    group: string,
    _consumer: string,
    { pending = false, count = 20 }: ReadOptions = {},
  ) {
    await this.ensureGroup(stream, group);
    const state = this.groups.get(`${stream}/${group}`)!;
    if (pending) return [...state.pending.values()].slice(0, count);
    const fresh = this.entries(stream).slice(
      state.delivered,
      state.delivered + count,
    );
    state.delivered += fresh.length;
    for (const entry of fresh) state.pending.set(entry.id, entry);
    return fresh;
  }

  async ack(stream: string, group: string, id: string) {
    this.groups.get(`${stream}/${group}`)?.pending.delete(id);
  }

  async ping() {
    return true;
  }

  async close() {}
}
