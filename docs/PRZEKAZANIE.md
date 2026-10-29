# Lupka – przekazanie projektu (stan na 29.10.2026, wersja aplikacji 3.0.12)

Dokument dla asystenta, który przejmuje poprawki. Wszystko poniżej sprawdzone w kodzie z commita w gałęzi `main`
repozytorium https://github.com/rafalmsolutions/dobre-czy-nie (publiczne). Tam, gdzie czegoś nie wiadomo, jest to napisane.

## 1. Kod źródłowy

### Gdzie jest kod

- **Jedyne źródło prawdy: repozytorium GitHub `rafalmsolutions/dobre-czy-nie`, gałąź `main`.** Strona lupka.app jest
  budowana automatycznie z tej gałęzi (patrz punkt 3). Najprościej: `git clone https://github.com/rafalmsolutions/dobre-czy-nie`.
- Paczka ZIP z tym samym stanem (bez katalogu `.git`) jest dołączona do rozmowy: `lupka-kod-<commit>.zip`.
- **Kopia lokalna na komputerze z Windows: nie wiem, czy istnieje.** Pracowałem w chmurze (Linux, `/home/claude/dobre-czy-nie`).
  Jeśli na dysku jest folder „lupka-android” albo inny, to nie pochodzi ode mnie – w repozytorium projekt Androida jest w `android/`.
- Do wypychania zmian (`git push`) potrzebne są uprawnienia do konta GitHub `rafalmsolutions` (logowanie Rafała).

### Struktura katalogów (repozytorium = to, co trafia na serwer, z wyjątkami niżej)

```
/                         strona promocyjna lupka.app
  index.html              strona główna (PL/EN, cały CSS i JS w pliku)
  privacy.html            polityka prywatności
  usun-dane.html          instrukcja usuwania danych (link w Google Play)
  testuj/index.html       instrukcja dla testerów Google Play
  jak-liczymy/, kategorie/, lupka-czy-yuka/, aplikacje-do-sprawdzania-skladu/   GENEROWANE przez scripts/build_pages.cjs
  sitemap.xml, robots.txt, llms.txt, icon*.png, icon.svg
  sw.js                   stary service worker z adresu głównego – tylko sprząta i się wyrejestrowuje
  img/                    obrazki strony (zrzuty aplikacji *.webp, og.jpg, film lupka-film.mp4/.webm)
  .well-known/assetlinks.json   powiązanie domeny z aplikacją Android (NIE ZMIENIAĆ odcisków SHA-256)
  config/                 konfiguracja gry wczytywana przez aplikację: points-rules.json, levels.json,
                          achievements.json, weekly-challenges.json (+ atlas.json, map-stages.json, shop-items.json – stare, nieużywane w /app/)
  app/                    APLIKACJA (lupka.app/app/)
    index.html            szkielet, kolejność <script>, ekrany (sekcje id="scr-…"), okna
    styles.css            style bazowe (starsze)
    d.css                 style „wersji D” – nadpisują styles.css; nowe zmiany dopisywane blokami na końcu z komentarzem wersji
    config.js             ustawienia (wersja appVersion, adres pośrednika, e-maile, GoatCounter)
    data.js               słowniki: alergeny, diety, dodatki E, cele (GOALS, GOALS_MAX), WATCH, SHOP_CATEGORIES, DEPARTMENTS, STORES
    core.js               analiza produktu (analyze), dopasowanie (personalMatch), departmentFor, cleanProfile, normalizeProduct
    game.js               punkty, poziomy, odznaki, wyzwania (konfiguracja z config/*.json)
    shelf.js              listy zakupów (czyste funkcje: addItem, setQty, renameItem, splitSpeech…)
    art.js                grafiki SVG (medale, maskotka)
    ui-base.js            router (#/…), magazyn (A.store, prefiks localStorage „dcn-”), pobieranie danych, skaner, świętowanie, toast
    album.js, ui-album.js karty i album („Karty”)
    family.js             domownicy, wynik rodziny, odmiana imion (nameGen, notFor)
    disc.js               „Odkrywcy”: potwierdzanie nowych produktów (serwer Cloudflare D1)
    ui-home.js            Start, pierwsze uruchomienie (onboarding), „Najlepsze” (#/najlepsze), listy kategorii (#/lista/…)
    ui-product.js         ekran produktu, porównanie w kategorii, zamienniki, dodawanie produktu
    ui-shelves.js         ekran list zakupów (#/polki), dyktowanie
    ui-progress.js        Profil (#/profil/…), postępy
    ui-complete.js        uzupełnianie brakujących danych
    ui-compare.js         porównanie i wyszukiwarka
    ui-main.js            obsługa kliknięć (data-act), formularzy i klawiatury
    sw.js                 service worker aplikacji (VERSION = 'lupka-3.0.12')
    manifest.webmanifest, achievements.json, icon*.png, sfx/*.mp3 (CC0), img/cat/*.webp (zdjęcia kategorii)
  d/                      stary adres (przekierowanie)
  archiwum/               stare wersje plików – nie wdrażać zmian tutaj
  worker/                 pośrednik Cloudflare Worker (off-proxy.js, disc.js, schema.sql) – NIE trafia na stronę
  scripts/                build_data.py (dane), build_pages.cjs (podstrony), missing_data.py, probe.py – NIE trafia na stronę
  tests/                  testy (Playwright e2e-d-*.mjs, unit-*.cjs) – NIE trafia na stronę
  android/                projekt Androida (Bubblewrap/TWA) – NIE trafia na stronę
  .github/workflows/      automaty: pages.yml (budowa i publikacja), android.yml, worker.yml, audit.yml, missing.yml, sample.yml
  docs/                   ten dokument
  README.md               historia zmian wersja po wersji (najnowsze na górze)
```

Na serwerze dochodzi katalog **`data/`**, którego nie ma w repozytorium – tworzy go automat przy każdej publikacji (punkt 2).

## 2. Dane produktów (lupka.app/data/)

### Jak powstają

- Skrypt: **`scripts/build_data.py`** (Python 3, tylko biblioteka standardowa).
- Źródło: wyszukiwarka Open Food Facts `https://search.openfoodfacts.org/search`, wszystkie produkty z `countries_tags:en:poland`
  (plus produkty z kodem 590…, które mają polski opis). Dzieli zapytania na partie (wyszukiwarka zwraca max 10 000 wyników na zapytanie).
- Wynik:
  - `data/meta.json` – data budowy, liczba produktów i kategorii, progi popularności (scanTiers).
  - `data/p/NNN.json` – produkty, których kod kończy się na NNN (trzy ostatnie cyfry); szybki odczyt po kodzie.
  - `data/c/<tag>.json` (np. `en_yogurts.json`) – **dla każdego tagu z `categories_hierarchy` produktów** (dosłownie tagi OFF, bez
    żadnego mapowania), który ma **co najmniej 5 produktów**; w pliku do **200 najpopularniejszych** produktów (wg liczby skanów).
    Kategorii z mniej niż 5 polskimi produktami **nie ma pliku** – stąd 404.
  - `data/stores.json` (nazwy sklepów z produktów), `data/qhist.json` (historia gramatur), `data/uzupelnij.json` (misje uzupełniania).
- Uruchomienie lokalne: `python3 scripts/build_data.py --out site/data` (opcje: `--limit N` do testów, `--pause 0.2`,
  `--min-products 1000` – przerywa, gdy pobierze mniej). Pełne pobranie trwa kilkadziesiąt minut.
- Próbka danych do pracy lokalnej (bez pełnego pobierania): automat `.github/workflows/sample.yml` (ręcznie, Actions → „Próbka danych”) zapisuje kategorie i meta z opublikowanej strony na gałęzi `dane-probka`. Można też po prostu pobierać pliki z https://lupka.app/data/… .
- Na serwerze robi to automat `.github/workflows/pages.yml` przy każdej publikacji i w każdy poniedziałek. Gdy OFF nie odpowiada,
  publikuje ostatnią udaną kopię (cache GitHub Actions).

### Jak aplikacja wybiera plik kategorii

- `A.fetchCategory(cat)` w `app/ui-base.js` (ok. linia 658) → `fetchCatRemote` czyta `../data/c/<cat z ':' zamienionym na '_'>.json`.
  **404 = pusta lista (bez błędu)**; wynik zapamiętywany w localStorage (`dcn-catcache`, 6 ostatnich kategorii).
- **Porównanie w kategorii i zamienniki** (`loadCategory` w `app/ui-product.js`, ok. linia 383): bierze **dwie ostatnie pozycje**
  z `prod.categories` (czyli z `categories_hierarchy` produktu, odwróconej), pobiera pierwszą; jeśli po odjęciu samego produktu jest
  mniej niż 8 produktów, dobiera drugą. **Kolejność tagów w `categories_hierarchy` pochodzi z OFF i nie zawsze idzie od ogólnej do
  najwęższej**, więc „dwie ostatnie” bywają nietrafione. Przykład z testów: dla kremu czekoladowego ostatnie tagi to
  `en:confectionary-based-spreads` (brak pliku → 404 → pusta lista) i `en:cocoa-powders` (plik istnieje) – stąd kakao w porównaniu.
  Zamienniki są dodatkowo filtrowane przez `sameUse` (ta sama postać: krem↔krem, napój↔napój – lista `FORM_CATS`) i muszą należeć do
  pierwszej, najwęższej kategorii (`narrow = cats[0]`). Jeśli porównanie ma być trafniejsze, trzeba poprawić wybór kategorii
  (np. pomijać tagi bez pliku i wybierać najgłębszy tag należący do tej samej gałęzi), a nie same dane.
- **Listy „Najlepsze” (#/lista/<tag>)** biorą dokładnie plik kategorii z kafla (SHOP_CATEGORIES w `app/data.js`) – bez zawężania,
  poza oceną pod profil.

### „Słodkie kremy” (en:sweet-spreads)

- Kafel „Słodkie kremy” = `{ key: 'en:sweet-spreads' }` w `SHOP_CATEGORIES` (`app/data.js`, ok. linia 460).
- Plik `data/c/en_sweet-spreads.json` zawiera 200 najpopularniejszych polskich produktów, które w OFF mają w hierarchii `en:sweet-spreads`.
  **W taksonomii Open Food Facts `en:sweet-spreads` jest kategorią nadrzędną m.in. dla dżemów (`en:jams`), owocowych smarowideł/musów,
  miodów (`en:honeys`) i kremów czekoladowo-orzechowych** – dlatego na liście są dżemy i musy. Aplikacja tego nie filtruje.
  Aliasy: `en:hazelnut-spreads` → `en:sweet-spreads` (`CAT_ALIAS` w `ui-base.js`, ok. linia 380).
- Jeśli kafel ma pokazywać tylko kremy do smarowania (czekoladowe/orzechowe), trzeba zmienić klucz kafla na węższy tag OFF
  (np. `en:chocolate-spreads` / `en:hazelnut-spreads` – sprawdzić, czy pliki istnieją na lupka.app/data/c/) albo dodać filtr. To
  decyzja produktowa – nie była podjęta.

## 3. Wdrożenie

- **Hosting: GitHub Pages** (repozytorium `rafalmsolutions/dobre-czy-nie`), domena **lupka.app** ustawiona w ustawieniach Pages.
  Nie ma FTP, Netlify ani Cloudflare Pages.
- **Wdrożenie = `git push` do gałęzi `main`.** Automat `.github/workflows/pages.yml` („Zbuduj i opublikuj”):
  1. testy (`scripts/test_build_data.py`, `tests/bundle.js`, `tests/unit-*.cjs`, `tests/worker-*.mjs`, `tests/pages-test.cjs`) –
     jeśli któryś padnie, nic się nie publikuje;
  2. dane z OFF (`build_data.py`);
  3. kopia repozytorium bez `tests scripts worker android datacache README.md` do `site/`, `data/` do `site/data`,
     generowanie podstron (`node scripts/build_pages.cjs --data site/data --out site`);
  4. publikacja na GitHub Pages. Trwa kilka–kilkanaście minut (status: zakładka Actions; `gh run list`).
- **Pośrednik Cloudflare Worker** (`dcn-off-proxy.rafalmsolutions.workers.dev`, kod w `worker/`, baza Cloudflare D1): wysyła go
  `.github/workflows/worker.yml` po zmianie w `worker/` (sekrety CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, OFF_USER, OFF_PASS).
- **Service worker i wersjonowanie – przy KAŻDEJ zmianie aplikacji podbić wersję w dwóch miejscach:**
  - `app/config.js` → `appVersion: 'X.Y.Z'` (widać w Profil → Informacje i pomoc),
  - `app/sw.js` → `const VERSION = 'lupka-X.Y.Z'` (zmiana nazwy pamięci wymusza pobranie nowych plików),
  - i dopisać sekcję na górze `README.md` (historia zmian).
  Nawigacja i pliki aplikacji idą „najpierw sieć” (`fetch` z `no-cache`), pamięć to zapas offline. Nowe pliki trzeba też dopisać do
  listy `SHELL` w `app/sw.js`. Wskaźnik zmian dla przeglądarki to właśnie VERSION – nazwy plików nie mają hashy.
- **Android (Google Play, pakiet `app.lupka`)**: to Trusted Web Activity – aplikacja otwiera https://lupka.app/app/ w przeglądarce
  telefonu. Projekt w `android/` (`twa-manifest.json`, `build.mjs`), budowany przez `.github/workflows/android.yml` (Bubblewrap,
  podpis kluczem przesyłania z sekretów ANDROID_KEYSTORE_BASE64/PASSWORD), wynik `.aab` w artefaktach przebiegu → ręcznie do Play Console.
  **Po zmianach w kodzie webowym NIE trzeba przebudowywać Androida** – aplikacja z Play pobiera aktualną stronę. Przebudowa tylko przy
  zmianie nazwy, ikony, kolorów, adresu startowego, pakietu (czyli plików w `android/`). Klucz przesyłania nie jest w repozytorium.
  Stan w Play: test zamknięty „Alpha” z wydaniem v105 (3.0.5), testerzy z grupy lupka-testerzy@googlegroups.com, Polska.

## 4. Logika, którą trzeba znać

| Co | Gdzie |
|---|---|
| Limit 3 celów | stała `GOALS_MAX = 3` w `app/data.js` (ok. l. 400); onboarding: `app/ui-home.js` – komunikat ok. l. 132 (`draft.goals.length >= GOALS_MAX`); Profil: `app/ui-progress.js` ok. l. 213; zapis przycina `cleanProfile` w `app/core.js` (`.slice(0, GOALS_MAX)`, ok. l. 785 – ta deklaracja nadpisuje wcześniejszą z l. 332) |
| Formularz „Nowa osoba” w onboardingu | `app/ui-home.js`: arkusz ok. l. 81–85 (pole `#obPName`, przycisk `data-act="start-person-save"`), walidacja ok. l. 153: imię = tekst bez `<>`, przycięty do 30 znaków, pusty → „Wpisz imię albo pseudonim.”. Domownicy w Profilu: `app/ui-progress.js` (`fam-add` tworzy „Osoba N”, nazwa z pola `#profName`, zapis przy wpisywaniu) i `app/family.js` (`A.familyAdd`, `FAMILY_MAX = 4`) |
| „Dla Ciebie” vs znaczek w nagłówku produktu | `app/ui-product.js`: znaczek (kwadrat z %) ok. l. 177–180 = **wynik grupy**: najniższy wynik spośród osób, dla których kupujesz (`A.groupMatch` w `family.js`); podpis: „rodzina”, „2 osoby” albo imię. Panel „Dlaczego dla …” i wiersz sumy ok. l. 196 („Dla Ciebie” / „Dla: Kuba”) = **wynik osoby wybranej pigułką** (A.focusPerson). Mogą się różnić celowo (np. 10% rodzina, a „Dla Ciebie 100%”) |
| Świętowanie nowej odznaki/poziomu (okno na cały ekran) | `app/ui-base.js`: `A.celebrate` (ok. l. 312) i `A.nextCelebration` (ok. l. 330, „Nowa odznaka!”); mały pasek nagrody „Nowa karta / Odbierz” – `A.rewardBar` w `app/ui-album.js` (ok. l. 105); zwykły toast – `A.toast` w `ui-base.js` (ok. l. 368) |
| „Odhaczysz całą listę (min. 3 rzeczy) w sklepie? +10 pkt” | `app/ui-shelves.js` ok. l. 265 (ukryte w trybie bez punktów: `A.quiet()`); punkty z `config/points-rules.json` |
| Dział listy zakupów (np. „mleko owsiane” → Nabiał) | `departmentFor` w `app/core.js` (ok. l. 772): najpierw tagi kategorii OFF produktu, potem **słowa z nazwy w kolejności działów** z `DEPARTMENTS` (`app/data.js`, ok. l. 497). Wpisana ręcznie rzecz nie ma kategorii, a „mleko” jest na liście słów Nabiału, który stoi przed „Śniadaniem” (gdzie jest „owsi”) – dlatego „mleko owsiane” → Nabiał. Poprawka: np. słowa „mleko owsiane/sojowe/roślinne/migdałowe” jako osobna reguła przed Nabiałem albo dział „Napoje roślinne” |
| Kafle kategorii na #/najlepsze | route `cats` w `app/ui-home.js` (ok. l. 251); kafle z `SHOP_CATEGORIES` i grup `SHOP_GROUPS` w `app/data.js` (ok. l. 449–524); zdjęcia `app/img/cat/<tag bez en:>.webp`; lista po kliknięciu: route `list` (ok. l. 275, `renderList`/`drawList` ok. l. 365–400) |

### Decyzje i ograniczenia – nie zmieniać bez pytania właściciela

- **Bez frameworka i bez kroku budowania**: zwykłe pliki JS ładowane po kolei w `app/index.html`, globalny obiekt `App` (w plikach `A`).
- **Dane użytkownika zostają w telefonie** (localStorage z prefiksem `dcn-`, bez kont). Nie wysyłać profilu, alergii, domowników ani
  historii na żaden serwer – tak obiecuje polityka prywatności i deklaracja „Bezpieczeństwo danych” w Google Play.
- **Tylko jasny motyw** (`color-scheme: only light`). Właściciel nie chce trybu ciemnego.
- **Wynik rodziny = najsłabszy wynik osoby, nie średnia.**
- **Spokojny język**: „na co dzień”, „od czasu do czasu”, nie „szkodliwe”. Ocena ma charakter informacyjny, nie medyczny.
- **Imiona w dopełniaczu**: „Nie dla Kuby i Ani”, „Dlaczego dla Kuby” (`A.notFor`, `A.nameGen` w `family.js`); imię, którego nie
  umiemy odmienić, zostaje bez zmian („Nie dla: X”).
- **Brak kart za alkohol** i strony „Piwa” w albumie (ocena treści w Google Play: PEGI 3).
- **Tryb „Ukryj punkty i nagrody”** (`A.quiet()`) musi chować wszystkie dopiski punktowe w nowych miejscach.
- **Zmiany wyglądu: najpierw makieta/zrzut do akceptacji właściciela, potem wdrożenie.**
- Nie publikować niczego do Open Food Facts w testach (testy mają atrapy sieci w `tests/lib.mjs`).
- Aplikacja tylko po polsku i tylko Polska (`A.country = () => 'pl'`); strona główna ma wersję EN, podstrony są tylko PL.
- `.well-known/assetlinks.json` – odciski kluczy Google Play; zmiana zepsuje otwieranie aplikacji z Play bez paska adresu.

### Testy

- Testy przeglądarkowe: `tests/e2e-d-*.mjs` (Playwright, Chromium). Uruchamiać z serwerem statycznym na porcie 8790 z katalogu głównego
  repozytorium, np. `python -m http.server 8790`, potem w `tests/`: `node e2e-d-lista.mjs` itd. (aplikacja pod
  `http://localhost:8790/app/index.html`). Atrapy OFF i pośrednika: `tests/lib.mjs` (`setup(ctx)`).
- Testy jednostkowe uruchamiane też w automacie publikacji (lista w punkcie 3).

### Czego nie wiem / nie mam

- Czy na komputerze z Windows jest lokalna kopia i pod jaką ścieżką.
- Haseł i kluczy (GitHub, Cloudflare, Open Food Facts, klucz przesyłania Androida) – są tylko w sekretach repozytorium i u właściciela.
- Aktualnej zawartości `lupka.app/data/` – zmienia się co tydzień; podgląd: https://lupka.app/data/meta.json.
