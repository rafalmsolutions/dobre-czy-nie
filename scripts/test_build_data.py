#!/usr/bin/env python3
"""Test skryptu build_data.py na podmienionej wyszukiwarce (bez internetu).
Wyszukiwarka testowa naśladuje prawdziwą: liczy dokładnie tylko do 10 000 wyników,
odrzuca za duże strony (HTTP 422) i obsługuje prefiks kodu (code:590*)."""
import json, os, random, re, shutil, sys, tempfile, threading, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(__file__))
import build_data as B

random.seed(7)
DB = []
for i in range(23000):
    prefix = random.choice(['590'] * 7 + ['400', '301', '850', '20'])
    code = prefix + ''.join(random.choice('0123456789') for _ in range(13 - len(prefix)))
    cats = random.choice([['en:dairies', 'en:yogurts'], ['en:dairies', 'en:cheeses'], ['en:snacks'], ['en:rare-thing']])
    if i % 997 == 0:
        cats = ['en:only-few']
    DB.append({'code': code, 'product_name': f'Produkt {i}' if i % 50 else '', 'product_name_pl': f'Produkt PL {i}' if i % 3 == 0 else None,
               'brands': ['Marka', 'Inna'] if i % 4 == 0 else 'Marka', 'nutriscore_grade': 'abcde'[i % 5], 'nova_group': (i % 4) + 1,
               'ingredients_tags': ['en:milk', 'en:e330'] if i % 2 else [], 'ingredients_n': 2 if i % 2 else None,
               'nutriments': {'salt_100g': (i % 30) / 10, 'sugars_100g': i % 40, 'junk_100g': 1, 'fat_100g': 'zle'},
               'categories_tags': cats, 'stores': ['Lidl'] if i % 5 == 0 else None, 'unique_scans_n': i % 100,
               'allergens_tags': ['en:milk'], 'image_front_small_url': '<script>',
               'states_tags': (['en:ingredients-to-be-completed', 'en:ingredients-photo-selected'] if i % 7 == 0 else []) + (['en:nutrition-facts-to-be-completed', 'en:nutrition-photo-selected'] if i % 11 == 0 else []) + (['en:nutrition-facts-to-be-completed'] if i % 13 == 0 else []),
               'lang': 'pl'})
# kategoria z mniej niż 5 produktami (i=0, 997, ... → 24 sztuki – zostawiamy tylko 3)
for k, p in enumerate([p for p in DB if p['categories_tags'] == ['en:only-few']]):
    if k >= 3:
        p['categories_tags'] = ['en:snacks']
DB = list({p['code']: p for p in DB}.values())


class H(BaseHTTPRequestHandler):
    calls = 0

    def log_message(self, *a):
        pass

    def do_GET(self):
        H.calls += 1
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        q = qs['q'][0]
        size = int(qs.get('page_size', ['10'])[0])
        if size > 500:
            self.send_response(422); self.end_headers(); self.wfile.write(b'{"detail":"page_size too large"}'); return
        pres = re.findall(r'code:(\d+)\*', q)  # „code:590* AND … AND code:5901*” → kod musi pasować do każdego prefiksu
        hits = [p for p in DB if all(p['code'].startswith(x) for x in pres)]
        n = len(hits)
        fields = qs.get('fields', [''])[0].split(',')
        body = {'hits': [{k: v for k, v in p.items() if k in fields} for p in hits[:size]],
                'count': min(n, 10000), 'is_count_exact': n <= 10000}
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(body).encode())


srv = ThreadingHTTPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = tempfile.mkdtemp()
ok = fail = 0


def t(name, cond, info=''):
    global ok, fail
    if cond: ok += 1
    else:
        fail += 1; print('FAIL', name, str(info)[:300])


rc = B.main(['--out', out, '--base', f'http://127.0.0.1:{srv.server_port}/search', '--pause', '0', '--min-products', '100', '--prev-hist', '', '--hist-url', ''])
t('exit 0', rc == 0, rc)
meta = json.load(open(os.path.join(out, 'meta.json')))
named = [p for p in DB if p['product_name'] or p['product_name_pl']]
t('wszystkie produkty z nazwą', meta['products'] == len(named), (meta, len(named)))
shard = json.load(open(os.path.join(out, 'p', named[0]['code'][-3:] + '.json')))
p = shard[named[0]['code']]
t('produkt w paczce po 3 ostatnich cyfrach', p['code'] == named[0]['code'])
t('marki z listy', all(isinstance(json.load(open(os.path.join(out, 'p', f)))[c]['brands'], str) for f in os.listdir(os.path.join(out, 'p'))[:5] for c in list(json.load(open(os.path.join(out, 'p', f))))[:3]))
t('tylko znane wartości odżywcze', set(p['nutriments']) <= set(B.NUTRIMENTS) and 'fat_100g' not in p['nutriments'], p['nutriments'])
t('obraz bez zmian (aplikacja i tak sprawdza https)', 'image_front_small_url' in p)
y = json.load(open(os.path.join(out, 'c', 'en_yogurts.json')))
t('kategoria: najwyżej 200', len(y['products']) == 200 and y['count'] > 200, len(y['products']))
scans = [next(d for d in DB if d['code'] == x['code'])['unique_scans_n'] for x in y['products']]
t('kategoria: najpopularniejsze najpierw', scans == sorted(scans, reverse=True), scans[:10])
t('mała kategoria pominięta', not os.path.exists(os.path.join(out, 'c', 'en_only-few.json')))
t('dodatki z listy składników', any(x.get('additives_tags') == ['en:e330'] for x in y['products']))
t('brak składu = dodatki nieznane', any(x.get('additives_tags') is None for x in y['products']))
t('sklepy', any(x.get('stores') == ['Lidl'] for f in os.listdir(os.path.join(out, 'p'))[:20] for x in json.load(open(os.path.join(out, 'p', f))).values()))
t('zapytania: rozsądna liczba (z drugim przebiegiem po polskich kodach)', H.calls < 900, H.calls)
# Historia gramatur (skurczflacja)
t('historia gramatur zapisana', os.path.exists(os.path.join(out, 'qhist.json')))
t('gramatura: wielopak i jednostki', B.qty_norm('4 x 125 g') == '500 g' and B.qty_norm('1,5 l') == '1500 ml' and B.qty_norm('75 cl') == '750 ml' and B.qty_norm('12 sztuk') is None)
c = '5900000000017'
h, n = B.update_history({c: {'quantity': '360 g'}}, {}, '2026-10-20')
p2 = {c: {'quantity': '340 g'}}; h, n = B.update_history(p2, h, '2026-11-03')
t('zmiana gramatury wykryta', n == 1 and p2[c]['qchg'][-1][2] == '340 g' and p2[c]['qchg'][0][2] == '360 g', p2)
p3 = {c: {'quantity': '340g'}}; h, n = B.update_history(p3, h, '2026-11-10')
t('inny zapis tej samej gramatury to nie zmiana', n == 0 and len(h[c]) == 2, h[c])
h4, _ = B.update_history({}, h, '2026-11-17')
t('historia produktu znikniętego z bazy zostaje', c in h4)
t('złe dane w historii pominięte', B.update_history({}, {'abc': [['x']], c: 'zle'}, '2026-11-17')[0] == {})
mis = json.load(open(os.path.join(out, 'uzupelnij.json')))
t('misje: plik z kolejką', 0 < len(mis['items']) <= 500 and mis['count'] >= len(mis['items']), (len(mis['items']), mis.get('count')))
t('misje: najpopularniejsze najpierw', [x['s'] for x in mis['items']] == sorted([x['s'] for x in mis['items']], reverse=True))
t('misje: tylko gdy jest zdjęcie (s = skład, w = wartości)', all(x['k'] in ('s', 'w', 'sw') for x in mis['items']) and any(x['k'] == 'sw' for x in mis['items']))
t('polski kod bez „Polska”: tylko po polsku', B.polish_described({'lang': 'pl'}) and B.polish_described({'lang': 'fr', 'product_name_pl': 'Jabłka'}) and not B.polish_described({'lang': 'fr', 'product_name': 'Mousseline'}))
# Pusta wyszukiwarka nie może opublikować pustej kopii.
saved = DB[:]; DB.clear()
rc2 = B.main(['--out', tempfile.mkdtemp(), '--base', f'http://127.0.0.1:{srv.server_port}/search', '--pause', '0', '--prev-hist', '', '--hist-url', ''])
t('pusta odpowiedź: błąd, nie publikujemy', rc2 == 1, rc2)
DB.extend(saved)
shutil.rmtree(out)
print(f'build_data: {ok} OK, {fail} błędów')
sys.exit(1 if fail else 0)
