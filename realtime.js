// Only explicit, fresh stop predictions are used; no unobserved delay propagation.
export const REFRESH_MS = 30000;
export const FRESH_SECONDS = 90;
export function fresh(timestamp, nowSeconds) {
  return Number.isFinite(timestamp) && nowSeconds - timestamp <= FRESH_SECONDS && timestamp <= nowSeconds + 30;
}
export function applyRealtime(trip, data, snapshot, date, nowSeconds) {
  const file = data.feeds[trip.feed].file;
  const id = file.replace('current_data-', '').replace('.zip', '');
  const feed = snapshot?.feeds?.find(f => f.id === id);
  if (!feed?.ok || !fresh(feed.timestamp, nowSeconds)) return trip;
  const candidates = feed.trips.filter(t => t.tripId === trip.id &&
    (t.startDate ? t.startDate === trip.serviceDate.replaceAll('-', '') : trip.serviceDate === date));
  if (candidates.length !== 1) return trip;
  const update = candidates[0];
  if (update.timestamp != null && !fresh(update.timestamp, nowSeconds)) return trip;
  if ([3, 7].includes(update.relationship)) return null; // CANCELED / DELETED
  if (update.relationship !== 0) return trip;
  const match = (stopId, sequence) => update.stops.find(s =>
    (s.sequence != null || s.stopId) &&
    (s.sequence == null || s.sequence === sequence) && (!s.stopId || s.stopId === stopId));
  const origin = match(trip.stopId, trip.originSequence);
  if (origin?.relationship === 1) return null; // No pickup here.
  const midnight = new Date(date + 'T00:00:00+09:00').getTime() / 1000;
  const predicted = (event, scheduled) => {
    if (Number.isFinite(event?.time)) return event.time - midnight;
    if (Number.isFinite(event?.delay)) return scheduled + event.delay;
    return null;
  };
  const departure = origin?.relationship === 0 ? predicted(origin.departure, trip.departure) : null;
  const destinations = {}, arrivalPredictions = {};
  for (const [name, scheduled] of Object.entries(trip.destinations)) {
    const evidence = trip.evidence[name];
    const stop = match(evidence.stopId, evidence.sequence);
    if (stop?.relationship === 1) continue;
    const arrival = stop?.relationship === 0 ? predicted(stop.arrival, scheduled) : null;
    destinations[name] = arrival ?? scheduled;
    arrivalPredictions[name] = arrival != null;
  }
  return { ...trip, destinations, arrivalPredictions, departure: departure ?? trip.departure,
    scheduledDeparture: trip.departure, predictedDeparture: departure != null };
}

// Stop both requests and timers while hidden or while a historical time is selected.
export function createRealtimePoller({ endpoint, onUpdate, fetcher = fetch, schedule = setTimeout, cancel = clearTimeout, now = Date.now }) {
  let enabled = false, generation = 0, timer, controller;
  async function poll(token) {
    const started = now();
    controller = new AbortController();
    const requestController = controller;
    const timeout = schedule(() => requestController.abort(), 15000);
    try {
      const response = await fetcher(endpoint, { cache: 'no-store', signal: requestController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (snapshot.version !== 2 || !Array.isArray(snapshot.feeds)) throw new Error('Invalid realtime response');
      if (enabled && token === generation) onUpdate(snapshot);
    } catch (error) {
      if (enabled && token === generation) onUpdate(null);
    } finally {
      cancel(timeout);
      if (enabled && token === generation) timer = schedule(() => poll(token), Math.max(0, REFRESH_MS - (now() - started)));
    }
  }
  return {
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value;
      generation++;
      cancel(timer);
      controller?.abort();
      if (enabled) void poll(generation);
    },
  };
}
