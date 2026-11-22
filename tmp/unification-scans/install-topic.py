import json
from pathlib import Path
from PIL import Image

chapter = Path("backend/app/data/chapters/europa-i-swiat-po-wiosnie-ludow")
static = Path("backend/app/static")
images = static / "images/history/italy-germany-unification"
images.mkdir(parents=True, exist_ok=True)
downloads = Path.home() / "Downloads"
for time, name, box in [
    ("125408", "bismarck", (834,646,1114,997)),
    ("125425", "wilhelm-i", (970,280,1315,654)),
    ("125421", "austria-hungary-arms", (970,192,1464,523)),
]:
    with Image.open(downloads / f"20261122_{time}.jpg") as source:
        im = source.transpose(Image.Transpose.ROTATE_270)
        crop = tuple(round(value * (im.width / 1536 if i % 2 == 0 else im.height / 2048)) for i,value in enumerate(box))
        im.crop(crop).save(images / f"{name}.jpg", quality=90)

topic_id = "zjednoczenie-wloch-i-niemiec"
questions = []
def add(n, text, kind, explanation, **fields):
    questions.append(dict(id=f"q-unification-2026-{n:02}", topic_id=topic_id, is_active=True,
        text=text, selection_type=kind, explanation=explanation, **fields))
def single(n,text,options,explanation,**fields):
    add(n,text,"single",explanation,answers=[dict(text=option,is_correct=i==0) for i,option in enumerate(options)],**fields)
def opened(n,text,answers,explanation,**fields):
    add(n,text,"open",explanation,accepted_answers=answers,**fields)
def date(year):
    return [str(year), f"w {year}", f"{year} r.", f"w {year} r.", f"{year} roku", f"w {year} roku"]
def tf(n,statements,explanation):
    add(n,"Oceń każde zdanie jako prawdziwe albo fałszywe.","true_false",explanation,
        answers=[dict(text=text,is_correct=value) for text,value in statements])
def image(name):
    return f"/static/images/history/italy-germany-unification/{name}.jpg"

single(1,"Które państwo włoskie zapoczątkowało zjednoczenie Włoch?",["Królestwo Sardynii (Piemont)","Królestwo Obojga Sycylii","Państwo Kościelne","Wielkie Księstwo Toskanii"],"Zjednoczenie Włoch zapoczątkowało Królestwo Sardynii, zwane też Piemontem.")
opened(2,"Która część ziem włoskich była w połowie XIX w. lepiej rozwinięta gospodarczo?",["północ","północna","północna część","północna część Włoch","północ Włoch","północne Włochy"],"Ziemie północne były gospodarczo lepiej rozwinięte niż południowe.")
single(3,"Jakie państwo wsparło Piemont w wojnie z Austrią w 1859 r.?",["Francja","Prusy","Rosja","Wielka Brytania"],"Francja walczyła po stronie Piemontu.")
single(4,"Jakie dwa terytoria Piemont przekazał Francji w zamian za poparcie?",["Sabaudię i Niceę","Lombardię i Wenecję","Toskanię i Modenę","Sycylię i Sardynię"],"Francja otrzymała Sabaudię i Niceę.")
single(5,"Jaką krainę Piemont otrzymał po zwycięstwach pod Magentą i Solferino?",["Lombardię","Wenecję","Toskanię","Sycylię"],"Po wojnie z Austrią w 1859 r. Piemont otrzymał Lombardię.")
opened(6,"Kto dowodził wyprawą „tysiąca czerwonych koszul”?",["Giuseppe Garibaldi","Garibaldi"],"Wyprawą dowodził Giuseppe Garibaldi.")
single(7,"Za czym zagłosowali mieszkańcy Królestwa Obojga Sycylii w plebiscycie w 1860 r.?",["Za przyłączeniem do Piemontu","Za utrzymaniem odrębnego królestwa","Za przyłączeniem do Francji","Za przyłączeniem do Państwa Kościelnego"],"W plebiscycie poparto przyłączenie do Piemontu.")
opened(8,"W którym roku powstało Królestwo Włoch?",date(1861),"Królestwo Włoch powstało w 1861 r.")
opened(9,"Kto został pierwszym królem zjednoczonych Włoch?",["Wiktor Emanuel II","Wiktor Emanuel 2","Wiktor Emanuel Drugi","Vittorio Emanuele II"],"Pierwszym królem zjednoczonych Włoch był Wiktor Emanuel II.")
opened(10,"Które miasto przyłączono do Włoch w 1870 r., a rok później uczyniono stolicą?",["Rzym","Roma"],"Rzym przyłączono w 1870 r. i został stolicą Włoch w 1871 r.")
steps = ["Przyłączenie Lombardii","wyprawa Garibaldiego","powstanie Królestwa Włoch","przyłączenie Wenecji","przyłączenie Rzymu"]
single(11,"Która kolejność wydarzeń związanych ze zjednoczeniem Włoch jest poprawna?",[" → ".join(steps[i] for i in order) for order in [(0,1,2,3,4),(1,0,2,3,4),(0,2,1,3,4),(0,1,2,4,3)]],"Lombardię przyłączono w 1859 r. Wyprawa Garibaldiego odbyła się w 1860 r., a królestwo powstało w 1861 r. Wenecję przyłączono w 1866 r., a Rzym w 1870 r.")
single(12,"Które dwa państwa rywalizowały o przewodnictwo wśród państw niemieckich po kongresie wiedeńskim?",["Prusy i Austria","Prusy i Bawaria","Austria i Saksonia","Bawaria i Saksonia"],"O przewodnictwo rywalizowały Prusy i Austria.")
tf(13,[("Niemiecki Związek Celny zniósł bariery celne między swoimi członkami.",True),("Austria należała do Niemieckiego Związku Celnego.",False)],"Związek zniósł bariery celne między swoimi członkami. Austria do niego nie przystąpiła.")
single(14,"Co w planie Bismarcka oznaczało zjednoczenie Niemiec „krwią i żelazem”?",["Zjednoczenie poprzez działania zbrojne","Zjednoczenie przez zniesienie ceł","Zjednoczenie przez plebiscyty","Zjednoczenie przez małżeństwa dynastyczne"],"Bismarck zakładał zjednoczenie Niemiec poprzez działania zbrojne pod przewodnictwem Prus.")
single(15,"W jakiej kolejności Prusy stoczyły wojny prowadzące do zjednoczenia Niemiec?",["Z Danią → z Austrią → z Francją","Z Austrią → z Danią → z Francją","Z Danią → z Francją → z Austrią","Z Francją → z Austrią → z Danią"],"Wojny toczyły się z Danią w 1864 r., z Austrią w 1866 r. i z Francją w latach 1870–1871.")
opened(16,"Pod jaką miejscowością Prusy pokonały Austrię w decydującej bitwie w 1866 r.?",["Sadowa","Sadową","pod Sadową"],"Prusy zwyciężyły pod Sadową.")
single(17,"Jak nazywał się związek utworzony w 1867 r., który połączył część państw niemieckich pod przewodnictwem Prus?",["Związek Północnoniemiecki","Niemiecki Związek Celny","Związek Niemiecki","Cesarstwo Niemieckie"],"W 1867 r. powstał Związek Północnoniemiecki.")
single(18,"Które obszary Francja utraciła po wojnie z lat 1870–1871?",["Alzację i część Lotaryngii","Szlezwik i Holsztyn","Sabaudię i Niceę","Lombardię i Wenecję"],"Francja utraciła Alzację i część Lotaryngii.")
opened(19,"W którym roku ogłoszono powstanie Cesarstwa Niemieckiego?",date(1871),"Cesarstwo Niemieckie proklamowano w 1871 r.")
opened(20,"W jakiej miejscowości ogłoszono powstanie Cesarstwa Niemieckiego?",["Wersal","w Wersalu","Versailles","w Versailles"],"Powstanie cesarstwa ogłoszono we francuskim Wersalu.")
tf(21,[("Po powstaniu Austro-Węgier Austria i Węgry miały wspólną armię.",True),("Austria i Węgry miały wspólny parlament.",False)],"Austria i Węgry miały wspólną armię, lecz odrębne parlamenty.")
for n,text,file,target,explanation in [
    (22,"Kliknij wyspę, na której wylądowali ochotnicy Garibaldiego w 1860 r.","italian-unification-islands","sicily","Ochotnicy Garibaldiego wylądowali na Sycylii, w Marsali."),
    (23,"Kliknij stolicę Królestwa Bawarii, które w 1871 r. weszło w skład Cesarstwa Niemieckiego.","german-unification-cities","munich","Stolicą Królestwa Bawarii było Monachium."),
]:
    add(n,text,"map",explanation,map_config=dict(source=f"/static/maps/{file}.geojson",background_source="/static/maps/world-continents.geojson",mode="select",target_feature_id=target))
single(24,"Kogo przedstawia ilustracja?",["Ottona von Bismarcka","Wilhelma I","Napoleona III","Wiktora Emanuela II"],"Otto von Bismarck był kanclerzem Prus, a potem Cesarstwa Niemieckiego.",image=image("bismarck"))
single(25,"Kogo przedstawia ilustracja?",["Wilhelma I","Ottona von Bismarcka","Wiktora Emanuela II","Giuseppe Garibaldiego"],"Wilhelm I był królem Prus, a w 1871 r. został cesarzem niemieckim.",image=image("wilhelm-i"))
opened(26,"Czyj herb rodowy znajduje się na najmniejszej tarczy pośrodku?",["Habsburgów","Habsburgowie","dynastii Habsburgów","rodu Habsburgów","herb Habsburgów"],"Środkowa tarcza przedstawia herb rodu Habsburgów.",image=image("austria-hungary-arms"))

def save(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

cities = [("berlin","Berlin",13.405,52.520),("dresden","Drezno",13.738,51.050),("stuttgart","Stuttgart",9.182,48.776),("munich","Monachium",11.575,48.137)]
save(static / "maps/german-unification-cities.geojson", {"type":"FeatureCollection","features":[
    {"type":"Feature","id":i,"properties":{"name":name},"geometry":{"type":"Point","coordinates":[lon,lat]}} for i,name,lon,lat in cities]})
name = "topic_2_zjednoczenie-wloch-i-niemiec.json"
save(chapter / name,dict(topic_id=topic_id,topic_title="Zjednoczenie Włoch i Niemiec",is_active=True,questions=questions))
meta_path = chapter / "meta.json"
meta = json.loads(meta_path.read_text(encoding="utf-8"))
if name not in meta["topics"]:
    meta["topics"].append(name)
    save(meta_path,meta)
