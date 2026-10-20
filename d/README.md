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
