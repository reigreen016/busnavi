import {strings} from './i18n.js?v=10';
export const time = seconds => `${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}`;
export function departureMarkup(trip, lang) {
  const text = strings[lang];
  const delayed = trip.predictedDeparture && trip.departure > trip.scheduledDeparture;
  if (delayed) return `<s class="scheduled-time" aria-label="${text.scheduledShort}">${time(trip.scheduledDeparture)}</s><span class="effective-time effective-time--delayed">${time(trip.departure)}</span><small class="delay-minutes">+${Math.ceil((trip.departure - trip.scheduledDeparture) / 60)} ${text.min}</small>`;
  const onTime = trip.predictedDeparture && trip.departure === trip.scheduledDeparture;
  return `<span class="effective-time">${time(trip.departure)}</span><small class="prediction-label${onTime ? ' prediction-label--ontime' : ''}">${onTime ? text.onTime : trip.predictedDeparture ? text.predicted : text.scheduledShort}</small>`;
}
