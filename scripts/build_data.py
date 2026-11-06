"""Build a compact, offline timetable from the supplied GTFS archives (stdlib only)."""
import argparse, csv, io, json, zipfile
from pathlib import Path
from collections import defaultdict

VENUES = [dict(id='kami',stops=['紙屋町']),dict(id='hachi',stops=['八丁堀'])]

def seconds(t):
 h,m,s=map(int,t.split(':')); return h*3600+m*60+s

def build(source):
 out=dict(venues=VENUES,feeds=[],trips=[])
 targets={s for v in VENUES for s in v['stops']}
 for path in sorted(Path(source).glob('*.zip')):
  with zipfile.ZipFile(path) as z:
   def read(name):
    return list(csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig'))) if name in z.namelist() else []
   idx=len(out['feeds']); agencies={r['agency_id']:r['agency_name'] for r in read('agency.txt')}
   stops={r['stop_id']:r for r in read('stops.txt')}; routes={r['route_id']:r for r in read('routes.txt')}
   times=defaultdict(list)
   for r in read('stop_times.txt'):
    if stops[r['stop_id']]['stop_name'] in targets|{'広島駅'}: times[r['trip_id']].append(r)
   out['feeds'].append(dict(file=path.name,info=read('feed_info.txt'),calendar=read('calendar.txt'),exceptions=read('calendar_dates.txt'),agencies=list(agencies.values()),translations={lang:{r['trans_id']:r['translation'] for r in read('translations.txt') if r.get('lang')==lang and r.get('translation')} for lang in ['en','ko','zh-cn','zh-tw']}))
   count=0
   for t in read('trips.txt'):
    tt=sorted(times[t['trip_id']],key=lambda r:int(r['stop_sequence']))
    for origin in tt:
     stop=stops[origin['stop_id']]
     if stop['stop_name'] not in {'広島駅'} or origin.get('pickup_type')=='1': continue
     dests={}; evidence={}
     for arrival in tt:
      name=stops[arrival['stop_id']]['stop_name']
      if name in targets and int(arrival['stop_sequence'])>int(origin['stop_sequence']) and arrival.get('drop_off_type')!='1' and arrival['arrival_time']:
       if name not in dests:
        dests[name]=seconds(arrival['arrival_time']); evidence[name]=dict(stopId=arrival['stop_id'],sequence=int(arrival['stop_sequence']),dropOff=arrival.get('drop_off_type',''))
     if not dests or not origin['departure_time']: continue
     route=routes[t['route_id']]
     out['trips'].append(dict(feed=idx,id=t['trip_id'],service=t['service_id'],departure=seconds(origin['departure_time']),origin=stop['stop_name'],platform=stop.get('platform_code',''),stopId=origin['stop_id'],route=route['route_short_name'] or route['route_long_name'],routeName=route['route_long_name'],agency=agencies.get(route['agency_id'],''),headsign=origin.get('stop_headsign') or t['trip_headsign'],destinations=dests,originSequence=int(origin['stop_sequence']),pickup=origin.get('pickup_type',''),evidence=evidence));count+=1
   print(path.name,count)
 return out

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');args=p.parse_args()
 out=build(args.source);target=Path(__file__).resolve().parents[1]/'data/timetable.json'
 target.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print(target, len(out['trips']))
