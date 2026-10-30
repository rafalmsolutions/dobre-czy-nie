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

## Zwijane listy alergenów i diet, nazwy „Bez…” (30.10.2026, wersja 3.0.20)

- Na listach wyboru „Bez wieprzowiny” i „Bez alkoholu” (jak „Bez laktozy”) zamiast „Wieprzowina” i „Alkohol”. W podsumowaniach zostaje rzeczownik („✕ wieprzowina”, „Nie jem: alkohol”) – pole `noun` w `PROFILE_OPTIONS`.
- Listy „Alergeny” i „Dieta” są zwijane; w nagłówku widać, co zaznaczono (odświeża się od razu). Profil → Wykluczenia: lista z zaznaczeniami zwinięta, pusta rozwinięta. Pierwsze uruchomienie: obie rozwinięte, da się zwinąć.
- Testy: nowe przypadki w `tests/e2e-d-drobne.mjs`.

## Brakujące wartości odżywcze wyliczone z innych (30.10.2026, wersja 3.0.19)

- Gdy w bazie brakuje wartości, która wynika z innych, Lupka ją wylicza (bez zgadywania): węglowodany 0 g → cukry 0 g, tłuszcz 0 g → nasycone 0 g, sól = sód × 2,5.
- Górna granica (cukry ≤ węglowodany, nasycone ≤ tłuszcz) tylko, gdy na pewno daje „mało”; liczymy wtedy najgorszy przypadek („najwyżej 1 g”).
- Przy wyliczonej wartości podpis „wyliczone: tłuszcz 0 g” w tabeli i w rachunku. Wartości z bazy nigdy nie są nadpisywane. Nic nie wysyłamy do Open Food Facts.
- Kopia bazy (`scripts/build_data.py`) zachowuje sód, gdy brakuje soli. Testy: `tests/e2e-d-wyliczone.mjs`, nowe przypadki w `tests/unit-d.cjs`.

## Znaczek „brak danych”, kategorie zwierzęce, uczciwsze punkty (30.10.2026, wersja 3.0.18)

- Znaczek w nagłówku produktu przy braku danych: zamiast „?” napis „brak danych” i dla kogo ich brakuje („dla Kuby”, „dla Ciebie i Kuby”, „dla 3 osób”).
  Zasada bez zmian: znaczek = osoby, dla których kupujesz; panel „Dlaczego dla…” = wybrana osoba.
- Produkt bez składu z kategorii jednoznacznie zwierzęcej dostaje „nie pasuje” z uczciwym powodem, np. „Wegańska nie pasuje: to ser (kategoria w bazie)”.
  Weganie: ser, mięso, wędlina, ryba, jajka, nabiał, miód. Wegetarianie: mięso, wędlina, ryba. Pomijamy produkty roślinne
  („plant-based”, „vegan”, zamienniki w kategoriach, wegańska etykieta). Na podstawie samej kategorii nic nie dostaje „pasuje”.
- Punkty: bez +5 pkt za dodanie na listę produktu, który komuś z kupujących nie pasuje (przycisk bez „(+5 pkt)”).
  +10 pkt za całą listę najwyżej raz dziennie i tylko, gdy co najmniej 3 odhaczone rzeczy były na liście od 30 minut (czas odhaczenia zapisywany przy pozycji).
  Nowy tekst podpowiedzi bez obietnicy „w sklepie”. Tryb „Ukryj punkty i nagrody” chowa wszystkie dopiski.
- Testy: `tests/e2e-d-punkty.mjs`, nowe przypadki w `tests/unit-d.cjs` (ser, ser wegański, tofu, szynka, miód).

## Kafle kategorii i limit celów (30.10.2026, wersja 3.0.17)

- „Najlepsze dla Ciebie” (#/najlepsze) na telefonie: długie nazwy kategorii („Płatki śniadaniowe”) mieszczą się przed strzałką – mniejszy obrazek i odstępy, czcionka zależna od szerokości ekranu (do 440 px), bez łamania słów.
- Pierwsze uruchomienie, cele: komunikat „Możesz wybrać najwyżej 3 cele…” pokazuje się w dymku nad przyciskiem „Dalej”, a nie pod kafelkami poza ekranem. Znika po odznaczeniu celu.
- Testy: nowe przypadki w `tests/e2e-d-drobne.mjs`.

## Drobne poprawki z testu (29.10.2026, wersja 3.0.16)

- Pierwsze uruchomienie, „Nowa osoba”: komunikat „Wpisz imię albo pseudonim.” znika, gdy zaczniesz wpisywać imię.
- Lista zakupów: podpowiedź „Odhaczysz całą listę…? +10 pkt” nie wisi, gdy wszystko jest już w koszyku.
- Pasek nowych odznak: kilka stopni tej samej odznaki naraz to „Mój profil · brąz, srebro” (zamiast „Mój profil, Mój profil”), nagłówek „Nowe odznaki”.
- Lista zakupów: „mleko owsiane/sojowe/migdałowe/ryżowe/kokosowe”, „napój owsiany/roślinny” trafiają do działu „Napoje”, nie do Nabiału. Zwykłe mleko (także 2%, UHT, bez laktozy) zostaje w Nabiale.
  Soki i nektary („sok pomarańczowy”) też trafiają do „Napoje”, a nie do warzyw i owoców.
- Forma bezosobowa zamiast męskiej we wszystkich komunikatach do użytkownika (np. „Wpisano 3 cyfry”, „Ten produkt dodano…”, „Masz status zaufanego odkrywcy”).
- Gramatura bez znaku ℮ zapisanego w bazie jako „e” („400 g e” → „400 g”).
- Lista kategorii: ta sama liczba produktów na przycisku sklepu i w zdaniu „sprawdziliśmy…”; produkty bez danych do oceny nazwane wprost („1 pominęliśmy – za mało danych”).
- Pierwsze uruchomienie: wybory „Tylko dla siebie / Dla siebie i domowników” i kafle celów mają nazwy dla czytnika ekranu.
- Testy: `tests/e2e-d-drobne.mjs`, nowe przypadki w `tests/unit-d.cjs`.

## Porównanie w kategorii: właściwa kategoria (29.10.2026, wersja 3.0.15)

- Porównanie „Na tle podobnych produktów” i „Zamień na lepsze” brały dwie ostatnie kategorie z bazy. Bywały to kategorie bez danych albo inne produkty
  (krem czekoladowy porównywany z kakao w proszku, bez zamienników).
- Teraz aplikacja bierze najwęższą kategorię, która ma dane i w której większość produktów ma tę samą postać (krem ↔ krem). Kategorie bez pliku
  i o innej postaci pomija (`A.pickCompareCats` w `app/ui-product.js`). Zasada „ta sama postać” dla zamienników (`sameUse`) bez zmian.
- Test: `tests/e2e-d-catpick.mjs` (produkt, którego hierarchia kończy się kategorią bez pliku i kakao w proszku).

## „Słodkie kremy” bez dżemów i miodów (29.10.2026, wersja 3.0.14)

- Kategoria Open Food Facts `en:sweet-spreads` obejmuje też dżemy, powidła, miody i musy owocowe, więc lista „Słodkie kremy” pokazywała głównie je.
  Teraz lista i strona albumu „Słodkie kremy” pomijają produkty z tagami dżemów, miodów i przetworów owocowych albo z takimi słowami w nazwie (`CAT_LIST_FILTER` w `app/data.js`, `catListFilter` w `app/core.js`).
- Na dziś zostaje ok. 40 kremów (czekoladowe, orzechowe, karmelowe, masy krówkowe). Dżemy i powidła są w kaflu „Dżemy”.
- Klucz kategorii się nie zmienił, więc zebrane karty w albumie zostają.

## Zaproszenie do testów w Google Play (29.10.2026, wersja 3.0.13)

- Na ekranie Start, pod wyszukiwarką, karta „Masz Androida? Pomóż Lupce trafić do Google Play” z linkiem do lupka.app/testuj/.
- Widać ją tylko na Androidzie w zwykłej przeglądarce. Nie pokazuje się w aplikacji z Google Play, na iPhonie, na komputerze ani w zainstalowanej aplikacji (PWA).
- × chowa kartę na stałe. Bez punktów, nic nie jest wysyłane. Test: `tests/e2e-d-testbanner.mjs`.

## Komunikaty listy (29.10.2026, wersja 3.0.12)

- Informacje pod polem listy („Dodano 2 rzeczy…”, „Słucham…”, „Przywrócono…”) są szare, a na czerwono zostają tylko błędy (np. brak zgody na mikrofon, rzecz już na liście).

## Dyktowanie i edycja listy (29.10.2026, wersja 3.0.11)

- Dyktowanie: słowa, które telefon (zwłaszcza Samsung) oddaje osobno, czekają w polu do pauzy w mówieniu i dopiero wtedy dzielą się na rzeczy. „herbata zielona Teekanne” i „ogórki kiszone” to teraz po jednej pozycji.
- Wpisaną rzecz można poprawić: stuknięcie w nazwę albo w ilość otwiera nazwę, ilość i jednostkę. Po zmianie nazwy dział liczy się od nowa.

## Przed publikacją w Google Play (29.10.2026, wersja 3.0.10)

- Przycisk w Ustawieniach nazywa się „Usuń wszystkie moje dane”, bo kasuje też dane na serwerze odkrywców. Tak samo nazywa go polityka prywatności.
- Polityka prywatności: aplikacja z Google Play otwiera się w przeglądarce telefonu (Chrome albo Samsung Internet), a nie zawsze w Chrome.
- Odpowiedź dla rodziny w dopełniaczu: „Nie dla Kuby i Ani” zamiast „Nie dla: Kuba, Ania”. Imiona, których nie umiemy odmienić, zostają w starej formie.
- Album nie ma strony „Piwa”, a za alkohol (piwo, wino, mocne alkohole) nie ma kart. Skład takiego produktu nadal można sprawdzić.

## Ilość na liście zakupów (29.10.2026, wersja 3.0.9)

- Ilość przy pozycji listy ma postać pigułki ze strzałką, więc widać, że po stuknięciu można zmienić ilość i jednostkę.
- Długie nazwy na liście zawijają się do dwóch linii zamiast ucinać się po jednej.

## Drobne poprawki Profilu (29.10.2026, wersja 3.0.8)

- Ekran „Domownicy” ma przycisk „Gotowe”, a nazwa osoby na zakładce zmienia się w trakcie wpisywania.
- Plakietka „✓ Zapisano” nie przesuwa już ekranu. Wcześniej pierwsze stuknięcie po wpisaniu imienia mogło trafić obok przycisku.
- Po „Usuń dane z urządzenia” ekran przewija się do potwierdzenia, które jest wyróżnione na czerwono.

## Pierwsze uruchomienie w stylu Profilu (29.10.2026, wersja 3.0.7)
- Kroki: 1) imię i „Tylko dla siebie” / „Dla siebie i domowników”, 2) cele (kafelki), 3) czego nie jesz (lista jak Wykluczenia), 4) domownicy (tylko przy rodzinie): lista osób, panel „Nowa osoba” (imię + czego nie je), zmiana i usuwanie.
- Na każdym kroku „Wszystko to możesz zmienić później w Profilu”, na ostatnim zwinięte „Jak liczymy dopasowanie?”. Przyciski na dole przypięte.
- Test: `tests/e2e-d-start.mjs`.

## Aplikacja na Androida (28.10.2026, wersja 3.0.6)
- Google Play: konto osobiste „Lupka”, pakiet `app.lupka` (Trusted Web Activity – lupka.app/app/ w Chrome). Projekt z `android/twa-manifest.json` budowany przez @bubblewrap/core w GitHub Actions (`.github/workflows/android.yml`, ręcznie albo po zmianie android/), podpis kluczem przesyłania z sekretów ANDROID_KEYSTORE_BASE64 / ANDROID_KEYSTORE_PASSWORD (klucz poza repozytorium). Wynik: artefakt `lupka-android` (.aab). minSdk 24.
- `/.well-known/assetlinks.json`: odcisk klucza przesyłania; po pierwszym wgraniu trzeba dopisać odcisk klucza podpisu Google Play (App integrity), inaczej TWA pokazuje pasek adresu.
- `color-scheme: only light` w aplikacji i na stronach: Chrome nie przyciemnia automatycznie (tryb ciemny telefonu).
- Polityka prywatności 28.10.2026: sekcja o Google Play i głosach na sklepy.

## Poprawki sklepów po teście 3.0.4 (28.10.2026, wersja 3.0.5)
- Lista sieci działających w Polsce rozszerzona do 28 (m.in. E.Leclerc, Społem, Mila, Globus, Delikatesy Centrum, Topaz, Chata Polska, Groszek, Freshmarket, Makro, Selgros, Dealz; bez Tesco). Ta sama lista w pośredniku (STORE_NAMES).
- A.storeKeyOf łączy warianty i literówki ze znaną siecią (alias, odległość edycyjna 1–2), krótkie nazwy tylko jako osobne słowo („Kamila” ≠ Mila).
- Profil → Ulubione sklepy: tylko sprawdzona lista + Twoje sklepy; bez podpowiedzi z surowych nazw z bazy (zagraniczne sieci, literówki). Limit 8 egzekwowany przy zaznaczaniu (komunikat, zapis bez zmian).
- Lista kategorii: panel „W którym sklepie?” liczy wszystkie ocenione produkty (z liczbą dobrze dopasowanych), także wskazane przez Ciebie; sklep bez dobrych produktów pokazuje jego produkty z wyjaśnieniem.

## Sklepy spoza listy i kraj zakupów (28.10.2026, wersja 3.0.4)
- Kopia bazy zapisuje `data/stores.json`: sklepy wpisywane przy produktach w Open Food Facts w Polsce (najczęstsza pisownia, liczba produktów, min. 2, do 200; `store_catalog` w scripts/build_data.py).
- Aplikacja: dowolny sklep ma klucz `x:<nazwa bez znaków>` (A.storeKeyOf, A.storeSlug), nazwy własnych sklepów w `d-storenames`, katalog z kopii w `d-storecat` (A.loadStoreCatalog). Do 8 ulubionych sklepów.
- Profil → Ulubione sklepy: znane sieci, Twoje sklepy, najczęstsze sklepy z bazy; pole „Nie ma Twojego sklepu?” z podpowiedziami.
- Lista kategorii: w panelu „W którym sklepie?” wszystkie sklepy obecne przy produktach (Twoje na górze).
- „Kupujesz to w:” z własnym sklepem: głos `POST /disc/store` (pośrednik, D1: store_votes, store_added). Do Open Food Facts (add_stores) dopiero po 3 różnych osobach (urządzenia i skróty IP), w najczęstszej pisowni. Znane sieci jak dotąd od razu. Twój wybór działa od razu w telefonie (d-storetag).
- Ustawienia: „Kraj zakupów: Polska” (A.country; inne kraje razem z wersjami językowymi).
- Testy: `tests/e2e-d-stores.mjs`, `tests/worker-disc-test.mjs`, `scripts/test_build_data.py`.

## Poprawki po teście 3.0.2 (28.10.2026, wersja 3.0.3)
- Własny skład/wartości z telefonu (mergeLocal oznacza prod.localIngr/localNut): przy każdym otwarciu panel „Skład wpisany przez Ciebie – tylko w tym telefonie” i „Usuń mój wpis i wróć do danych z bazy” (A.clearLocal). Formularz ręcznego składu od razu mówi, że wpis zostaje w telefonie.
- „Ukryj punkty i nagrody”: bez „+10/+20” na liście „Uzupełnij dane” i bez „Nagroda odkrywcy”/„do nagrody” przy nieznanym kodzie.
- Lista kategorii: sklep jako jeden przycisk „Sklep: … ▾” z panelem „W którym sklepie?” (jak „Dla kogo kupujesz?”); nazwa produktu na pełną szerokość, przyciski w drugim rzędzie.
- „Twoje odkrycia”: przycisk „Skanuj brakujący produkt”.

## Poprawki po ponownym teście (28.10.2026, wersja 3.0.2)
- Braki danych jedną regułą (A.dataGaps): także wynik bez części odżywczej (brak Nutri-Score i danych do jego wyliczenia) jest „wstępny”.
- „Na tle podobnych”: przy brakach danych bez „lepszy niż X%” i „jeden z lepszych wyborów”, tylko wyjaśnienie. Wyszukiwarka i listy kategorii: „Wstępnie: …” (A.preLabel).
- Zamienniki: postać produktu musi się zgadzać (krem do smarowania, napój, przekąska…), grupy „X i jego przetwory” są za szerokie (Nutella ≠ kakao w proszku).
- Lista zakupów: wynik przy produktach liczony przy każdym otwarciu listy dla wybranych teraz osób; bez danych w telefonie wiersz nie pokazuje starego wyniku, a dane się dociągają.
- „Ukryj punkty i nagrody”: bez „+N pkt” także przy sklepie, uzupełnianiu, zdjęciu, zamianie, dodawaniu produktu i potwierdzaniu (A.pt). Ekrany Kart pokazują punkty jak dotąd.
- Profil: autozapis, przyciski „Gotowe” zamiast „Zapisz …” i informacja „Zmiany zapisują się od razu”.
- Test: nowe przypadki w `tests/e2e-d-raport.mjs`.

## Drobne poprawki (28.10.2026, wersja 3.0.1)
- „Dlaczego dla Kuby”: imię w dopełniaczu (A.nameGen, najczęstsze polskie końcówki; imię z kilku słów albo nietypowe → „Dlaczego: Imię”).
- Domyślna lista nazywa się „Tygodniowe” (mieści się w nagłówku); istniejące „Zakupy tygodniowe” zmieniamy przy starcie.

## Nowy wygląd ekranów (28.10.2026, wersja 3.0.0)
Projekt z makiet zatwierdzonych przez właściciela (zasady design-taste-frontend: kolor tylko dla znaczenia, nagłówki zdaniem, liczby krojem tekstu, cienkie linie zamiast kart w kartach). Talerze, łuki w tle i logo zostają.
- Dolne menu: ikony obrysowe, „Start / Zakupy / Skanuj / Karty / Profil”; wysunięty okrągły przycisk skanu z podpisem.
- Produkt: obręcz talerza = wynik całej rodziny (łuk proporcjonalny, szara reszta), obok kwadrat z procentem i zdanie „Nie dla: Kuba” bez tła; pod talerzem plakietki osób z pełnym imieniem i kolorowym wynikiem (✕/?), stuknięcie = wyjaśnienie dla osoby; „Na listę” i „Porównaj” zaraz pod nazwą; kategoria jako link w linii marki; bez napisu „Zeskanowany produkt”; nagłówki zdaniem.
- Zakupy: zawsze jedna linia nagłówka (nazwa listy ▾, Udostępnij, ⋯); panel „Twoje listy” (przełączanie, nowa, zmiana nazwy, usuń kupione, usuń listę z potwierdzeniem, limit 3 za darmo); pasek „w koszyku X z Y”; szybkie dodawanie w jednym przewijanym rzędzie; wiersze w białych grupach z kolorowym statusem („pasuje wszystkim”, „nie dla: Kuba”). W tekstach „lista” zamiast „półka” (w kodzie dalej shelf).
- Start: logo + punkty; wyszukiwarka „Czego szukasz, Ola?” z podpowiedzią, co wpisać; „Kupujesz dla” jako przełącznik Cała rodzina / Tylko ja / Wybierz… (panel z osobami) i jedna linia „Wynik liczymy dla…”; karta bieżącej listy; „Ostatnio sprawdzone” jako rząd talerzy z powodem i wynikiem na równej wysokości. Karta postępów przeniesiona do Kart.
- Profil: spis (Domownicy, Preferencje, Wykluczenia, Ulubione sklepy, Ustawienia, Informacje i pomoc) z osobnymi ekranami `#/profil/<nazwa>`; wszystkie pola w jednym formularzu (ukryte poza aktywnym ekranem), autozapis jak wcześniej; przełączniki w Ustawieniach.
- Karty: nagłówek z poziomem i paskiem, przełącznik Album/Odznaki, ciemne „Polowanie tygodnia”, statystyki w jednej linii, „Twoje strony” (postęp i czego brakuje), „Do odkrycia” (szare talerze, 8 + „Pokaż wszystkie”), „Zdobądź więcej” (wyzwanie tygodnia, uzupełnianie, dodanie produktu).
- Testy e2e-d-* dostosowane do nowych ekranów.

## Poprawki po teście konsumenckim (28.10.2026, wersja 2.9.0)
- Skaner: paski porównania i nagród chowają się (body.scanning), więc nie zasłaniają wpisywania kodu.
- Pasek „Nowa karta / odznaka” po 4 s (albo przy przewijaniu) zwija się do małego przycisku „Odbierz” z prawej.
- Niepełne dane (brak składu albo wartości odżywczych, A.dataGaps): przy wyniku „Wstępnie: …” i ramka „Wynik wstępny”; „Ocena składu: brak danych” zamiast liczby (rachunek, szczegóły, porównanie); „wynik wstępny” w historii i na kartach porównania; w porównaniu „X ma pełniejsze dane” zamiast „Lepszy wybór”, bez procentu w nagłówku.
- Gdy porównanie jest aktywne, przycisk nagrody chowa się (karta czeka w Kolekcji), a pod paskiem porównania jest zarezerwowane miejsce.
- Ekran „nie znamy”: „Szybko: oceń skład z etykiety” zaraz pod sprawdzeniem kodu; nagroda odkrywcy w jednym krótkim panelu.
- „Ukryj punkty i nagrody” (Profil → Ustawienia, settings.shopMode): bez punktów na ekranie, kart, gratulacji, karty postępów i „Zgadnij”; karty i odznaki zbierają się w tle.
- Zamienniki i podpowiedź dla rodziny tylko o tym samym zastosowaniu: wspólna kategoria węższa niż ogólne grupy (A.sameUse), np. krem kakaowy nie dostaje powideł.
- Test: `tests/e2e-d-raport.mjs`.

## Odświeżanie po uzupełnieniu i aktualna lista misji (28.10.2026, wersja 2.8.3)
- „Uzupełnij dane”: lista z data/uzupelnij.json powstaje z indeksu wyszukiwarki OFF, który bywa nieaktualny. Przed pokazaniem sprawdzamy widoczne pozycje przez /details; produkty, które mają już skład i wartości, chowamy (d-fill-ok), a brakującą część poprawiamy.
- Po zapisie składu lub wartości produkt jest pobierany z bazy jeszcze raz (po 2,5 s i 9 s), bo dopiero baza rozpoznaje ze składu alergeny, dodatki i dietę. Wynik i kółka domowników odświeżają się bez przeładowania strony.
- Test: `tests/e2e-d-uzup2.mjs`.

## Dyktowanie z pauzami i bez przecinków (23.10.2026, wersja 2.8.2)
- Po teście: słuchanie wyłączało się po pierwszej pauzie, a „pomidory ziemniaki banany” (rozpoznawanie mowy nie wstawia przecinków) było jedną pozycją.
- Słuchanie ciągłe (continuous): każdy fragment po pauzie od razu trafia na półkę. Gdy przeglądarka sama zakończy rozpoznawanie, uruchamiamy je ponownie. Koniec: stuknięcie mikrofonu, 8 s ciszy (A.dictIdleMs) albo 2 minuty; przejście na inny ekran też kończy. Android potrafi powtarzać poprzednie słowa w kolejnym wyniku – takie powtórzenia pomijamy.
- Shelf.splitSpeech bez przecinków: nową pozycję zaczyna rzeczownik produktu (słownik NOUNS: rdzenie z działów sklepu i popularne zakupy) albo liczebnik, gdy bieżąca pozycja ma już produkt. Nie dzielimy po przyimku („pasta do zębów”, „sok z pomarańczy”), przed przymiotnikiem („masło orzechowe”, „chleb żytni”; końcówka po rdzeniu, odmiana typu „makarony” zostaje rzeczownikiem) ani po liczbie i jednostce. Ilość po nazwie („mleko 2 litry chleb”) należy do poprzedniej rzeczy, przed dopełniaczem („2 kilo ziemniaków”) do następnej. Separatory słowne: i, oraz, a także, przecinek, kropka, potem, jeszcze, też, plus.
- Słowa spoza słownika nigdy nie dzielą pozycji (np. „pomidory cherry”); w razie wątpliwości lepiej powiedzieć „i” między produktami.
- Testy: `tests/e2e-d-lista.mjs` (udawane rozpoznawanie: pauzy, samoczynne kończenie, powtórzenia z Androida, cisza), `tests/unit-d.cjs`.

## Alergeny tylko od początku wyrazu (23.10.2026, wersja 2.8.1)
- Słowa alergenów i składników (gluten, mleko, orzechy, cukier, olej palmowy…) szukamy tylko na początku wyrazu. Wcześniej dżem malinowy ze składem „100 g malin zużyto…” był oznaczany jako zawierający gluten, bo „zużyto” zawiera „żyto”. To samo w archiwum. Testy: unit-d, unit-core.

## Lista zakupów: dyktowanie, podpowiedzi, zamiana ogólnej pozycji (23.10.2026, wersja 2.8.0)
- Dyktowanie: przycisk mikrofonu przy polu „Dodaj rzecz” (tylko gdy przeglądarka ma SpeechRecognition / webkitSpeechRecognition). Rozpoznawanie po polsku, jedna wypowiedź, wynik pośredni widać w polu. Shelf.splitSpeech dzieli po przecinkach, „i”, „oraz”, „a także”; liczebniki słownie 1–10 i „pół” na początku to ilość, mówione jednostki („kilo”, „litry”, „deko”) zamieniane na kg/l/g. Każda pozycja przechodzi przez parseQty i dział sklepu jak przy wpisaniu. Komunikat „Dodano 3 rzeczy: …”; brak zgody, brak sieci, cisza – krótki komunikat, pole działa dalej.
- Podpowiedzi przy pisaniu (od 2 znaków, do 5): ♥ ulubione (d-fav), ↻ kupowane (d-bought), ＋ produkty wcześniej dodawane na półki (nowy klucz d-added, do 150, oraz produkty z kodem na wszystkich półkach). Dopasowanie po początkach słów bez polskich znaków. Pomijamy to, co już leży nieodhaczone na półce. Stuknięcie dodaje konkretny produkt (kod, ocena), z ilością wpisaną w polu („2 jog”). Enter bez wyboru – pozycja ogólna jak dotąd. Pole jest combobox z listbox i aria-activedescendant; strzałki, Enter, Escape.
- Zamiana: A.addToShelf (skan, ekran produktu, listy, porównanie) szuka na półce nieodhaczonej pozycji bez kodu, której nazwa zaczyna słowo w nazwie produktu (dla jednego słowa ≥5 liter wystarczy rdzeń: „jogurty” → „Jogurt”) albo której kategoria zgadnięta z nazwy (A.guessCategory, lista GUESS) jest kategorią produktu. Pierwsza pasująca zostaje zastąpiona produktem (Shelf.replaceItem: ta sama ilość, miejsce i data), od razu w koszyku i w d-bought. Komunikat „Zamieniono „mleko” na … · w koszyku” z „Cofnij” (7 s; Shelf.undoReplace przywraca pozycję nieodhaczoną i wpis d-bought).
- A.toast przyjmuje czas wyświetlania jako trzeci argument.
- Testy: `tests/e2e-d-lista.mjs` (udawane rozpoznawanie mowy), `tests/unit-d.cjs` (splitSpeech, findGeneric, replaceItem).

## Ostrość skanera i statystyki strony (22.10.2026, wersja 2.7.5)
- Skaner: na telefonach z kilkoma tylnymi aparatami system bywa, że daje szerokokątny bez autofokusa (ostry tylko na jedną odległość). Jeśli domyślny aparat nie ma ciągłego autofokusa, sprawdzamy inne tylne aparaty i bierzemy pierwszy z autofokusem; wybór zapamiętany w d-cam. Rozdzielczość do 1920×1080, ciągła ostrość, zoom 1,5× (gdy aparat ma co najmniej 2×), stuknięcie w obraz ponownie ustawia ostrość. iPhone (bez informacji o ostrości) bez zmian. Podpowiedź po 6 s: 20–30 cm.
- Strona lupka.app (poza aplikacją) liczy odsłony w GoatCounter (ścieżki „strona/…”, z adresem, skąd przyszedł odwiedzający), bez ciasteczek, z poszanowaniem „Nie śledź”. Polityka prywatności uzupełniona.
- Test: `tests/e2e-d-camera.mjs` (udawane aparaty Chromium).

## Zdjęcie opakowania (22.10.2026, wersja 2.7.4)
- Produkt z nazwą, ale bez zdjęcia przodu: na ekranie produktu przycisk „Zrób zdjęcie opakowania (+10 pkt)”. Jedno stuknięcie otwiera aparat, zdjęcie idzie przez /image (field=front) do OFF. Gdy brakuje też składu lub wartości, przycisk jest pod „Uzupełnij”.
- Wysłane kody pamiętamy w d-front, żeby nie prosić drugi raz, zanim baza pokaże zdjęcie.

## Kolekcja i nowa karta (22.10.2026, wersja 2.7.3)
- Kafelki „Twoja kolekcja” (karty, pełne strony, legendarne, błyszczące) są linkami do zestawień: #/album/karty, /pelne, /legendarne, /blyszczace. Przy zerze zestawienie wyjaśnia, jak je zdobyć.
- Odsłonięta karta: przyciski „Wynik produktu” / „Zobacz stronę” przyklejone do dołu ekranu, karta mniejsza (190 px), opis przewija się pod przyciskami.

## Po pierwszym teście w sklepie (22.10.2026, wersja 2.7.2)
- Półka: kupione znikają z działów do zwiniętego „W koszyku: N” (można je rozwinąć i odznaczyć). „Szybko dodaj”: ulubione (♥ przy produkcie, d-fav) i rzeczy kupione co najmniej 2 razy (↻, d-bought).
- Pitne produkty mleczne (jogurty, kefiry, maślanki, skyr pitny…) mają Nutri-Score liczony algorytmem dla napojów (Nutri-Score 2023), niezależnie od oceny w bazie. Wcześniej dwa skyry pitne o identycznych wartościach miały w OFF B i E tylko przez inną kategorię.
- Produkt bez nazwy: pierwszy krok uzupełniania to nazwa, kategoria (podpowiadana z nazwy) i zdjęcie przodu; potem skład i wartości.
- Wyszukiwarka pokazuje tylko produkty z największą liczbą trafionych słów zapytania (odmiana: wiśnia/wiśniowy), a nie wszystkie „jogurty”.
- Skaner przyjmuje kod dopiero po 2 identycznych odczytach (EAN-8: 3); po 6 s podpowiedź (odległość, latarka, puszki). Ekran „nie znamy” ma pole z zeskanowanymi cyframi do poprawienia.
- „Skanuj drugi” w porównaniu: zeskanowany produkt od razu trafia do porównania i otwiera jego ekran.
- Test: `tests/e2e-d-sklep2.mjs`.

## Polskie nazwy (22.10.2026, wersja 2.7.1)
- W Open Food Facts jest ok. 12 tys. produktów z polskim kodem 590…, opisanych tylko w obcym języku. Nie trafiają do naszej kopii (wyszukiwarka, listy), bo pokazywalibyśmy francuskie nazwy.
- build_data zapisuje 500 najpopularniejszych z nich (ze zdjęciem przodu) w data/uzupelnij.json → names. W „Uzupełnij dane” zakładka „Polskie nazwy”: zdjęcie przodu, nazwa z bazy, pole na polską nazwę; Enter zapisuje i od razu otwiera następny; „Nie ma polskiej nazwy” pomija.
- Pośrednik /edit przyjmuje product_name (zapis product_name_pl tylko, gdy go nie ma). Punkty: name_added (5 pkt, do 50 dziennie, raz na produkt). Po cotygodniowej aktualizacji produkt z polską nazwą trafia do wyszukiwarki i list.

## Więcej polskich produktów i łatwiejsze uzupełnianie (22.10.2026, wersja 2.7.0)
- Kopia bazy: oprócz produktów z oznaczeniem „Polska” (ok. 21 tys.) dociągamy produkty z polskim kodem 590…, którym tego oznaczenia brakuje (ok. 12,6 tys.), ale tylko opisane po polsku (język „pl” albo polska nazwa).
- data/uzupelnij.json (co tydzień): 500 najpopularniejszych produktów, które mają w bazie zdjęcie składu lub tabeli, ale nikt ich nie przepisał (stany Open Food Facts). Ekran #/uzupelnij („Uzupełnij dane” w Kolekcji): uzupełnianie bez produktu w ręku, od razu otwiera się na produkcie; zrobione i pominięte w d-fill.
- Pośrednik /ocr z field=nutrition: odczyt Google Vision, który Open Food Facts trzyma przy każdym zdjęciu, tylko słowa z wybranego wycinka, ułożone w wiersze. Aplikacja (A.parseNutText) wyciąga liczby (wierszami albo kolumnami, wykrywa „na 100 ml”), pola odczytane są zaznaczone do sprawdzenia; A.nutProblem pilnuje, żeby kalorie pasowały do makroskładników.
- Gdy brakuje i składu, i wartości: jeden ekran z oboma i jeden zapis (+20 pkt). Po dodaniu nowego produktu odczyt czeka na świeże zdjęcia (do 5 prób).
- Dodawanie produktu: kategoria (podpowiadana z nazwy, wymagana, „Inna” dozwolona), marka i gramatura opcjonalnie; pośrednik zapisuje je w Open Food Facts.

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

