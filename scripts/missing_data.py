#!/usr/bin/env python3
"""Lupka – lista produktów z Polski w Open Food Facts, którym brakuje danych (do ręcznego uzupełniania).

Pobiera z wyszukiwarki search.openfoodfacts.org wszystkie produkty sprzedawane w Polsce (te same zapytania co
scripts/build_data.py) i zapisuje CSV: kod, nazwa, marka, popularność, czego brakuje i linki do uzupełnienia.
Brak liczymy z danych produktu (np. pusty skład, brak wartości odżywczych, brak zdjęcia) oraz ze stanów, które
Open Food Facts sam nadaje produktom („…-to-be-completed”).

Uruchamiany ręcznie przez GitHub Actions (.github/workflows/missing.yml). Tylko biblioteka standardowa Pythona.
Użycie: python3 scripts/missing_data.py --out braki.csv
"""
import argparse, csv, os, sys, time

sys.path.insert(0, os.path.dirname(__file__))
from build_data import Source, detect, partitions, text, tags, CODE_RE, COUNTRY, SEARCH  # noqa: E402

FIELDS = ('code,product_name,product_name_pl,brands,quantity,categories_tags,ingredients_n,ingredients_text,ingredients_text_pl,'
          'nutriments,image_front_url,image_ingredients_url,image_nutrition_url,states_tags,unique_scans_n,last_modified_t,completeness')
MAIN_NUT = ('energy-kcal_100g', 'energy_100g', 'fat_100g', 'carbohydrates_100g', 'proteins_100g', 'salt_100g', 'sugars_100g')
# Kolumna → (opis, czy brakuje: funkcja produktu i stanów)
CHECKS = [
    ('brak_nazwa', 'nazwa', lambda h, s: not (text(h.get('product_name_pl')) or text(h.get('product_name'))) or 'en:product-name-to-be-completed' in s),
    ('brak_marka', 'marka', lambda h, s: not text(h.get('brands')) or 'en:brands-to-be-completed' in s),
    ('brak_ilosc', 'ilość/gramatura', lambda h, s: not text(h.get('quantity')) or 'en:quantity-to-be-completed' in s),
    ('brak_kategoria', 'kategoria', lambda h, s: not tags(h.get('categories_tags')) or 'en:categories-to-be-completed' in s),
    ('brak_sklad', 'skład', lambda h, s: (not (h.get('ingredients_n') or text(h.get('ingredients_text_pl'), 20) or text(h.get('ingredients_text'), 20))) or 'en:ingredients-to-be-completed' in s),
    ('brak_wartosci', 'wartości odżywcze', lambda h, s: not any(isinstance((h.get('nutriments') or {}).get(k), (int, float)) for k in MAIN_NUT) or 'en:nutrition-facts-to-be-completed' in s),
    ('brak_foto_przod', 'zdjęcie przodu', lambda h, s: not text(h.get('image_front_url'), 400) or 'en:front-photo-to-be-selected' in s),
    # Wyszukiwarka nie zwraca adresów zdjęć składu i wartości, więc o tych brakach mówią tylko stany nadane przez Open Food Facts.
    ('brak_foto_sklad', 'zdjęcie składu', lambda h, s: 'en:ingredients-photo-to-be-selected' in s),
    ('brak_foto_wartosci', 'zdjęcie wartości odżywczych', lambda h, s: 'en:nutrition-photo-to-be-selected' in s),
]
COLS = ['kod', 'nazwa', 'marka', 'ilosc', 'popularnosc', 'ile_brakow', 'braki'] + [c[0] for c in CHECKS] + ['ostatnia_zmiana', 'link_lupka', 'link_off_edycja', 'link_off']


def row(h):
    code = str(h.get('code') or '')
    if not CODE_RE.match(code):
        return None
    st = set(tags(h.get('states_tags'), 80))
    miss = [(k, label) for k, label, f in CHECKS if f(h, st)]
    if not miss:
        return None
    lm = h.get('last_modified_t')
    r = {'kod': code, 'nazwa': text(h.get('product_name_pl')) or text(h.get('product_name')), 'marka': text(h.get('brands'), 120),
         'ilosc': text(h.get('quantity'), 60), 'popularnosc': int(h.get('unique_scans_n') or 0), 'ile_brakow': len(miss),
         'braki': ', '.join(label for _, label in miss),
         'ostatnia_zmiana': time.strftime('%Y-%m-%d', time.gmtime(lm)) if isinstance(lm, (int, float)) and lm > 0 else '',
         'link_lupka': f'https://lupka.app/#/p/{code}',
         'link_off_edycja': f'https://world.openfoodfacts.org/cgi/product.pl?type=edit&code={code}',
         'link_off': f'https://pl.openfoodfacts.org/produkt/{code}'}
    for k, _, _ in CHECKS:
        r[k] = 'brak' if any(k == m for m, _ in miss) else ''
    return r


def fetch(src, log=print):
    base_q = f'countries_tags:"{COUNTRY}"'
    total = detect(src, base_q)
    log(f'Produktów w Polsce: {total}; strona: {src.page_max}')
    parts = partitions(src, base_q)
    rows, seen, with_states = [], 0, 0
    for q, n in parts:
        hits = src.get(q, size=src.page_max, fields=FIELDS).get('hits') or []
        for h in hits:
            if isinstance(h, dict):
                seen += 1
                with_states += 1 if tags(h.get('states_tags')) else 0
                r = row(h)
                if r:
                    rows.append(r)
    log(f'Sprawdzono {seen} produktów (ze stanami OFF: {with_states}), z brakami: {len(rows)}')
    rows.sort(key=lambda r: (-r['popularnosc'], -r['ile_brakow'], r['kod']))
    return rows, seen


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='braki.csv')
    ap.add_argument('--base', default=SEARCH)
    ap.add_argument('--pause', type=float, default=0.2)
    ap.add_argument('--page-max', type=int, default=1000)
    a = ap.parse_args(argv)
    rows, seen = fetch(Source(a.base, a.pause, a.page_max))
    with open(a.out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    print(f'Zapisano {len(rows)} wierszy do {a.out} (sprawdzono {seen}).')
    return 0 if seen else 1


if __name__ == '__main__':
    sys.exit(main())
