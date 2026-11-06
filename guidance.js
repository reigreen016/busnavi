// A single set of trips drives the overview, map and departure-row highlights.
export function upcomingGuidance(trips, stops, windowSeconds = 180) {
 const selected = new Set();
 const groups = stops.map(stop => {
  const candidates = trips.filter(trip => stop in trip.destinations);
  const next = candidates.length ? candidates.filter(trip => trip.departure <= candidates[0].departure + windowSeconds) : [];
  next.forEach(trip => selected.add(trip));
  const platforms = [...new Set(next.map(trip => trip.platform).filter(Boolean))].sort((a,b) => Number(a)-Number(b));
  return { stop, available: candidates.length, trips: next, platforms };
 });
 return { groups, selected };
}
