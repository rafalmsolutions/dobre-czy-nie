# Dobre czy nie? – wersja D (do porównania)

Druga wersja aplikacji w wyglądzie D „Wystawa”: jasnoszare tło, produkt na okrągłym „talerzu”, nazwa w dwóch grubościach,
szklane karty, kwadrat oceny w kolorze werdyktu i pastelowy łuk w tle. Bez maskotki.

Adres: https://rafalmsolutions.github.io/dobre-czy-nie/d/

- Główna aplikacja zostaje bez zmian. Ten folder to osobna kopia plików.
- Obie wersje korzystają z tej samej kopii bazy (`../data/`) i tych samych plików `../config/`.
- Profil, historia, półki i punkty są wspólne (ta sama pamięć przeglądarki), więc łatwo porównać te same produkty.
- Statystyki GoatCounter: ekrany wersji D mają ścieżki `/d/…`, a zdarzenia przedrostek `d-`.
- Nowy wygląd: `d.css` (nakłada się na `styles.css`). Zmiany w kodzie ekranów: `ui-product.js` (nagłówek produktu, kwadrat oceny,
  kolumna boczna na komputerze), `ui-home.js` (duży przycisk skanowania), `ui-base.js` (bez maskotki, ścieżki do danych), `art.js` (nagłówki zamiast wstęg).
- Poprawki w głównej aplikacji nie trafiają tu same. Jeśli wybierzesz wersję D, przeniesiemy wygląd do głównej aplikacji.
- Zdjęcia kategorii: `img/cat/*.webp` (44 talerze z góry, wygenerowane w ChatGPT, 480 px, ok. 30 KB każde). Nazwa pliku to klucz kategorii bez `en:`.
  Używane na kaflach „Najlepsze dla Ciebie”, na liście kategorii, w nagłówku listy, w nagłówku produktu (zdjęcie opakowania z bazy jest małą miniaturą do powiększenia)
  i w „Ostatnio sprawdzonych”. Produkt bez pasującej kategorii pokazuje zdjęcie z bazy na talerzu.
- Gdy baza nie podaje kategorii, zdjęcie dobierane jest po nazwie produktu (`NAME_RULES` w `ui-base.js`, np. „parówki” → `sausages`).
- Medale, poziom i ikony celów są płaskie i spokojne (`art.js` nadpisuje `medalSvg` i `shieldSvg`).

## Profil „Nie jem” + „Pilnuję” (tylko w wersji D)

- Własny profil (`dcn-d-profile`); za pierwszym razem przenosimy ustawienia z głównej aplikacji (`migrateProfileD` w `core.js`).
- **Nie jem:** alergeny, 4 diety (wegańska, wegetariańska, bez glutenu, bez laktozy), wieprzowina, alkohol, własne składniki → 0–10%, śladowe ilości najwyżej 35%.
- **Pilnuję** (do 6, lista `WATCH` w `data.js`): mało +5, średnio −10 (maks. 74%), dużo −25 (maks. 45%); „zawiera” −25 (maks. 45%); białko/błonnik +10/+5; brak danych maks. 70%. Produkt bez wykluczeń ma co najmniej 12%.
- **Cele** to skróty: zaznaczają pozycje „Pilnuję” (`GOALS[].watch`).
- Przy produkcie wyjaśnienie jak rachunek: ocena składu, każda pozycja z punktami, wynik i ewentualny limit.
- Testy spójności: `tests/unit-d.cjs`.

## Odznaki (tylko w wersji D)

- `achievements.json`: 17 odznak × 3 stopnie (brąz, srebro, złoto), nagrody 10/25/50 pkt. Nowe liczniki w `A.extraMetrics` (`ui-base.js`).
- Medale (`art.js`): obręcz w kolorze stopnia, błysk co kilka sekund, przy zdobyciu medal wskakuje i rysuje ikonę. Przy ograniczeniu ruchu animacje są wyłączone.

## Dźwięki i wibracje (tylko w wersji D)

- Generowane w przeglądarce (Web Audio, `A.sound` w `ui-base.js`), bez plików i licencji.
- Skan, trafiony/nietrafiony typ, odłożenie na półkę, nowa odznaka (złoto ma dłuższą melodię), nowy poziom, wyzwanie. Na Androidzie także wibracje.
- Przełącznik „Dźwięki i wibracje” w profilu (`settings.sound`). Na iPhonie przełącznik wyciszenia w telefonie też wycisza aplikację.

## Album odkryć (tylko w wersji D)

- Każdy sprawdzony produkt to karta (`album.js`, stan w `d-album`). Nowa karta → nakładka „Nowa karta” (stuknij, żeby odsłonić), potem punkty.
- Rzadkość losowana raz na zawsze (telefon + produkt); rzadko skanowane produkty (`unique_scans_n` z Open Food Facts) mają większe szanse: 0–1 skanów → 9% epickich i 26% rzadkich, 2–9 → 6% / 22%, 10+ → 3% / 17%. Same progi z rozkładu nie działały, bo połowa polskich produktów ma 0 skanów. Legendarna = produkt dodany przez Ciebie. Błysk ✦ ok. 1 na 20 kart, losowany raz na zawsze (identyfikator telefonu + kod).
- Szkic = w bazie brakuje składu albo wartości; po uzupełnieniu karta ożywa.
- Strony = 50 kategorii ze zdjęciami talerzy (w tym Piwo, Śmietana, Jajka, Mięso, Owoce, Warzywa – tylko w D), po 10 miejsc; pełna strona: gratulacje, +100 pkt, odznaka „Kolekcjoner”. Dodatkowe strony bez limitu: Różne, Kosmetyki.
- Karta tygodnia: jedna kategoria na tydzień, złota ramka i +30 pkt.
- Punkty za karty (raz na produkt): zwykła 2, rzadka 5, epicka 15, legendarna 50, błysk +20; reguły w `A.ALBUM_RULES` (`ui-base.js`). Krople ukryte.
- Zakładka „Album” zastąpiła „Postępy” (odznaki i poziom: link w albumie i gwiazdka z punktami).
- Test w przeglądarce: `tests/e2e-d-album.mjs`.

## Galeria (test, 20.10.2026)

- Trzy strony albumu (Czekolady, Jogurty, Pieczywo) mają obraz z ChatGPT (`d/img/gal/*.webp`, 800×1000) zamiast samego talerza.
- Obraz jest podzielony na 10 fragmentów (2 × 5); każda karta z tej strony odsłania kolejny (kolejność w `ORDER` w `ui-album.js`, środek na koniec).
- Odsłonięcie po skanie pokazuje miniaturę obrazu z animacją nowego fragmentu; pełna strona pokazuje cały obraz w złotej ramie.
- Na stronie albumu przycisk „Podgląd: odsłoń cały obraz (test)” odsłania resztę bez zmiany danych.
- Nowy obraz: plik `d/img/gal/<klucz>.webp` i wpis w `GALLERY` w `ui-album.js`.

## Polowanie, profile rodziny, odkrywcy, gramatury (20.10.2026, wieczór)

- **Polowanie** (`album.js`): każda strona ma 10 miejsc z warunkami (podkategorie z polską nazwą, Nutri-Score, NOVA, bez dodatków, bez oleju palmowego, wegańskie, bio, fair trade, mało cukru/soli/tłuszczu, dużo białka/błonnika). Rzadkość miejsca = udział pasujących wśród popularnych produktów kategorii zgodnych z profilem: zwykłe ≥ 1/3, rzadkie ≥ 1/12, epickie ≥ 1/50, legendarne rzadziej. Jedno tajne miejsce (rzadkie/epickie), podpowiedź po 5 skanach. Produkt trafia na najtrudniejsze wolne miejsce, do którego pasuje. Lista miejsc jest zapamiętywana (`d-album.pages`); po zmianie profilu wolne miejsca dobieramy od nowa.
- **Zgodność z profilem:** kartę daje tylko produkt bez „Nie jem” i bez „dużo” tego, czego pilnujesz. Strony wykluczone dietą/alergią (np. nabiał przy diecie wegańskiej) są ukryte.
- **Plakaty:** `d/img/gal/*.webp`, wpis w `GALLERY` (`ui-album.js`); miejsce nr i odsłania fragment `ORDER[i]`.
- **Profile rodziny** (`family.js`): do 4 domowników z własnym „Nie jem” i „Pilnuję” (klucz `d-family`); przy produkcie sekcja „Dla domowników”. Album liczy się według profilu „Ja”.
- **Odkrywcy** (`disc.js`, pośrednik `worker/disc.js`, baza Cloudflare D1 `dcn-odkrywcy`, schemat `worker/schema.sql`):
  - przy dodawaniu: kod ze zdjęcia = kod ze skanu (inny kod blokuje wysyłkę), nazwa bez wulgaryzmów, skład zgodny z odczytem zdjęcia, kalorie zgodne z makroskładnikami;
  - +10 pkt od razu, +50 po 2 potwierdzeniach (+100 za produkt z listy „Poszukiwane”), +1 za każdą osobę, która sprawdzi produkt (do 100);
  - „Czy trzymasz ten produkt?” tylko po skanie aparatem: +5 za „tak” i „nie”, +2 za „nie mam pewności”, do 10 dziennie;
  - zaufany odkrywca (3 potwierdzone, 0 odrzuconych): od razu potwierdzony, gdy kod był widoczny na zdjęciu;
  - ekran `#/odkrycia`: status, lista „Poszukiwane”, pseudonim.
- **Gramatury:** `scripts/build_data.py` zapisuje `data/qhist.json` i pole `qchg` w produktach, gdy gramatura zmieni się między kopiami bazy; produkt pokazuje „Mniej w opakowaniu”.
