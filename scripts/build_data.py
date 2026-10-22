#!/usr/bin/env python3
"""Dobre czy nie? – własna kopia polskich produktów z Open Food Facts.

Uruchamiany co tydzień przez GitHub Actions (plik .github/workflows/pages.yml).
Pobiera z wyszukiwarki search.openfoodfacts.org wszystkie produkty sprzedawane w Polsce
i zapisuje je jako małe pliki JSON publikowane razem z aplikacją:

  data/meta.json          – data budowy i liczby produktów
  data/p/123.json         – produkty, których kod kończy się na 123 (szybki odczyt po kodzie)
  data/c/en_yogurts.json  – do 200 najpopularniejszych produktów z kategorii (listy i porównania)

Dzięki temu porównanie, zamienniki i listy „Najlepsze” działają od razu, nawet gdy
serwery Open Food Facts są przeciążone. Dane: Open Food Facts, licencja ODbL.

Użycie: python3 scripts/build_data.py --out site/data [--base URL] [--limit N]
Tylko biblioteka standardowa Pythona.
"""
import argparse, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict

SEARCH = 'https://search.openfoodfacts.org/search'
UA = 'DobreCzyNie-data/1.0 (rafalmsolutions@gmail.com)'
COUNTRY = 'en:poland'
WINDOW = 10000        # wyszukiwarka liczy dokładnie najwyżej do 10 000 wyników
CAT_MAX = 200         # produktów w pliku kategorii
CAT_MIN = 5           # kategorie z mniejszą liczbą produktów pomijamy (za mało do porównania)
FIELDS = ('code,product_name,product_name_pl,brands,quantity,image_front_small_url,image_front_url,nutriscore_grade,'
          'nova_group,ingredients_tags,ingredients_n,allergens_tags,traces_tags,ingredients_analysis_tags,labels_tags,'
          'nutriments,categories_tags,categories,stores,unique_scans_n,states_tags,lang')
NUTRIMENTS = ['energy-kcal_100g', 'fat_100g', 'saturated-fat_100g', 'sugars_100g', 'salt_100g', 'proteins_100g',
              'fiber_100g', 'carbohydrates_100g', 'alcohol_100g']
CODE_RE = re.compile(r'^\d{8,14}$')
TAG_RE = re.compile(r'^[a-z]{2}:[a-z0-9-]{2,60}$')


class HttpError(Exception):
    pass


class Source:
    """Zapytania do wyszukiwarki z ponawianiem i krótką przerwą między zapytaniami."""

    def __init__(self, base, pause, page_max=1000):
        self.base, self.pause, self.calls, self.page_max = base, pause, 0, page_max
        self.prefix_style = 'wildcard'

    def get(self, query, size=1, fields='code'):
        params = urllib.parse.urlencode({'q': query, 'page': 1, 'page_size': size, 'fields': fields})
        url = f'{self.base}?{params}'
        last = None
        for attempt in range(6):
            try:
                self.calls += 1
                req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
                with urllib.request.urlopen(req, timeout=90) as r:
                    data = json.loads(r.read().decode('utf-8'))
                if not isinstance(data, dict) or 'hits' not in data:
                    raise ValueError('bad response: ' + str(data)[:200])
                time.sleep(self.pause)
                return data
            except urllib.error.HTTPError as e:
                if 400 <= e.code < 500 and e.code != 429:
                    raise HttpError(f'HTTP {e.code}: {e.read()[:300]!r}')
                last = e
            except Exception as e:  # sieć, 5xx, zły JSON
                last = e
            time.sleep(min(60, 2 ** attempt * 2))
        raise RuntimeError(f'Wyszukiwarka nie odpowiada: {query}: {last}')

    def count(self, query):
        d = self.get(query, size=1)
        return int(d.get('count') or 0), bool(d.get('is_count_exact', True))

    def prefix_q(self, prefix):
        # Zakres po kodach działa jak prefiks: wszystkie kody zaczynające się od „590” leżą między „590” a „590z”.
        return f'code:{prefix}*' if self.prefix_style == 'wildcard' else f'code:[{prefix} TO {prefix}z]'


def detect(src, base_q):
    """Sprawdza, jaki największy rozmiar strony i jaki zapis prefiksu kodu przyjmuje wyszukiwarka."""
    for size in (src.page_max, 500, 200, 100):
        try:
            src.get(base_q, size=size)
            src.page_max = size
            break
        except HttpError:
            continue
    total, _ = src.count(base_q)
    for style in ('wildcard', 'range'):
        src.prefix_style = style
        try:
            parts = sum(src.count(base_q + ' AND ' + src.prefix_q(d))[0] for d in '0123456789')
        except HttpError:
            continue
        if parts >= min(total, WINDOW) * 0.98:
            return total
    raise RuntimeError('Wyszukiwarka nie pozwala dzielić zapytań po kodach – nie da się pobrać wszystkich produktów.')


def partitions(src, base_q, prefix='', depth=0):
    """Dzieli zapytanie po początkowych cyfrach kodu, aż każda część mieści się na jednej stronie wyników."""
    q = base_q + (' AND ' + src.prefix_q(prefix) if prefix else '')
    n, exact = src.count(q)
    if n == 0:
        return []
    if (n <= src.page_max and exact) or depth >= 14:
        return [(q, n)]
    out = []
    for d in '0123456789':
        out += partitions(src, base_q, prefix + d, depth + 1)
    got = sum(x for _, x in out)
    if got < min(n, WINDOW) * 0.98:
        raise RuntimeError(f'Podział zapytania zgubił produkty: {q} ma {n}, części razem {got}.')
    return out


def text(v, n=200):
    if isinstance(v, list):
        v = ', '.join(str(x) for x in v if isinstance(x, (str, int, float)))
    # Część nazw w bazie ma encje HTML („Czekolad&#261;”): zamieniamy je na litery.
    return html.unescape(v).strip()[:n] if isinstance(v, str) else ''


def tags(v, n=40):
    return [x for x in v if isinstance(x, str)][:n] if isinstance(v, list) else []


def compact(h):
    """Tylko pola, których używa aplikacja, w kształcie jak w API Open Food Facts."""
    code = str(h.get('code') or '')
    if not CODE_RE.match(code):
        return None
    name = text(h.get('product_name_pl')) or text(h.get('product_name'))
    if not name:
        return None
    n = h.get('nutriments') if isinstance(h.get('nutriments'), dict) else {}
    nut = {}
    for k in NUTRIMENTS:
        v = n.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0:
            nut[k] = round(float(v), 3)
    ing = tags(h.get('ingredients_tags'), 200)
    stores = h.get('stores')
    stores = stores.split(',') if isinstance(stores, str) else stores if isinstance(stores, list) else []
    nova = h.get('nova_group')
    p = {
        'code': code, 'product_name': name, 'brands': text(h.get('brands'), 80), 'quantity': text(h.get('quantity'), 40),
        'image_front_small_url': text(h.get('image_front_small_url'), 300), 'image_front_url': text(h.get('image_front_url'), 300),
        'nutriscore_grade': text(h.get('nutriscore_grade'), 20), 'nova_group': nova if isinstance(nova, int) and 1 <= nova <= 4 else None,
        # Dodatki E z listy składników; gdy składu brak – „nie wiadomo” (null).
        'additives_tags': [t for t in ing if re.match(r'^en:e\d{3}', t)] if (ing or h.get('ingredients_n')) else None,
        'allergens_tags': tags(h.get('allergens_tags')), 'traces_tags': tags(h.get('traces_tags')),
        'ingredients_analysis_tags': tags(h.get('ingredients_analysis_tags')), 'labels_tags': tags(h.get('labels_tags')),
        'nutriments': nut, 'categories_hierarchy': [t for t in tags(h.get('categories_tags'), 60) if TAG_RE.match(t)],
        'categories': text(h.get('categories'), 300),
        'stores': [s.strip()[:40] for s in stores if isinstance(s, str) and s.strip()][:10],
    }
    # Puste pola usuwamy, żeby pliki były mniejsze.
    return {k: v for k, v in p.items() if v not in ('', [], {}) or k in ('additives_tags',) and v == []}, int(h.get('unique_scans_n') or 0)


# Produkty z polskim kodem (590…), którym w bazie brakuje oznaczenia „Polska” (ok. 12,6 tys. w X 2026).
# Bierzemy tylko te opisane po polsku (język produktu „pl” albo polska nazwa), żeby na listach nie było francuskich nazw.
PL_CODE_Q = f'code:590* AND NOT countries_tags:"{COUNTRY}"'


def polish_described(h):
    return h.get('lang') == 'pl' or bool(text(h.get('product_name_pl')))


# Do uzupełnienia bez produktu w ręku: zdjęcie jest w bazie, przepisanego tekstu brak.
def needs(st, pl=True):
    # Skład przepisujemy po polsku, więc tylko przy produktach opisanych po polsku; tabela wartości to same liczby.
    k = ''
    if pl and 'en:ingredients-to-be-completed' in st and 'en:ingredients-photo-selected' in st:
        k += 's'
    if 'en:nutrition-facts-to-be-completed' in st and 'en:nutrition-photo-selected' in st:
        k += 'w'
    return k


def fetch_all(src, limit=None, log=print, states=None):
    base_q = f'countries_tags:"{COUNTRY}"'
    total = detect(src, base_q)
    log(f'Produktów w Polsce (wg wyszukiwarki): {total}; strona: {src.page_max}; prefiks: {src.prefix_style}')
    parts = partitions(src, base_q)
    log(f'Części zapytania: {len(parts)}, produktów razem: {sum(n for _, n in parts)}')
    try:
        extra = partitions(src, PL_CODE_Q)
    except Exception as e:  # dodatek: przy kłopocie z wyszukiwarką publikujemy samą Polskę
        log(f'Polskie kody bez oznaczenia „Polska”: pominięte ({e})')
        extra = []
    log(f'Polskie kody bez oznaczenia „Polska”: {sum(n for _, n in extra)} w {len(extra)} częściach')
    products, pop = {}, {}
    added = 0
    for q, n in parts + [(q, n) for q, n in extra]:
        is_extra = q.startswith(PL_CODE_Q)
        try:
            d = src.get(q, size=src.page_max, fields=FIELDS)
            hits = d.get('hits') or []
            if len(hits) < min(n, src.page_max) * 0.98:
                raise RuntimeError(f'Za mało wyników dla {q}: {len(hits)} z {n}')
        except Exception as e:
            if not is_extra:
                raise
            log(f'Pominięta część z polskim kodem: {e}')
            continue
        for h in hits:
            if not isinstance(h, dict) or (is_extra and (str(h.get('code')) in products or not polish_described(h))):
                continue
            r = compact(h)
            if r:
                p, scans = r
                products[p['code']] = p
                pop[p['code']] = scans
                added += 1 if is_extra else 0
                if states is not None:
                    k = needs(set(tags(h.get('states_tags'), 80)), polish_described(h))
                    if k:
                        states[p['code']] = k
        if limit and len(products) >= limit:
            break
    log(f'Dodane z polskim kodem: {added}')
    return products, pop


def write_missions(products, pop, states, out, built, top=500):
    """data/uzupelnij.json: najpopularniejsze produkty do uzupełnienia ze zdjęć (misje w aplikacji)."""
    codes = sorted((c for c in states if c in products), key=lambda c: (-pop.get(c, 0), c))[:top]
    items = [{'c': c, 'n': products[c].get('product_name', ''), 'b': products[c].get('brands', ''), 'i': products[c].get('image_front_small_url', ''),
              's': int(pop.get(c, 0)), 'k': states[c]} for c in codes]
    write_json(os.path.join(out, 'uzupelnij.json'), {'built': built, 'count': len(states), 'items': items})
    return len(items)


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def scan_tiers(pop):
    """Progi rzadkości: epicka = 10% najrzadziej skanowanych produktów, rzadka = do 40%, reszta zwykła."""
    vals = sorted(int(v or 0) for v in pop.values())
    if not vals:
        return {'epic': 2, 'rare': 10}
    q = lambda f: vals[min(len(vals) - 1, int(f * (len(vals) - 1)))]
    epic = max(1, q(0.10))
    return {'epic': epic, 'rare': max(epic + 1, q(0.40))}


QTY_RE = re.compile(r'(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|ml|cl|dl)(?![a-ząćęłńóśźż])', re.I)
QTY_UNIT = {'kg': (1000, 'g'), 'g': (1, 'g'), 'mg': (0.001, 'g'), 'l': (1000, 'ml'), 'ml': (1, 'ml'), 'cl': (10, 'ml'), 'dl': (100, 'ml')}
HIST_URL = 'https://rafalmsolutions.github.io/dobre-czy-nie/data/qhist.json'


def qty_norm(q):
    """Gramatura do porównań: '4 x 125 g' → '500 g', '1,5 l' → '1500 ml'. None, gdy nie da się odczytać."""
    m = QTY_RE.search(q or '')
    if not m:
        return None
    n = int(m.group(1)) if m.group(1) else 1
    f, unit = QTY_UNIT[m.group(3).lower()]
    v = round(n * float(m.group(2).replace(',', '.')) * f, 1)
    if v <= 0 or v > 100000:
        return None
    return f'{v:g} {unit}'


def update_history(products, prev, day):
    """Historia gramatur (skurczflacja): [data, tekst z etykiety, gramatura]. Nowy wpis tylko przy zmianie gramatury."""
    hist = {}
    for code, h in (prev or {}).items():
        if isinstance(h, list) and CODE_RE.match(str(code)):
            ok = [x for x in h if isinstance(x, list) and len(x) == 3 and all(isinstance(y, str) for y in x)]
            if ok:
                hist[code] = ok[-6:]
    changed = 0
    for code, p in products.items():
        qn = qty_norm(p.get('quantity'))
        if not qn:
            continue
        h = hist.get(code, [])
        if not h:
            hist[code] = [[day, p.get('quantity', '')[:40], qn]]
        elif h[-1][2] != qn:
            hist[code] = (h + [[day, p.get('quantity', '')[:40], qn]])[-6:]
            changed += 1
        if len(hist[code]) > 1:
            p['qchg'] = hist[code][-3:]
    return hist, changed


def load_prev_hist(path=None, url=HIST_URL, log=print):
    try:
        if path and os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                return json.load(f)
        if url:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode('utf-8'))
    except Exception as e:  # brak historii to nie błąd: zaczynamy od dziś
        log(f'Historia gramatur: brak poprzedniej ({e.__class__.__name__}).')
    return {}


def build(products, pop, out, built=None, log=print, prev_hist=None):
    # Liczba skanów w Open Food Facts: z niej wersja D liczy rzadkość karty w albumie.
    for code, p in products.items():
        if pop.get(code):
            p['unique_scans_n'] = int(pop[code])
    built = built or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    hist, changed = update_history(products, prev_hist or {}, built[:10])
    write_json(os.path.join(out, 'qhist.json'), hist)
    log(f'Historia gramatur: {len(hist)} produktów, {changed} zmian od poprzedniej kopii.')
    shards = defaultdict(dict)
    for code, p in products.items():
        shards[code[-3:]][code] = p
    for key, items in shards.items():
        write_json(os.path.join(out, 'p', key + '.json'), items)
    cats = defaultdict(list)
    for code, p in products.items():
        for t in p.get('categories_hierarchy', []):
            cats[t].append(code)
    written = 0
    for t, codes in cats.items():
        if len(codes) < CAT_MIN:
            continue
        codes.sort(key=lambda c: (-pop.get(c, 0), c))
        write_json(os.path.join(out, 'c', t.replace(':', '_') + '.json'),
                   {'tag': t, 'count': len(codes), 'products': [products[c] for c in codes[:CAT_MAX]]})
        written += 1
    meta = {'built': built, 'country': COUNTRY,
            'products': len(products), 'categories': written, 'source': 'Open Food Facts (ODbL)',
            'scanTiers': scan_tiers(pop)}
    write_json(os.path.join(out, 'meta.json'), meta)
    log(f'Zapisano: {len(products)} produktów w {len(shards)} plikach, {written} kategorii.')
    return meta


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='site/data')
    ap.add_argument('--base', default=SEARCH)
    ap.add_argument('--pause', type=float, default=0.2)
    ap.add_argument('--page-max', type=int, default=1000)
    ap.add_argument('--limit', type=int, default=None, help='tylko do testów: zatrzymaj po N produktach')
    ap.add_argument('--min-products', type=int, default=1000, help='przerwij, jeśli pobrano mniej (chroni przed opublikowaniem pustej kopii)')
    ap.add_argument('--prev-hist', default='datacache/qhist.json', help='historia gramatur z poprzedniej kopii')
    ap.add_argument('--hist-url', default=HIST_URL, help='zapas: historia z opublikowanej strony; pusty = bez')
    a = ap.parse_args(argv)
    src = Source(a.base, a.pause, a.page_max)
    states = {}
    products, pop = fetch_all(src, a.limit, states=states)
    if len(products) < a.min_products:
        print(f'Za mało produktów ({len(products)} < {a.min_products}). Nie publikuję.', file=sys.stderr)
        return 1
    meta = build(products, pop, a.out, prev_hist=load_prev_hist(a.prev_hist, a.hist_url))
    print(f'Do uzupełnienia ze zdjęć: {len(states)}, w kolejce: {write_missions(products, pop, states, a.out, meta["built"])}')
    print(f'Zapytań do wyszukiwarki: {src.calls}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
