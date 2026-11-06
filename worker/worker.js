// busnavi GTFS-RT relay for Cloudflare Workers.
// Deploy with wrangler.jsonc: a Durable Object binding is required.
// Public data source: https://www.bus-kyo.or.jp/gtfs-open-data (CC0).
// Every public request uses one globally named Durable Object.
const FEEDS = [
  { id: 'hiroden', number: 8, name: '広島電鉄' },
  { id: 'hirobus', number: 9, name: '広島バス' },
  { id: 'hirokou', number: 10, name: '広島交通' },
  { id: 'jrchugoku', number: 15, name: 'JRバス中国' },
];
const TTL = 30;
const MAX_BYTES = 8 * 1024 * 1024;

const textDecoder = new TextDecoder();

// Decode the protobuf wire format without third-party packages.
function fields(bytes) {
  const result = new Map();
  let pos = 0;
  function varint() {
    let value = 0n;
    for (let shift = 0n; shift < 70n; shift += 7n) {
      if (pos >= bytes.length) throw new Error('Truncated protobuf');
      const byte = bytes[pos++];
      value |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid protobuf varint');
  }
  while (pos < bytes.length) {
    const tag = Number(varint());
    const field = tag >>> 3;
    if (!field) throw new Error('Invalid protobuf field');
    let value;
    switch (tag & 7) {
      case 0: value = varint(); break;
      case 1:
        if (pos + 8 > bytes.length) throw new Error('Truncated fixed64');
        value = bytes.subarray(pos, pos + 8); pos += 8; break;
      case 2: {
        const size = Number(varint());
        if (!Number.isSafeInteger(size) || size < 0 || size > bytes.length - pos) throw new Error('Invalid protobuf length');
        value = bytes.subarray(pos, pos + size); pos += size; break;
      }
      case 5:
        if (pos + 4 > bytes.length) throw new Error('Truncated fixed32');
        value = bytes.subarray(pos, pos + 4); pos += 4; break;
      default: throw new Error('Unsupported protobuf wire type');
    }
    if (!result.has(field)) result.set(field, []);
    result.get(field).push(value);
  }
  return result;
}
const first = (message, key) => message.get(key)?.[0];
const number = (message, key) => typeof first(message, key) === 'bigint' ? Number(first(message, key)) : null;
const string = (message, key) => first(message, key) instanceof Uint8Array ? textDecoder.decode(first(message, key)) : '';
const nested = (message, key) => first(message, key) instanceof Uint8Array ? fields(first(message, key)) : new Map();
function event(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  const message = fields(bytes);
  const delay = first(message, 1);
  return {
    delay: typeof delay === 'bigint' ? Number(BigInt.asIntN(32, delay)) : null,
    time: number(message, 2),
    uncertainty: number(message, 3),
  };
}
export function decodeFeed(bytes) {
  const message = fields(bytes);
  const header = nested(message, 1);
  if (!string(header, 1)) throw new Error('GTFS-RT header missing');
  // Incremental feeds require retained state; do not silently treat them as snapshots.
  if ((number(header, 2) ?? 0) !== 0) throw new Error('Differential feed is not supported');
  const trips = [];
  for (const raw of message.get(2) || []) {
    const entity = fields(raw);
    if (number(entity, 2) === 1 || !entity.has(3)) continue;
    const update = nested(entity, 3);
    const descriptor = nested(update, 1);
    const id = string(descriptor, 1);
    if (!id) continue;
    trips.push({
      tripId: id,
      startTime: string(descriptor, 2),
      startDate: string(descriptor, 3),
      routeId: string(descriptor, 5),
      relationship: number(descriptor, 4) ?? 0,
      timestamp: number(update, 4),
      delay: typeof first(update, 5) === 'bigint' ? Number(BigInt.asIntN(32, first(update, 5))) : null,
      stops: (update.get(2) || []).map(rawStop => {
        const stop = fields(rawStop);
        return {
          sequence: number(stop, 1),
          stopId: string(stop, 4),
          relationship: number(stop, 5) ?? 0,
          arrival: event(first(stop, 2)),
          departure: event(first(stop, 3)),
        };
      }),
    });
  }
  return { timestamp: number(header, 3), trips };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
async function fetchFeed(feed) {
  const fetchedAt = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(`https://ajt-mobusta-gtfs.mcapps.jp/realtime/${feed.number}/trip_updates.bin`, {
      // .bin responses can otherwise be cached by Cloudflare beyond our collector TTL.
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/octet-stream' },
    });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    if (Number(response.headers.get('Content-Length')) > MAX_BYTES) throw new Error('Feed too large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error('Feed too large');
    const decoded = decodeFeed(bytes);
    return { id: feed.id, name: feed.name, fetchedAt, ok: true, ...decoded };
  } catch (error) {
    return { id: feed.id, name: feed.name, fetchedAt, ok: false, timestamp: null, trips: [], error: error.message };
  }
}
// Persist snapshots in bounded chunks, including the cooldown before fetching.
// The cooldown survives eviction/restart and failed fetches cannot cause a retry storm.
export class RealtimeCollector {
  constructor(state) {
    this.state = state;
    this.pending = null;
    state.blockConcurrencyWhile(async () => {
      this.nextFetchAt = await state.storage.get('nextFetchAt') || 0;
      const count = await state.storage.get('snapshotCount') || 0;
      if (count) {
        const parts = await state.storage.get(Array.from({ length: count }, (_, i) => `snapshot:${i}`));
        const chunks = Array.from({ length: count }, (_, i) => parts.get(`snapshot:${i}`));
        if (chunks.every(Boolean)) {
          const bytes = new Uint8Array(chunks.reduce((sum, part) => sum + part.length, 0));
          let offset = 0;
          for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
          this.snapshot = JSON.parse(textDecoder.decode(bytes));
        }
      }
    });
  }
  async refresh() {
    this.nextFetchAt = Date.now() + TTL * 1000;
    await this.state.storage.put('nextFetchAt', this.nextFetchAt);
    const feeds = await Promise.all(FEEDS.map(fetchFeed));
    const snapshot = { version: 2, generatedAt: Math.floor(Date.now() / 1000), intervalSeconds: TTL, feeds };
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    if (bytes.length > 7 * 1024 * 1024) throw new Error('Snapshot too large');
    const entries = {};
    for (let start = 0, i = 0; start < bytes.length; start += 60000, i++) entries[`snapshot:${i}`] = bytes.slice(start, start + 60000);
    entries.snapshotCount = Object.keys(entries).length;
    await this.state.storage.put(entries);
    this.snapshot = snapshot;
  }
  async fetch() {
    let hit = true;
    if (this.pending) {
      await this.pending;
    } else if (Date.now() >= this.nextFetchAt) {
      hit = false;
      this.pending = this.refresh();
      try { await this.pending; } finally { this.pending = null; }
    }
    if (!this.snapshot) return json({ error: 'Collector recovering; retry after 30 seconds' }, 503);
    const response = json(this.snapshot);
    response.headers.set('X-Busnavi-Cache', hit ? 'HIT' : 'MISS');
    return response;
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'X-Busnavi-Cache',
      'Cache-Control': 'no-store',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET, OPTIONS' } });
    if (url.pathname !== '/' && url.pathname !== '/api/realtime') return new Response('Not found', { status: 404, headers });
    let response;
    try {
      if (!env?.REALTIME_COLLECTOR) throw new Error('REALTIME_COLLECTOR binding is required');
      // Never derive the object name from a request path, hostname or query.
      const id = env.REALTIME_COLLECTOR.idFromName('hiroshima-trip-updates-v1');
      response = await env.REALTIME_COLLECTOR.get(id).fetch('https://collector/snapshot');
    } catch (error) {
      response = json({ error: 'Realtime service unavailable', detail: error.message }, 503);
    }
    const output = new Response(response.body, response);
    Object.entries(headers).forEach(([name, value]) => output.headers.set(name, value));
    return output;
  },
};
