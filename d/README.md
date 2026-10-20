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
