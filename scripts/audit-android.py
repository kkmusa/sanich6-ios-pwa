"""Read-only audit of the restored Android reference against the PWA assets."""
import argparse, collections, hashlib, json, re, sqlite3, subprocess
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--android',default='../sanich6-android/app/src/main')
parser.add_argument('--output',default='tests/source-audit.json')
args=parser.parse_args();android=Path(args.android).resolve();pwa=Path(__file__).resolve().parent.parent
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
node="""const fs=require('node:fs'),vm=require('node:vm'),r={};for(const [name,exporter] of [['js/operator-data.js','globalThis.operators=operatorSteps'],['js/reference-data.js','globalThis.casing=casingGost632Full;globalThis.tubing=tubingGost633;globalThis.topics=assistantTopics'],['js/calculators.js','globalThis.vkp=vkpTable;globalThis.vnkt=vnkt;globalThis.walls=casingWalls'],['vnr/search-data.js','globalThis.words=wordPages']])vm.runInNewContext(fs.readFileSync(name,'utf8')+';'+exporter,r);console.log(JSON.stringify(r))"""
data=json.loads(subprocess.check_output(['node','-e',node],cwd=pwa,text=True))
assert data['words']==json.loads((android/'assets/vnr/word_positions.json').read_text()),'VNR word coordinates differ from Android'
images=[]
for n in range(1,208):
 name=f'{n:03}.jpg';original=android/'assets/vnr/pages'/name;actual=pwa/'vnr/pages'/name
 assert hashfile(original)==hashfile(actual),name
 images.append({'page':n,'sha256':hashfile(actual)})
fields=['manufacturer','name','diameter','power','speed','casing','wall','flow']
connection=sqlite3.connect('file:'+str(android/'assets/ped_database.db')+'?mode=ro',uri=True)
records=connection.execute('select '+','.join(fields)+' from ped').fetchall()
pwa_records=json.loads((pwa/'assets/PedCoolingDatabase.json').read_text())
assert collections.Counter(records)==collections.Counter(tuple(r[f] for f in fields) for r in pwa_records)
source=(android/'java/com/example/sanich/screens/OperatorModeFlowScreen.kt').read_text()
pattern=r'OperatorStep\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*R\.drawable\.(\w+)\)'
original_steps=[(json.loads('"'+a+'"'),json.loads('"'+b+'"'),c) for a,b,c in re.findall(pattern,source)]
pwa_steps=[(s['title'],s['description'],Path(s['image']).stem) for stations in data['operators'].values() for steps in stations.values() for s in steps]
assert collections.Counter(original_steps)==collections.Counter(pwa_steps)
photos=[]
for photo in sorted((pwa/'assets/operators').glob('*.jpg')):
 candidates=list((android/'res').rglob(photo.name));match=next((p for p in candidates if hashfile(p)==hashfile(photo)),None)
 assert match is not None,photo.name
 photos.append({'file':photo.name,'sha256':hashfile(photo),'android':str(match.relative_to(android))})
pipe_source=(android/'java/com/example/sanich/screens/PipeReferenceScreen.kt').read_text()
pipe_pattern=r'PipeSize\("([^"]+)",\s*([\d.]+),\s*listOf\(([^)]+)\)\)'
pipes=[(name,float(outside),[float(x) for x in walls.split(',')]) for name,outside,walls in re.findall(pipe_pattern,pipe_source)]
for name,outside,walls in pipes:
 table=data['tubing'] if name in ['60','73','89'] else data['casing']
 assert table[name]=={'outside':outside,'walls':walls},name
report={'archives':'All 15 Android and 6 PWA archives validated; hashes in source-archives.json','androidSourceFiles':{str(p.relative_to(android)):hashfile(p) for p in sorted((android/'java').rglob('*.kt'))},'vnrPages':images,'pedRecords':len(records),'stationSteps':len(original_steps),'stationPhotographs':photos,'pipeSizes':len(pipes),'searchWords':sum(map(len,data['words'])),'assistantTopics':len(data['topics'])}
Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(f"Verified read-only Android parity: {len(images)} identical pages, {len(records)} identical PED records, {len(original_steps)} identical guide steps, {len(photos)} identical photos, {len(pipes)} pipe sizes.")
