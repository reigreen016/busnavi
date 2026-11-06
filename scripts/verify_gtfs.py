"""Independently check every generated departure against original GTFS stop_times."""
import argparse,csv,io,json,zipfile
from pathlib import Path
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'data/timetable.json').read_text())
parser=argparse.ArgumentParser();parser.add_argument('source');source=Path(parser.parse_args().source)
for i,feed in enumerate(data['feeds']):
 with zipfile.ZipFile(source/feed['file']) as z:
  def read(f):return csv.DictReader(io.TextIOWrapper(z.open(f),encoding='utf-8-sig'))
  stops={r['stop_id']:r for r in read('stops.txt')};times=defaultdict(dict)
  for r in read('stop_times.txt'):times[r['trip_id']][int(r['stop_sequence'])]=r
  trips=[t for t in data['trips'] if t['feed']==i]
  definitions={r['trip_id']:r for r in read('trips.txt')}
  services={t['service'] for t in trips}
  assert feed['calendar']==[r for r in read('calendar.txt') if r['service_id'] in services]
  assert feed['exceptions']==[r for r in read('calendar_dates.txt') if r['service_id'] in services]
  seen=set()
  for t in trips:
   assert t['service']==definitions[t['id']]['service_id']
   key=(t['id'],t['originSequence']);assert key not in seen;seen.add(key)
   origin=times[t['id']][t['originSequence']]
   assert stops[origin['stop_id']]['stop_name']=='広島駅'
   assert origin.get('pickup_type')!='1'
   assert t['platform']==stops[origin['stop_id']]['platform_code']
   assert t['departure']==sum(int(v)*u for v,u in zip(origin['departure_time'].split(':'),[3600,60,1]))
   for name,ev in t['evidence'].items():
    dest=times[t['id']][ev['sequence']]
    assert ev['sequence']>t['originSequence']
    assert stops[dest['stop_id']]['stop_name']==name
    assert name in ['紙屋町','八丁堀'] and dest.get('drop_off_type')!='1'
    assert t['destinations'][name]==sum(int(v)*u for v,u in zip(dest['arrival_time'].split(':'),[3600,60,1]))
    assert t['destinations'][name]>=t['departure']
  print(feed['file'],len(trips),'verified')
print('All',len(data['trips']),'departures verified against original GTFS')
