# Lupka (dawniej „Dobre czy nie?”) – przyjrzyj się, wybierz lepiej

Aplikacja webowa (PWA): skanujesz kod kreskowy i od razu widzisz, czy produkt pasuje do Ciebie i Twojej rodziny.
Od 21.10.2026 główną aplikacją jest dawna wersja D „Wystawa”: jasnoszare tło, produkt na okrągłym „talerzu”, nazwa w dwóch grubościach,
album z polowaniem i plakatami, odkrywcy z potwierdzaniem produktów, profile rodziny, historia gramatur. Bez maskotki.

- **Adresy (od 22.10.2026):** https://lupka.app/ – strona promująca (`index.html` w katalogu głównym, obrazki w `img/`, PL/EN), https://lupka.app/app/ – aplikacja (folder `app/`),
  https://lupka.app/archiwum/ – dawna aplikacja z Ziarenkiem (folder `archiwum/`, opis w `archiwum/README.md`), `privacy.html` w katalogu głównym (wspólna).
  Domena kupiona w Cloudflare, DNS bez proxy wskazuje na GitHub Pages, HTTPS wymuszone. Dawny adres github.io przekierowuje automatycznie.
- **Przenosiny 22.10.2026:** dane w telefonie zostają (ta sama domena). Stare linki `lupka.app/#/p/…` (i inne ekrany aplikacji) oraz zainstalowana aplikacja (start w „/”) przenoszą do `/app/` (skrypt na stronie).
  Stary service worker z „/” zastępuje `sw.js` w katalogu głównym, który czyści pamięć „dcn-d-…” i wyrejestrowuje się. `/d/` i `/strona/` przekierowują.
- Wspólne dla aplikacji i archiwum: kopia bazy `data/` (budowana w GitHub Actions) i pliki `config/` w katalogu głównym (aplikacja czyta `../data/`, `../config/`).
- Service worker aplikacji (`app/sw.js`, pamięć `lupka-…`, zdjęcia `dcn-img`, szczegóły `dcn-pdet`) czyści stare „dcn-…” i „lupka-…”, nie rusza archiwum (`dcn-arch-…`).
- Statystyki GoatCounter: ekrany aplikacji mają ścieżki `/d/…`, zdarzenia przedrostek `d-`; archiwum `/archiwum/…` i `arch-`.
- Testerzy: link `lupka.app/app/?t=imie` zapisuje znacznik testera (dopisywany do uwag i zgłoszeń, raz dziennie zdarzenie `d-tester-imie`).
- Testy: `tests/unit-d.cjs`, `tests/e2e-d-*.mjs` (nowa aplikacja), `tests/unit-core.cjs`, `tests/unit-v1.cjs`, `tests/e2e.mjs` (archiwum), `tests/sw-test.mjs` (przeprowadzka i service workery),
  `tests/worker-*.mjs` (pośrednik), `scripts/test_build_data.py` (kopia bazy). Testy przeglądarkowe wymagają serwera: `python3 -m http.server 8790` w katalogu repozytorium (aplikacja: `http://localhost:8790/app/`).

## Ekran „Dla Ciebie”: najpierw zakupy (22.10.2026, wersja 2.6.0)
- Kolejność: szukaj (także cyfry kodu kreskowego) → „Dla kogo dziś kupujesz?” w jednym wierszu (stuknięcie włącza/wyłącza osobę) → Ostatnio sprawdzone (z „Nie dla: …” przy kilku osobach) → Najlepsze (3 kategorie) → jedna karta postępów (poziom, wyzwanie, polowanie).
- Duży przycisk „Skanuj” tylko przy pierwszym wejściu (bez historii); potem skan jest na dolnym pasku. Bez domowników: „Pilnujesz: …” w jednej linijce albo karta „Czego pilnujesz?”.
- Usunięta sekcja „Nie masz aparatu?”: wyszukiwarka rozpoznaje kod (Enter otwiera produkt, błędny kod dostaje podpowiedź).
- Projekt na płótnie: sekcja O (przed i po).

## Strona lupka.app, aplikacja pod /app/, wskazówki do etykiet, znacznik testera (22.10.2026, wersja 2.5.0)

- **Strona promująca** pod lupka.app (PL/EN wg przeglądarki, animacje, pokaz „Jeden skan. Wynik dla każdego.” na prawdziwych wynikach aplikacji, krótsza wersja na telefon z karuzelą funkcji i stałym przyciskiem). Aplikacja przeniesiona do `app/` (szczegóły na górze).
  Strona generowana skryptem z płótna (zrzuty z aplikacji na przykładowych produktach bez prawdziwych marek).
- **Album uczy czytać etykiety:** przy każdym pustym miejscu „jak sprawdzić?” (np. olej palmowy: słowo „palmowy” w składzie; „mało cukru”: najwyżej 5 g na 100 g w wierszu „w tym cukry”), a przy odsłoniętej karcie „Na etykiecie: …” (`LABEL_TIP` w `app/ui-album.js`, progi jak w unijnych oświadczeniach żywieniowych).
  Testowy przycisk „odsłoń cały plakat” tylko z `dcn-debug`.
- **Znacznik testera** z linku (`?t=imie`), polityka prywatności to opisuje. Polityka: administrator Rafał Mokrowiecki, wersja z 21.10.2026, powrót do aplikacji albo na stronę.
- Testy: `tests/sw-test.mjs` (nowe adresy, sprzątanie starego service workera), nowe przypadki w `tests/e2e-d-album.mjs` i `tests/e2e-d-feedback.mjs`.

## Dźwięki z zestawu SFX Kit (21.10.2026, wersja 2.4.1)

- Nagrody, skan, półka, odsłonięcie karty: nagrania z **SFX Kit** (Wyzowl, CC0, https://github.com/wyzowl/sfx-kit) w `sfx/` (MP3 mono, razem ok. 135 kB, w pamięci service workera).
  Mapa zdarzeń → warstwy nagrań: `SFX` w `ui-base.js` (np. odznaka = „success-sparkle” + iskierki, nowy poziom = „popper” + fanfara + iskierki). Syntezator z 2.4.0 zostaje jako zapas,
  gdy pliki jeszcze się nie wczytały. Odsłonięcie karty w albumie: najpierw odgłos odwracanej karty, potem dźwięk rzadkości.

## Szukaj po nazwie, porównaj 2–3 produkty, nowe dźwięki nagród (21.10.2026, wersja 2.4.0)

- **Szukaj** (`#/szukaj/<zapytanie>`, pole na górze „Dla Ciebie”): pośrednik `/search?q=` (wyszukiwarka Open Food Facts, słowa łączone przez AND,
  tylko produkty z Polski, zapytanie oczyszczone do liter i cyfr, pamięć Cloudflare 12 h). Wyniki przeliczone na pełnych danych z `/details`, ułożone według
  wyniku osób na zakupach (`A.groupMatch`); te, które komuś nie pasują, na końcu z powodem. Najpierw od razu produkty z telefonu, skróty do pasujących kategorii,
  ostatnio szukane (`d-recentq`), przy braku wyniku zachęta do dodania produktu.
- **Porównaj** (`#/porownaj`, `ui-compare.js`): 2–3 produkty obok siebie. Wynik kolumny = ten sam co wszędzie (najniższy wśród włączonych osób) albo wybranej osoby;
  korona „Lepszy wybór” (produkt, który komuś nie pasuje, nie wygrywa; różnica < 5 pkt = „Podobnie”). Tabele „Dla kogo” i „Co je różni” (najpierw to, czego ktoś
  pilnuje i czego nie je, potem białko, dodatki E, NOVA, ocena składu). Wejścia: podpowiedź po drugim skanie z tej samej kategorii (15 min), przycisk „Porównaj”
  przy produkcie, ⇄ na listach i w wynikach. Pasek „Porównujesz 2 produkty · Pokaż” nad menu. Produkty zapisane w telefonie (`d-cmp`).
- **Dźwięki nagród** od nowa: dzwonki FM, fanfara, wzlot, „bum”, iskierki w stereo, pogłos i kompresor (Web Audio, bez plików). `A.renderSound(nazwa)` renderuje dźwięk do bufora (podgląd, testy).
- Odznaka „Mój profil” ma ikonę suwaków zamiast znaku zapytania.
- Testy: `tests/e2e-d-compare.mjs`, nowe przypadki w `tests/worker-test.mjs` (`/search`).

## Jeden wynik dla osób na zakupach (21.10.2026, wersja 2.3.4)

- **Zasada:** gdy liczysz kilka osób, wynik produktu to **najniższy** wynik wśród włączonych osób (nie średnia): produkt jest tak dobry,
  jak dla osoby, której pasuje najsłabiej, a średnia ukryłaby np. gluten u jednej osoby. Jedna funkcja `A.groupMatch` w `family.js`.
- Ten sam wynik pokazują: obręcz talerza i nowy kwadrat z procentem nad odpowiedzią dla rodziny (podpis: „rodzina”, „2 osoby”, imię),
  „Ostatnio sprawdzone” (liczone na nowo z zapamiętanych danych produktu przy każdej zmianie osób albo profili) i lista „Cała rodzina / Wszyscy wybrani”.
  Stuknięcie osoby w kółkach zmienia tylko rachunek „Dlaczego dla: …”, nie wynik.
- Testy: `tests/e2e-d-list.mjs` (obręcz = kwadrat = lista = historia), `tests/e2e-d-shop.mjs` (historia po wyłączeniu osób).

## Stabilne listy, osoby na zakupy, obręcz osoby w fokusie, pełne dane zamiast kopii (21.10.2026, wersja 2.3.3)

- **Lista liczona raz, na pełnych danych:** po pobraniu kategorii aplikacja bierze 80 najlepszych kandydatów i jednym zapytaniem `/details?codes=` (pośrednik, do 40 kodów, pamięć Cloudflare 3 dni)
  dociąga ich pełne dane. Wynik zapamiętuje (6 h, ten sam profil i rodzina). Przełączanie „Cała rodzina / osoby” i sklepów tylko przerysowuje listę, niczego nie pobiera,
  więc liczby się nie zmieniają, a lista „Cała rodzina” zawsze mieści się w liście każdej osoby. Pełne dane trzyma telefon (`dcn-pdet`, 7 dni).
- **Obręcz talerza z rodziną = osoba w fokusie** (ta sama co w „Dlaczego dla: …”): procent obręczy zawsze widać na ekranie.
- **Wolna baza OFF:** po 1,2 s aplikacja pokazuje pełne dane z pośrednika (pobierane równolegle od początku), a kopię bazy dopiero, gdy i ich brak.
  Dzięki temu przy produkcie bez składu jest przycisk „Pomóż uzupełnić”.
- **Osoby na zakupy:** na „Dla Ciebie” przy każdym profilu rodziny jest przełącznik. Wyłączona osoba (także Ty) nie liczy się przy produkcie, na półkach ani na listach
  („Wszyscy wybrani”); ktoś musi zostać włączony. Pod kółkami „Nie liczymy: … · Licz wszystkich”. Zapamiętane w `d-shopoff` (`A.activeRows`, `A.setShopOn` w `family.js`).
- **Wyzwanie ukończone:** medal z pucharem zamiast paczki nasion truskawki (pozostałość dawnej gry w ogródek) i wskazówka, gdzie je widać.
- Testy: `tests/e2e-d-list.mjs` (stabilność, obręcz, wolna baza), `tests/e2e-d-shop.mjs` (osoby na zakupy, medal), `tests/worker-test.mjs` (`/details`).

## Szybsze zdjęcia, spójne wyniki na listach, lista dla rodziny (21.10.2026, wersja 2.3.2)

- **Zdjęcia produktów** idą przez pośrednika (`/img/images/products/…` w `worker/off-proxy.js`): serwer zdjęć OFF odpowiadał 1–12 s na zdjęcie i nie pozwalał ich zapamiętać.
  Pośrednik trzyma kopię w pamięci Cloudflare 30 dni (tylko ścieżki zdjęć produktów, tylko z naszych stron), telefon w `sw.js` (pamięć `dcn-img`, do 400 zdjęć, najpierw kopia).
  Zdjęcie, które się nie wczyta, zamienia się na szarą lupę zamiast pękniętego obrazka. Adres zamienia `A.safeImg`.
- **Ten sam wynik na liście i po otwarciu produktu:** wyszukiwarka OFF (źródło list) bywa niepełna (np. gulasz bez wartości odżywczych → brak kary za sól → 70% zamiast 60%).
  Lista po narysowaniu dociąga pełne dane do 40 produktów z czołówki tymi samymi drogami co ekran produktu (`A.lookup`), pamięta je 7 dni (`d-pdet`, do 120) i przelicza się. Zamienniki na ekranie produktu korzystają z tych samych danych.
- **Ocet spirytusowy, winny, jabłkowy itp. to nie alkohol** (`noVinegar` w `core.js`); spirytus, wino itd. nadal tak.
- **Lista dla rodziny:** z domownikami nad listą wybór „Cała rodzina / Ty / imiona”. „Cała rodzina” (domyślnie) = wynik osoby, której produkt pasuje najsłabiej;
  produkt, który komuś nie pasuje albo przy którym nie wiemy (alergia bez składu), nie trafia na listę dobrych. Wybór zapamiętany (`d-listwho`).
- Procenty na liście w jednej kolumnie; długie nazwy produktów nie łamią się w środku słowa (`A.fitTitle` zmniejsza czcionkę).
- Testy: `tests/e2e-d-list.mjs`, nowe przypadki w `tests/unit-d.cjs` i `tests/worker-test.mjs`.

## Ekran ładowania i profile rodziny na ekranie głównym (21.10.2026, wersja 2.3.1)

- Ekran ładowania (`#boot`) to warstwa na wierzchu; zostaje, aż animacja znaku się skończy (ok. 1,75 s od otwarcia), potem płynnie znika (`A.bootDone`).
  Bez czekania: stuknięcie, „ogranicz animacje” w systemie i testy automatyczne (`navigator.webdriver`).
- „Dla Ciebie”: z domownikami sekcja „Profile rodziny” pokazuje każdą osobę (Ty, domownicy) z tym, czego pilnuje i czego nie je, i „Zmień” otwierające profil tej osoby (`A.editProfileOf`). Bez domowników jak dotąd „Twój profil”.
- Test: `tests/e2e-d-home.mjs`.

## Lupka: nazwa, znak i jeden kolor dopasowania (21.10.2026, wersja 2.3.0)

- Nazwa aplikacji: **Lupka**, hasło „Przyjrzyj się. Wybierz lepiej.” (EN: „Look closer. Pick better.”). Repozytorium bez zmian; od 21.10.2026 adres https://lupka.app/.
  Tytuł, manifest, polityka prywatności, teksty udostępniania i zgłoszeń, lista zakupów. Klucze pamięci (`dcn-…`) bez zmian, więc dane użytkowników zostają.
- Znak F2: lupa z obręczą z trzech łuków z przerwami (zielony, czerwony, żółty), napis Montserrat 800. Symbol `#i-lupka` w `index.html` (górny pasek),
  ikony `icon.svg`, `icon-180/192/512.png`, `icon-maskable-512.png`. Ekran ładowania: łuki się rysują i obracają, wyskakuje rączka, potem napis i hasło (bez ruchu przy „ogranicz animacje”).
- Wynik na talerzu: obręcz talerza (12 px) wypełnia się od góry do procentu, reszta to szare obramowanie; przy domownikach najsłabszy wynik w rodzinie; przy „bez liczb” sama szara obręcz.
- Jeden kolor dopasowania w całej aplikacji: `A.scoreColor(pct)` (czerwony 0% → żółty 50% → zielony 100%, przystanki dobrane tak, żeby środek nie był oliwkowy).
  Używają go: obręcz talerza, kwadrat z wynikiem, procenty na listach, półkach i w zamiennikach, małe talerze w „Ostatnio sprawdzone” (obręcz = wynik), pierścienie domowników,
  łuk w tle (rozjaśniony) i napisy pod wynikiem (przyciemnione, żeby były czytelne). Pomocnicze: `A.pctStyle`, `A.pctText`, `A.ringStyle`.

## Moje sklepy (21.10.2026, wersja 2.2.0)

- Profil → „Gdzie robisz zakupy” (klucz `d-stores`, tylko w telefonie). Bez wybranych sklepów nic się nie zmienia.
- Listy „Najlepsze”: domyślnie filtr na Twój sklep, jeśli ma co najmniej 3 dobre produkty; zamienniki i zamiennik dla rodziny najpierw z Twoich sklepów („jest w: Lidl”).
- Sklep dopisywany do Open Food Facts bez osobnego kroku: przy dodawaniu produktu i przy uzupełnianiu składu/wartości (wybór w nagłówku, pierwszy z Twoich zaznaczony, „inny” = bez sklepu) oraz jednym stuknięciem po skanie „Kupujesz to w: …” (+2 pkt, tylko gdy baza nie zna przy produkcie żadnego z Twoich sklepów; „Nie teraz” = nie pytamy więcej, klucz `d-storetag`).
- Pośrednik: pole `store` (lista znanych sieci w `STORE_NAMES`) zapisywane jako `add_stores` – dopisuje, nigdy nie usuwa innych sklepów.
- Pobieranie danych ze stron sklepów: świadomie nie (prawo do baz danych, regulaminy sklepów, zasady Open Food Facts przyjmują tylko dane z opakowania).

## Poprawki po pierwszym teście (21.10.2026, wersja 2.1.0)

- Po skanie od razu wynik dla Ciebie i rodziny: „Zgadnij” domyślnie wyłączone (włączenie w Profilu; jednorazowo wyłączone także u osób, które miały je zapisane, klucz `settings-v`).
- Nowa karta, odznaka, poziom nie zasłaniają wyniku: pasek nad dolnym menu (`#rwBar`, `A.rewardBar`) „Nowa karta · rzadkie miejsce · Odbierz”. Punkty za kartę od razu po skanie; odsłonięcie karty i gratulacje po stuknięciu „Odbierz”, „×” zostawia je w albumie bez pokazu. Na ekranie produktu gratulacje czekają w kolejce (`A.holdRewards`).
- Wolniej: bez darmowego miejsca „Dowolny produkt” (strony v2 przebudowują wolne miejsca), rozkład miejsc 1 zwykłe / 4 rzadkie / 3 epickie / 2 legendarne, na słabych stronach „Nowa marka” zamiast „Kolejny dowolny produkt”. Wyższe progi odznak (np. Detektyw 25/100/300, Półka 10/40/120).
- Karty i odznaki w jednej zakładce „Kolekcja” z przełącznikiem „Karty | Odznaki i poziom”; ikona punktów prowadzi do tej samej zakładki.
- Półka: ilość z jednostką (szt., g, kg, ml, l; domyślnie 1 szt.; „2 kg ziemniaki” rozpoznawane przy wpisywaniu) i przy produktach odpowiedź dla rodziny (✓ wszyscy, ! uwaga, ✕ imię, ? nie wiemy) zamiast samego Twojego procentu; odświeża się po otwarciu produktu.

## Historia wersji D (do 20.10.2026 pod adresem /d/)

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
- **Profile rodziny** (`family.js`): do 4 domowników z własnym „Nie jem” i „Pilnuję” (klucz `d-family`); Album liczy się według profilu „Ja”.
  Przy produkcie (od 1.8.0): obok zdjęcia odpowiedź dla całej rodziny („Nie dla: Kuba”, „Uwaga: Ola”, „Nie wiemy dla: …”, „Pasuje wszystkim / Wam obojgu”), kolor wstęgi = ta odpowiedź.
  Pod zdjęciem kółka domowników: najpierw osoby z problemem, pierścień = dopasowanie (pusty przy „nie pasuje” i „nie wiemy”), znak ✓ ! ✕ ?, dwie litery przy powtarzających się inicjałach.
  Wyjaśnienie na start dla pierwszej osoby z problemem, a gdy pasuje wszystkim, dla ostatnio wybranej (`d-focus`). Szary stan „nie wiemy”, gdy ktoś ma alergię, a baza nie ma składu.
  Gdy produkt komuś nie pasuje: jeden produkt z tej samej kategorii, który pasuje wszystkim (`A.familyAltPick`).
- **Odkrywcy** (`disc.js`, pośrednik `worker/disc.js`, baza Cloudflare D1 `dcn-odkrywcy`, schemat `worker/schema.sql`):
  - przy dodawaniu: kod ze zdjęcia = kod ze skanu (inny kod blokuje wysyłkę), nazwa bez wulgaryzmów, skład zgodny z odczytem zdjęcia, kalorie zgodne z makroskładnikami;
  - +10 pkt od razu, +50 po 2 potwierdzeniach (+100 za produkt z listy „Poszukiwane”), +1 za każdą osobę, która sprawdzi produkt (do 100);
  - „Czy trzymasz ten produkt?” tylko po skanie aparatem: +5 za „tak” i „nie”, +2 za „nie mam pewności”, do 10 dziennie;
  - zaufany odkrywca (3 potwierdzone, 0 odrzuconych): od razu potwierdzony, gdy kod był widoczny na zdjęciu;
  - ekran `#/odkrycia`: status, lista „Poszukiwane”, pseudonim.
- **Gramatury:** `scripts/build_data.py` zapisuje `data/qhist.json` i pole `qchg` w produktach, gdy gramatura zmieni się między kopiami bazy; produkt pokazuje „Mniej w opakowaniu”.

## Wyszukiwarki i asystenci AI (22.10.2026)
- Strona: tytuł i opis ze słowami „skaner produktów”, canonical, podgląd linku (img/og.jpg 1200×630), dane strukturalne schema.org (Organization, WebSite, WebApplication, FAQPage).
- robots.txt (wszyscy, także roboty AI, mile widziani), sitemap.xml, llms.txt (zwięzłe fakty o Lupce dla asystentów AI).
- Strony budowane przy publikacji przez scripts/build_pages.cjs (test: tests/pages-test.cjs): /jak-liczymy/ (liczby czytane z app/core.js i app/data.js), /lupka-czy-yuka/, /kategorie/ i 44 kategorie z bieżącej kopii bazy, sitemap.xml. Lokalnie: gałąź dane-probka (workflow „Próbka danych”) i `node scripts/build_pages.cjs --data <próbka> --out .`.
- /app/ i /archiwum/ mają „noindex”: w wynikach ma być strona, nie pusta powłoka aplikacji.

