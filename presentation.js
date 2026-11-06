import {strings} from './i18n.js?v=16';
export const time = seconds => `${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}`;
export function departureMarkup(trip, lang) {
  const text = strings[lang];
  const delayed = trip.predictedDeparture && trip.departure > trip.scheduledDeparture;
  if (delayed) return `<span class="effective-time effective-time--delayed">${time(trip.departure)}</span><small class="departure-subline"><s class="scheduled-time" aria-label="${text.scheduledShort}">${time(trip.scheduledDeparture)}</s><span class="delay-minutes">+${Math.ceil((trip.departure - trip.scheduledDeparture) / 60)} ${text.min}</span></small>`;
  const onTime = trip.predictedDeparture && trip.departure === trip.scheduledDeparture;
  return `<span class="effective-time">${time(trip.departure)}</span><small class="prediction-label${onTime ? ' prediction-label--ontime' : ''}">${onTime ? text.onTime : trip.predictedDeparture ? text.predicted : text.scheduledShort}</small>`;
}

export function destinationLabel(value,lang){
 if(!value)return '';
 if(lang==='ja')return /行(?:き)?$/.test(value)?value:value+' 行';
 if(lang==='en')return 'To '+value;
 if(lang==='ko')return value+' 방면';
 return (lang==='zh-cn'?'开往':'往')+value;
}
