# Lupka – zasady pracy dla Claude Code

Lupka to skaner składu produktów dla całej rodziny: aplikacja webowa (PWA) pod https://lupka.app/app/, strona promocyjna
pod https://lupka.app/ i aplikacja na Androida w Google Play (pakiet `app.lupka`, Trusted Web Activity – otwiera lupka.app/app/).
Właściciel: Rafał Mokrowiecki. **Pełny opis projektu, danych, wdrożenia i miejsc w kodzie: `docs/PRZEKAZANIE.md` – przeczytaj przed pierwszą zmianą.**

## Komunikacja
- Rozmawiaj z właścicielem **po polsku**, prosto i krótko. Teksty w aplikacji też po polsku.
- Zanim zmienisz **wygląd** (nowy element, układ, kolory), pokaż najpierw makietę lub zrzut i poczekaj na akceptację.
  Poprawki błędów i drobne zmiany tekstów możesz robić od razu.
- Mów uczciwie, czego nie sprawdziłeś (np. „nie testowałem na telefonie”). Nie zgaduj – sprawdź w kodzie.

## Zanim zaczniesz
1. `git pull` – kod mógł zmienić inny asystent (praca bywa też prowadzona w Claude w chmurze). Nigdy nie pracuj na starej wersji.
2. Repozytorium: `rafalmsolutions/dobre-czy-nie`, gałąź `main`. Publikacja = `git push` do `main` (GitHub Actions → GitHub Pages).

## Każda zmiana w aplikacji (`app/`)
- Podbij wersję w **dwóch** miejscach: `app/config.js` (`appVersion: 'X.Y.Z'`) i `app/sw.js` (`const VERSION = 'lupka-X.Y.Z'`).
- Dopisz sekcję na górze `README.md`: `## Tytuł (DD.MM.RRRR, wersja X.Y.Z)` + krótkie punkty po polsku, co się zmieniło dla użytkownika.
- Nowy plik ładowany przez aplikację → dopisz go też do listy `SHELL` w `app/sw.js`.
- Style dopisuj na końcu `app/d.css` blokiem z komentarzem wersji (`/* 3.0.13: … */`). `d.css` nadpisuje `styles.css`.
- Commity po polsku, w stylu: `3.0.13: krótki opis zmiany`.

## Testy (przed każdym `git push`)
- Testy przeglądarkowe: `tests/e2e-d-*.mjs` (Playwright). Jednorazowo: `npm i -D playwright` i `npx playwright install chromium`
  (w katalogu repozytorium; `node_modules/` jest w .gitignore).
- Uruchom serwer z katalogu głównego repozytorium: `python -m http.server 8790`, a w drugim terminalu w `tests/`: `node e2e-d-lista.mjs`
  (każdy plik osobno; ✓ = zaliczone, ✗ = błąd). Aplikacja testowa: http://localhost:8790/app/index.html.
- Testy jednostkowe – pełna lista w kroku „Testy” w `.github/workflows/pages.yml`, m.in. `node tests/unit-core.cjs`, `node tests/unit-v1.cjs`, `node tests/unit-d.cjs`,
  `node tests/pages-test.cjs`, `python scripts/test_build_data.py`. **Jeśli któryś nie przejdzie, strona się nie opublikuje.**
- Gdy zmieniasz zachowanie, popraw lub dopisz test (wzór: `tests/e2e-d-dict2.mjs`). Atrapy Open Food Facts i pośrednika: `tests/lib.mjs`.
- Po `git push` sprawdź, czy przebieg „Zbuduj i opublikuj” w Actions skończył się sukcesem (`gh run list` albo zakładka Actions).

## Czego nie robić bez zgody właściciela
- Nie wysyłaj danych użytkownika (profil, alergie, domownicy, historia, listy) na żaden serwer – zostają w telefonie (localStorage `dcn-*`).
  Tak obiecuje polityka prywatności (`privacy.html`) i deklaracja w Google Play. Każda nowa wysyłka danych = zmiana polityki i formularza w Play.
- Nie dodawaj trybu ciemnego (`color-scheme: only light` zostaje), reklam, kont ani narzędzi śledzących.
- Nie zmieniaj zasady „wynik rodziny = najsłabszy wynik osoby, nie średnia”.
- Nie dodawaj kart ani nagród za alkohol (ocena treści w Play: PEGI 3).
- Spokojny język: „na co dzień”, „od czasu do czasu”, nie „szkodliwe”. Ocena jest informacyjna, nie medyczna.
- Imiona w dopełniaczu („Nie dla Kuby”) przez `A.notFor` / `A.nameGen` w `app/family.js`.
- Tryb „Ukryj punkty i nagrody” (`A.quiet()`) musi chować każdy nowy dopisek z punktami.
- Nie publikuj niczego do Open Food Facts w testach.
- Nie ruszaj `.well-known/assetlinks.json` (odciski kluczy Google Play) ani `android/` bez powodu. Zmiany webowe NIE wymagają nowej wersji w Play.
- Nie zapisuj w repozytorium haseł, kluczy ani pliku keystore.

## Budowa kodu w skrócie
- Bez frameworka i bez budowania: pliki JS ładowane po kolei w `app/index.html`, globalny obiekt `App` (w plikach jako `A`).
- Router hash (`#/p/<kod>`, `#/polki`, `#/profil/…`, `#/najlepsze`, `#/lista/<tag>`, `#/album`) – `A.route` w `app/ui-base.js`.
- Kliknięcia przez atrybut `data-act` – obsługa w `app/ui-main.js` i w modułach (`A.startAction`, `A.shelfAction` itd.).
- Dane produktów: własna kopia z Open Food Facts w `lupka.app/data/` (budowana przez `scripts/build_data.py` przy publikacji).
- Szczegóły i lista miejsc w kodzie: `docs/PRZEKAZANIE.md`.
