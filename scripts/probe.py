#!/usr/bin/env python3
"""Sondy do planowania (uruchamiane ręcznie w workflow „Próbka danych”): dokładne liczby produktów z polskim kodem
i sprawdzenie, czy Open Food Facts odczytuje tekst ze zdjęcia tabeli wartości odżywczych."""
import json, os, sys, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from build_data import Source, detect, partitions, SEARCH, UA  # noqa: E402

src = Source(SEARCH, 0.2, 1000)
out = {}
def exact(q):
    try:
        detect(src, q)
        return sum(n for _, n in partitions(src, q))
    except Exception as e:
        return f'błąd: {e}'
out['poland'] = exact('countries_tags:"en:poland"')
out['590'] = exact('code:590*')
for q in ['code:5901* AND NOT countries_tags:"en:poland"', 'code:5901* AND -countries_tags:"en:poland"', 'code:5901*', 'code:5901* AND countries_tags:"en:poland"']:
    out[q] = src.count(q)
out['590 bez PL'] = exact('code:590* AND NOT countries_tags:"en:poland"')
# Najpopularniejsze z polskim kodem bez oznaczenia „Polska”
d = src.get('code:590* AND NOT countries_tags:"en:poland"', size=20, fields='code,product_name,brands,unique_scans_n,countries_tags')
out['przyklady'] = [(h.get('code'), h.get('product_name'), h.get('brands'), h.get('unique_scans_n'), (h.get('countries_tags') or [])[:3]) for h in d.get('hits', [])]

def get(url, n=600):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode('utf-8', 'replace')[:n]
    except Exception as e:
        return 'err', str(e)[:300]
code = '5900197012723'
st, body = get(f'https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=images', 4000)
out['images'] = body
try:
    imgs = json.loads(body)['product']['images']
    nid = (imgs.get('nutrition_pl') or imgs.get('nutrition') or {}).get('imgid')
    out['nutrition_imgid'] = nid
    path = '/'.join([code[:3], code[3:6], code[6:9], code[9:]])
    for ext in ('json', 'json.gz'):
        out['ocr_' + ext] = get(f'https://images.openfoodfacts.org/images/products/{path}/{nid}.{ext}', 300)
except Exception as e:
    out['images_err'] = str(e)
out['ingredients.pl nutrition'] = get(f'https://world.openfoodfacts.org/cgi/ingredients.pl?code={code}&id=nutrition_pl&process_image=1&ocr_engine=google_cloud_vision', 1500)
out['ingredients.pl ingredients'] = get(f'https://world.openfoodfacts.org/cgi/ingredients.pl?code={code}&id=ingredients_pl&process_image=1&ocr_engine=google_cloud_vision', 600)
out['robotoff'] = get(f'https://robotoff.openfoodfacts.org/api/v1/insights?barcode={code}&type=nutrient_extraction', 1500)
print(json.dumps(out, ensure_ascii=False, indent=1))
