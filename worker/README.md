# Pośrednik do Open Food Facts (Cloudflare Worker)

Pośrednik robi dwie rzeczy:

- **Listy „Najlepsze” i porównanie po skanie.** Stara wyszukiwarka Open Food Facts odrzuca zapytania anonimowych użytkowników („Strona tymczasowo niedostępna”) i ma limit 10 zapytań na minutę. Nowa wyszukiwarka (search.openfoodfacts.org) jest szybka, ale nie przyjmuje zapytań prosto z przeglądarki. Pośrednik pyta ją w imieniu aplikacji i zapamiętuje wynik na dobę. Teraz listy i porównanie korzystają głównie z własnej kopii danych publikowanej z aplikacją (zob. README w głównym folderze); `/category` jest zapasem.
- **Dodawanie brakujących produktów:** użytkownik dodaje produkt prosto z aplikacji i dostaje nagrodę odkrywcy.
Pośrednik trzyma login i hasło konta aplikacji w Open Food Facts. Hasło nigdy nie trafia do kodu aplikacji ani do tego folderu.

Koszt: 0 zł (darmowy plan Cloudflare Workers: 100 000 zapytań dziennie).

## Co robi przy listach

`GET /category?tag=en:yogurts` zwraca do 200 najpopularniejszych produktów z kategorii sprzedawanych w Polsce, tylko z polami potrzebnymi aplikacji (ok. 100 KB). Wynik trzyma w pamięci Cloudflare przez dobę, więc Open Food Facts dostaje najwyżej jedno zapytanie na kategorię dziennie.

## Co robi przy dodawaniu produktu

1. Przyjmuje od aplikacji: kod kreskowy, nazwę produktu i 3 zdjęcia (przód, skład, wartości odżywcze).
2. Sprawdza dane: sumę kontrolną kodu, długość nazwy, czy pliki są naprawdę zdjęciami (po pierwszych bajtach), rozmiar do 6 MB.
3. Przyjmuje zapytania tylko z adresu Twojej aplikacji (`ALLOWED_ORIGINS`) i najwyżej 12 na godzinę z jednego adresu IP.
4. Nie nadpisuje produktu, który ktoś już dodał.
5. Zapisuje produkt w Open Food Facts kontem aplikacji, z `app_name`, `app_version` i losowym `app_uuid` użytkownika.
6. Niczego nie zapisuje u siebie.

## Najprościej: uruchomienie z GitHuba (ok. 10 minut, bez instalowania czegokolwiek)

1. **Konto Cloudflare:** https://dash.cloudflare.com/sign-up (może być rafalmsolutions@gmail.com). Wejdź raz w **Workers & Pages** i wybierz nazwę subdomeny `workers.dev`, jeśli Cloudflare o nią zapyta.
2. **Account ID:** w **Workers & Pages** po prawej stronie jest **Account ID**. Skopiuj go.
3. **Token API:** ikona profilu → **My Profile → API Tokens → Create Token** → szablon **Edit Cloudflare Workers** → **Use template** → w **Account Resources** wybierz swoje konto → **Continue to summary → Create Token**. Skopiuj token (widać go tylko raz).
4. **Sekrety w GitHubie:** https://github.com/rafalmsolutions/dobre-czy-nie/settings/secrets/actions → **New repository secret**, cztery razy:
   - `CLOUDFLARE_API_TOKEN`: token z kroku 3;
   - `CLOUDFLARE_ACCOUNT_ID`: Account ID z kroku 2;
   - `OFF_USER`: nazwa użytkownika konta aplikacji w Open Food Facts (nie e-mail). Na start konto z serwera testowego `world.openfoodfacts.net`;
   - `OFF_PASS`: hasło do tego konta.
5. **Uruchomienie:** https://github.com/rafalmsolutions/dobre-czy-nie/actions/workflows/worker.yml → **Run workflow**.
6. Adres pośrednika znajdziesz w Cloudflare: **Workers & Pages → dcn-off-proxy** (np. `https://dcn-off-proxy.twoja-nazwa.workers.dev`). Ten adres trzeba wpisać w `config.js` (`offProxyUrl`). Wtedy w aplikacji włączy się dodawanie produktów.

Hasła i token są tylko w sekretach GitHuba i Cloudflare. Nie ma ich w kodzie ani w historii repozytorium.

## Uruchomienie z własnego komputera (ok. 15 minut)

Potrzebujesz komputera z Node.js (https://nodejs.org, wersja LTS).

1. Załóż darmowe konto na https://dash.cloudflare.com/sign-up (może być rafalmsolutions@gmail.com).
2. Najpierw testy na serwerze testowym Open Food Facts. Załóż tam osobne konto: https://world.openfoodfacts.net
   (przeglądarka zapyta o login i hasło do samej strony: wpisz `off` i `off`).
3. W tym folderze otwórz terminal i wpisz:
   ```
   npx wrangler login
   ```
   Otworzy się przeglądarka. Zaloguj się do Cloudflare i zezwól.
4. W pliku `wrangler.toml` w `ALLOWED_ORIGINS` jest już adres aplikacji: `https://rafalmsolutions.github.io`. Zmień go tylko, jeśli przeniesiesz aplikację gdzie indziej.
5. Dodaj sekrety (wpisujesz je w terminalu, nigdzie nie są zapisywane w plikach):
   ```
   npx wrangler secret put OFF_USER
   npx wrangler secret put OFF_PASS
   ```
   Na tym etapie wpisz login i hasło konta z serwera TESTOWEGO.
6. Wyślij pośrednika do Cloudflare:
   ```
   npx wrangler deploy
   ```
   Na końcu zobaczysz adres w rodzaju `https://dcn-off-proxy.twoja-nazwa.workers.dev`.
7. Sprawdź, czy działa: otwórz w przeglądarce ten adres z `/health` na końcu. Powinno pokazać `{"ok":true}`.
8. W aplikacji, w pliku `config.js`, wpisz ten adres w `offProxyUrl` i wrzuć aplikację na hosting.
9. Dodaj w aplikacji testowy produkt z nieistniejącym kodem i sprawdź go na https://world.openfoodfacts.net.

## Przejście na prawdziwą bazę

Gdy test się uda:
1. W `wrangler.toml` zmień `OFF_BASE` na `https://world.openfoodfacts.org` i usuń linię `OFF_BASIC`.
2. Podmień sekrety na dane konta aplikacji w prawdziwej bazie (`rafalmsolutions@gmail.com` ma tam konto; jako `OFF_USER` wpisz **nazwę użytkownika**, nie e-mail):
   ```
   npx wrangler secret put OFF_USER
   npx wrangler secret put OFF_PASS
   npx wrangler deploy
   ```

## Dodatkowa ochrona (zalecane)

W panelu Cloudflare: Security → WAF → Rate limiting rules → dodaj regułę dla ścieżki `/product`, np. 20 zapytań na 10 minut z jednego IP.
Wbudowany limit w kodzie działa tylko w obrębie jednej instancji serwera.

## Odpowiedzi pośrednika

Odpowiedzi przy dodawaniu produktu:

| Kod | Znaczenie | Co pokazuje aplikacja |
|---|---|---|
| 200 `{ok:true}` | zapisane | gratulacje i +50 pkt |
| 400 | złe dane (kod, nazwa, zdjęcie) | „Baza nie przyjęła tego produktu” |
| 403 | zapytanie spoza aplikacji | – |
| 409 | ktoś już dodał ten produkt | „Ktoś właśnie dodał ten produkt” |
| 429 | za dużo prób | zapis w kolejce i ponowna próba później |
| 502 | Open Food Facts nie odpowiada | zapis w kolejce i ponowna próba później |

Testy automatyczne pośrednika: `node tests/worker-test.mjs` (bez łączenia się z prawdziwą bazą).
