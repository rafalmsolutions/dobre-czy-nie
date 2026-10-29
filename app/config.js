/* Dobre czy nie? – ustawienia, które możesz zmienić bez znajomości kodu.

   Zgłoszenia błędów od użytkowników:
   - reportEndpoint: adres formularza, który przyjmuje dane (np. darmowe konto na formspree.io:
     utwórz formularz i wklej tu adres w rodzaju 'https://formspree.io/f/abcdwxyz').
   - reportEmail: jeśli nie masz formularza, wpisz adres e-mail. Aplikacja otworzy pocztę z gotowym zgłoszeniem.
   - contactEmail: adres kontaktowy pokazywany w aplikacji i w polityce prywatności.

   Dodawanie brakujących produktów do Open Food Facts:
   - offProxyUrl: adres pośrednika (Cloudflare Worker z folderu worker/), np. 'https://dcn-off.twoja-nazwa.workers.dev'.
     Pośrednik trzyma hasło do konta aplikacji w Open Food Facts. Hasło NIGDY nie trafia do tego pliku.
     Puste pole = aplikacja pokazuje instrukcję dodania produktu w aplikacji Open Food Facts. */
const CONFIG = {
  reportEndpoint: '',
  reportEmail: 'rafalmsolutions@gmail.com',
  contactEmail: 'rafalmsolutions@gmail.com',
  offProxyUrl: 'https://dcn-off-proxy.rafalmsolutions.workers.dev',
  // goatcounter: kod strony w GoatCounter (np. 'dobreczynie' dla https://dobreczynie.goatcounter.com).
  // Anonimowe statystyki bez ciasteczek: które ekrany i funkcje są używane, ile osób wraca w kolejnych tygodniach.
  // Puste pole = statystyki wyłączone.
  goatcounter: 'dobreczynie',
  appVersion: '3.0.14'
};
