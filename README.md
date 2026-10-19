# Dobre czy nie? – wersja 1.0

„Sprawdź skład w 2 sekundy”. Aplikacja webowa (PWA): skanujesz kod kreskowy jedzenia lub kosmetyku i od razu widzisz, czy produkt pasuje do Ciebie. Ziarenko kibicuje, a za mądre wybory zbierasz punkty i odznaki.

## Co jest w wersji 1.0

- **Start w 3 krokach:** cele (do 3), czego unikasz i imię. Można pominąć.
- **Dla Ciebie:** poziom, wyzwanie tygodnia, profil, „Najlepsze dla Ciebie”, „Zamień na lepsze”, ostatnio sprawdzone.
- **Najlepsze dla Ciebie:** 44 kategorie w 7 grupach na osobnym ekranie, z wyszukiwaniem. W kategorii sklepy działają jak filtr z liczbą produktów; sklep wpisują kupujący, więc dane są niepełne.
- **Po skanie:**
  - gra „Zgadnij: dobre czy nie?” (trafienie +10 pkt, pudło +3 pkt; można wyłączyć);
  - osobiste dopasowanie w procentach z powodami; bez celów i ograniczeń: ogólna ocena składu;
  - zdjęcie produktu na pełny ekran i „Zgłoś złe zdjęcie”;
  - przycisk „Na półkę”;
  - pełne szczegóły oceny z wersji 0.5;
  - zamienniki tylko z co najmniej dobrym dopasowaniem.
- **Brak produktu:** zachęta i nagroda odkrywcy (+50 pkt, odznaka, złota marchewka). Dodawanie działa po uruchomieniu pośrednika (folder `worker/`). Do tego czasu aplikacja prowadzi do aplikacji Open Food Facts.
- **Moje półki:**
  - 3 darmowe listy zakupów, ułożone według działów sklepu;
  - odhaczanie, „Usuń kupione”, udostępnianie;
  - +10 pkt za całą listę kupioną w sklepie.
- **Twoje postępy:** 6 poziomów, 9 odznak, statystyki, wyzwanie tygodnia, „Jak zdobyć punkty”.
- **Gratulacje na pełny ekran** po odznace, nowym poziomie i ukończonym wyzwaniu.
- **Profil:** cele, alergeny, diety, własne składniki, tryb bez ocen, wyłączenie zgadywania, „Usuń wszystkie moje dane”.

Kolejne wersje: ogródek Ziarenka i sklepik (1.1), mapa etapów (1.2), Plus i wspólne półki (1.3). Odznaki i poziomy na później są już w `config/` z oznaczeniem `inVersion`.

## Co jest w środku

| Plik | Do czego |
|---|---|
| `index.html`, `styles.css` | szkielet i wygląd |
| `ui-*.js` | ekrany: start i „Dla Ciebie”, produkt, półki, postępy i profil, obsługa zdarzeń |
| `core.js`, `data.js` | ocena składu, dopasowanie do profilu, baza dodatków i alergenów |
| `game.js`, `shelf.js` | punkty, odznaki, poziomy, wyzwania; półki |
| `art.js` | Ziarenko, ikony i medale (grafika wektorowa) |
| `config/*.json` | **punkty, poziomy, odznaki, wyzwania:** zmieniasz bez programowania |
| `config.js` | **ustawienia:** e-mail do zgłoszeń, adres pośrednika |
| `privacy.html` | polityka prywatności (uzupełnij pola na żółto) |
| `scripts/build_data.py` | kopia polskich produktów z Open Food Facts (uruchamia ją GitHub co tydzień) |
| `.github/workflows/pages.yml` | automat: testy, dane, publikacja na GitHub Pages |
| `worker/` | pośrednik do Open Food Facts (Cloudflare Worker) z instrukcją; potrzebny do dodawania produktów |
| `sw.js`, `manifest.webmanifest`, `icons/` | instalacja na telefonie i działanie bez internetu |

## Jak dodać odznakę albo poziom

Otwórz `config/achievements.json` i skopiuj jeden wpis. Zmień `id`, `name`, `description`, `metric`, `target` i `reward`, a w `inVersion` wpisz `1.0`. Poziomy są w `config/levels.json`. Aplikacja wczyta zmiany przy następnym otwarciu.

## Gdzie działa i jak się aktualizuje

Adres aplikacji: **https://rafalmsolutions.github.io/dobre-czy-nie/**

Wszystko robi GitHub (0 zł):

1. Po każdej zmianie w gałęzi `main` i w każdy poniedziałek rano automat `.github/workflows/pages.yml`:
   - uruchamia testy;
   - pobiera z Open Food Facts wszystkie produkty sprzedawane w Polsce (`scripts/build_data.py`);
   - publikuje aplikację razem z tą kopią na GitHub Pages.
2. Gdy Open Food Facts akurat nie odpowiada, automat publikuje ostatnią udaną kopię danych.
3. Ręczne odświeżenie: zakładka **Actions** → **Zbuduj i opublikuj** → **Run workflow**.

Kopia danych (folder `data/` na stronie):
- `data/p/123.json`: produkty, których kod kończy się na 123. Aplikacja pokazuje produkt od razu z kopii i w tle dociąga pełny skład z Open Food Facts.
- `data/c/en_yogurts.json`: do 200 najpopularniejszych produktów z kategorii (listy „Najlepsze”, porównanie, zamienniki).

Pośrednik w Cloudflare (`worker/`) jest potrzebny już tylko do dodawania brakujących produktów.

## Przed publikacją

- Uzupełnij w `privacy.html`: imię i nazwisko, adres i datę.
- Pośrednika najpierw sprawdź na serwerze testowym Open Food Facts.

## Testy

Uruchamiasz je w folderze `tests/`. Na hostingu nie są potrzebne.

- `node unit-core.cjs`: ocena składu.
- `node unit-v1.cjs`: punkty, odznaki, półki, dopasowanie.
- `node worker-test.mjs`: pośrednik.
- `node e2e.mjs`: wszystkie ekrany w przeglądarce, poprawne i złe użycie.
- `node sw-test.mjs`: działanie bez internetu.

Do `e2e.mjs` i `sw-test.mjs` potrzebny jest Playwright i lokalny serwer na porcie 8790.
