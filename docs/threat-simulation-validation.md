# Sprint 4A — raport walidacji

Raport opisuje diagnostykę silnika. Ukryte wyniki nie są logami SOC i nie są
udostępniane przez bieżący `selectPlayerView` ani ekran rozgrywki.

## Wyniki pełnych przebiegów

Każda ścieżka zaczyna się od identycznego `createInitialSimulation()` i wykonuje
dokładnie 18 tur. Różnią się wyłącznie komendami gracza; nie zmienia się fixture,
poświadczenie, uprawnienie ani plan przeciwnika.

| Ścieżka | Decyzja                                    | Ujawnione rekordy | Otrzymane zamówienia | Obsłużone | Zaległe | Stan przeciwnika |
| ------- | ------------------------------------------ | ----------------: | -------------------: | --------: | ------: | ---------------- |
| A       | Brak reakcji                               |              2000 |                  360 |       360 |       0 | `completed`      |
| B       | Blokada R-SMB: zlecona 14:00, gotowa 14:10 |                 0 |                  360 |       360 |       0 | `blocked`        |
| C       | Blokada R-SMB: zlecona 14:15, gotowa 14:25 |               400 |                  360 |       360 |       0 | `blocked`        |

W A rekonesans następuje o 14:10, start transferu o 14:15, a porcje 400/800/800
o 14:20/14:25/14:30. Nie ma kolejnego etapu wycieku przez Internet.
W B reguła wygrywa z próbą rekonesansu na tej samej granicy czasu; próby o 14:10,
14:20 i 14:30 kończą się odmową. W C pierwsze 400 rekordów dociera o 14:20,
a druga porcja zostaje zablokowana o 14:25. Pozostałe próby również nie udają się.
SMB i HTTPS mają różne reguły, dlatego proces biznesowy nadal obsługuje 360 zleceń.

Pozostałe potwierdzone liczby z testów:

- Samo zakończenie S-19 o 14:10: logowanie o 14:20 daje nowy tunel S-20;
  po osobnym rekonesansie i starcie porcje docierają o 14:35/14:40/14:45 — 2000 rekordów.
- Zakończenie tunelu wraz z blokadą konta, w obu kolejnościach: 0 rekordów,
  2 odrzucone logowania po wykrytej utracie tunelu, potem wyczerpany budżet 3 porażek.
- Reset poświadczenia bez zamknięcia tunelu: aktualna wersja konta 2, wiedza
  przeciwnika nadal 1, ale istniejąca sesja nadal pozwala ujawnić 2000 rekordów.
- Reset gotowy na granicy nowego logowania: stara wersja nie działa, 0 rekordów.
- Wyłączenie VPN o 14:25 po pierwszej porcji: 400 rekordów pozostaje ujawnionych;
  biznes kończy z 204 obsłużonymi i 156 zaległymi zamówieniami.
- Przywrócenie SMB po przerwie: 400 o 14:20, następnie 800 o 14:35 i 800 o 14:40.
  Jedna udana próba nie przyznaje kilku zaległych porcji.

## Testy i odtworzenie raportu

```bash
npm test
npm run typecheck
npm run build

# Wypisuje liczbowe wyniki A/B/C i wszystkie nazwy przypadków przeciwnika:
npm test -- src/simulation/attacker.test.ts --reporter=verbose --disableConsoleIntercept
```

87 testów w 6 plikach: dotychczasowe 47 pozostaje bez zmian, dodano 40 przypadków.

| Nowe grupy w `attacker.test.ts`                                                   | Przypadki |
| --------------------------------------------------------------------------------- | --------: |
| Harmonogram i porcje, wczesna/spóźniona blokada, wznowienie                       |         4 |
| Sesje, uwierzytelnienie, konto, hasło, VPN i unikalność ID                        |         9 |
| Warunki każdej porcji, ograniczona wiedza i backoff                               |        12 |
| Niezmienność, limity, reset, deterministyczność, prywatność i walidacja definicji |        12 |
| Pełne przebiegi A/B/C z raportem liczbowym                                        |         3 |

Testy usuwają osobno sesję, ważność, właściwego właściciela tunelu, dostępność
bramy i serwera, protokół SMB, krawędź topologii, politykę oraz uprawnienie.
Żaden z tych przypadków nie pozwala dostarczyć porcji. To przeciwprzykłady dla
każdego warunku, a nie sam test bazowego harmonogramu.

Sprawdzono również 7 różnych momentów zlecenia blokady w kompletnym oknie 18 tur:
liczba rekordów nigdy nie spada, pozostaje w granicach 0–2000, a historia zawiera
najwyżej jedną akcję przeciwnika na turę. Dalsze komendy po końcu okna nie zmieniają
ukrytego wyniku. Typecheck nadal obejmuje kompilację silnika z ES2022 bez DOM.

## Granice wiedzy i integracja

Planer ma dostęp tylko do własnego stanu i tury. Autorytatywny resolver korzysta
z tych samych funkcji dostępu, które stosuje biznes. Nie ma drugiej sieci, zegara
ani modelu kont. Historia ataku trafia tylko do `hidden.attacker.privateHistory`.

Przed badaniem sesje nie trafiają do panelu. Po badaniu gracz otrzymuje tylko
dozwolone pola migawki i jej czas; nawet nowy S-20 nie ma etykiety pochodzenia.
Test kontrfaktyczny zmienia całą prywatną prawdę o ataku przy zachowaniu faktów
publicznych i potwierdza identyczny `selectPlayerView`. Nie ma sensorów ani
automatycznego ujawniania aktywności lub wyniku transferu w publicznym dzienniku.

## Zmienione pliki

Nowe:

- `src/domain/attack.ts` — kontrakty planu, wiedzy, transferu i prywatnych rezultatów.
- `src/content/nexusAttack.ts` — parametry referencyjnego przeciwnika.
- `src/simulation/attacker.ts` — inicjalizacja, planer, resolver i rozliczenie porcji.
- `src/simulation/attacker.test.ts` — 40 testów i raporty A/B/C.
- `docs/threat-simulation-validation.md` — ten raport.

Zmodyfikowane:

- `src/domain/simulation.ts` — prywatny stan przeciwnika.
- `src/content/nexusSimulation.ts` — rozdzielenie typów danych biznesu i definicji ataku.
- `src/application/createInitialSimulation.ts` — niezależna inicjalizacja przeciwnika.
- `src/simulation/engine.ts` — krok przeciwnika po pracach obrońcy i zachowanie prywatnego stanu przy odtwarzaniu legalnej pracy.
- `src/simulation/README.md`, `README.md`, `docs/architecture.md` — obsługa, semantyka i diagram.

GDD, pierwotny HTML, istniejące testy, funkcje dostępu, interfejs, publiczna
projekcja, zależności i workflow CI pozostają bez zmian.

## Ograniczenia

Jeden przeciwnik zna jeden trop FS-01 i starą wersję jednego poświadczenia.
Brak alternatywnych ścieżek, adaptacyjnego skanowania i uczenia nowego hasła.
Po 3 kolejnych niepowodzeniach kończy próby; po udanym kroku zeruje licznik.
Backoff to 2 tury, a logowanie i odczyt nie mogą nastąpić w tej samej turze.
Okno 18 tur ucina ewentualny późniejszy plan. Porcje są abstrakcyjnymi rekordami,
bez operacji sieciowych, malware, plików i danych użytkownika.

Nie dodano SOC/SIEM, sensorów, detekcji, panelu dochodzenia ani raportu poufności
na ekranie gracza. Pozostają zakresem przyszłego Sprintu 4B.
