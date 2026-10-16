# Sprint 4B — walidacja pierwszej grywalnej misji

Raport zachowuje historyczne wyniki wariantu referencyjnego. Aktualne trzy
warianty, tryby, testy i screenshoty opisuje [walidacja Sprintu 5](scenario-variants-validation.md).

Misja „Ostatnie okno wysyłkowe” korzysta z tego samego stanu, zegara, biznesu,
dostępu i przeciwnika co Sprint 4A. Nie zmieniono harmonogramu ani bazowych
wyników transferu. Informacje w tym dokumencie ujawniają rozwiązania scenariusza.

## Pięć kompletnych przebiegów

Każdy przebieg rozpoczyna identyczne `createInitialSimulation()` i kończy
dokładnie 18 tur. Zmieniają się wyłącznie komendy gracza. Wszystkie liczby
potwierdzono zarówno testami silnika, jak i przez interfejs w Chromium.

| Ścieżka | Komendy i czas ukończenia | Ujawnione | Przyjęte | Obsłużone | Zaległe |
| --- | --- | ---: | ---: | ---: | ---: |
| A | Brak reakcji | 2000 | 360 | 360 | 0 |
| B | Logi 14:05, sesje 14:10, Marta 14:15, SMB deny 14:20 | 0 | 360 | 360 | 0 |
| C | VPN wyłączony 14:05, bez przywrócenia | 0 | 360 | 156 | 204 |
| D | Sesje 14:05, zakończenie tylko S-19 o 14:10 | 2000 | 360 | 360 | 0 |
| E | Logi 14:05, SMB deny 14:25 po pierwszej porcji | 400 | 360 | 360 | 0 |

W B regułę zlecono o 14:10, równolegle z rozmową. Rekonesans i start transferu
mogą się udać, lecz blokada kończy się przed pierwszą porcją o 14:20. HTTPS do
ERP działa. W E pierwsze 400 rekordów pozostaje ujawnione; blokada wygrywa
z następną porcją o 14:25. W D logowanie o 14:20 tworzy S-20, a porcje
docierają o 14:35, 14:40 i 14:45. W C pierwszy sprawny przedział daje 20
obsłużonych, pozostałe 17 daje po 8: razem 156 i zaległość 204.

W B i E FS-01 jest odcięty, ale konto nie jest w pełni ograniczone: S-19 pozostaje
aktywny i przejęta wersja pozwala się uwierzytelnić. W C brak VPN również nie
zmienia ważności poświadczenia. Raport pokazuje te różnice zamiast utożsamiać
`blocked` z trwałym bezpieczeństwem.

Osobny test przywraca SMB po wyczerpaniu 3 porażek: wynik pozostaje 0 rekordów,
ale raport wykazuje ponownie dostępny cel oraz zatrzymanie wyłącznie limitem
planera. Test zakończenia tunelu i resetu hasła potwierdza brak tunelu, odmowę
starej wersji oraz ograniczenie konta niezależnie od limitu prób.

## Testy i komendy odtworzenia

```bash
npm test
npm run typecheck
npm run build
npm test -- src/simulation/incident.test.ts --reporter=verbose --disableConsoleIntercept
```

Wynik: **123 testy w 7 plikach — wszystkie pozytywne, zero pominiętych**.

| Plik | Przypadki |
| --- | ---: |
| `createInitialWorld.test.ts` | 6 |
| `infrastructureSelectors.test.ts` | 6 |
| `access.test.ts` | 11 |
| `attacker.test.ts` | 40 |
| `engine.test.ts` | 21 |
| `mapLayout.test.ts` | 3 |
| `incident.test.ts` | 36 |

Nowe przypadki: źródła/sensory/detekcja 8, pozyskiwanie wiedzy 11,
narracja/raport/reset/determinizm 12 i pięć kompletnych strategii.
Sprawdzane są brak pokrycia, niewłaściwe źródło, retencja, opóźnienie,
próg i okno alertu, brak odzyskania nieprzechwyconych danych, zajętość analityka,
zniknięcie źródła na granicy badania, oddzielna relacja Marty, nowe logowanie
w późniejszym badaniu i niezmienność starszych dowodów.

Test kontrfaktyczny podmienia prywatną prawdę przy zachowaniu jawnych źródeł:
alert, narracja i projekcja pozostają takie same. Przed końcem misji raport
zwraca `null`; po końcu wartości są porównywane z faktycznym `SimulationState`.
Analiza decyzji sprawdza zachowanie wiedzy z chwili zlecenia i limit trzech
momentów. Reset ponownie generuje historię początkową i alert, zamiast zachowywać
dowody lub nowe logowania z poprzedniej próby.

Typecheck obejmuje domenę i silnik z samym ES2022, bez DOM. Build produkcyjny
przechodzi bez nowych zależności projektu. Sprawdzono także `git diff --check`.

### Uzasadnione aktualizacje wcześniejszych oczekiwań

Zachowano wszystkie 87 przypadków ze Sprintu 4A; nie wyłączono ani nie usunięto
testów. Dwa oczekiwania w `engine.test.ts` wymagały dostosowania:

1. Logi były niedostępne, ponieważ nie istniało źródło. Teraz ten sam test
   odrzucenia jawnie wyłącza sensor w fixture. Nowe testy badają zarówno dostępne,
   jak i niedostępne źródło oraz jego utratę w trakcie zadania.
2. Konto było nieznane do badania sesji. Teraz wskazuje je poprawnie wygenerowany
   alert. Test nadal zabrania ujawnienia S-19 przed badaniem, pochodzenia i wersji
   poświadczenia; dodatkowo sprawdza pustą wiedzę o surowych logach.

Wyniki biznesu i ataku pozostały niezmienione. Sukces B-01 o 14:00 jest jawnym
zdarzeniem legalnego aktora, spójnym z istniejącą sesją. Przed 14:00 pozostają
dokładnie 52 odmowy i sukces S-19 z 13:58.

## Chromium i zrzuty

Sprawdzono produkcyjny build przez Chromium, sterując faktycznymi przyciskami,
formularzami, badaniami i zmianami kontekstu. Nie wstrzykiwano wyników ani stanu
do aplikacji. Pięć prób ukończono przez 18 komend przejścia tury każda.

- Briefing, alert bez S-19 przed badaniem, 54 wiersze w pierwszym odczycie logów.
- Zajętość analityka, migawka dwóch tuneli, osobna relacja Marty i notatka hipotezy.
- Zmiana SMB kończąca się przed porcją, potwierdzenie Bartka i późniejsza obserwacja pracy ERP przez Ewę.
- Wyłączenie VPN, niedostępne badanie lokalnych logów i komunikat Ewy po rzeczywistym wzroście kolejki.
- Zakończenie S-19, nowy S-20 ujawniony dopiero w późniejszym badaniu.
- Raporty zgodne z tabelą A–E, reset, czyste dowody i formularze w kolejnej próbie.
- Brak prywatnych pól w DOM podczas aktywnej gry, brak błędów JavaScript i konsoli.
- Obsługa Enterem, mapa dziewięciu zasobów, inspektor i opis lokalnych sensorów.
- Szerokość 375 px: brak poziomego przepełnienia strony we wszystkich kontekstach, działające skróty do dowodów i zleceń.

Zrzuty z przebiegu B:

1. [Początek misji](screenshots/incident-01-briefing.png).
2. [Dochodzenie i trzy rodzaje dowodów](screenshots/incident-02-investigation.png).
3. [Ukończona decyzja SMB](screenshots/incident-03-decision.png).
4. [Raport końcowy](screenshots/incident-04-report.png).

## Przegląd pierwszych 10 minut gry — techniczny test FUN

Przegląd obejmował przejście interfejsu i ocenę zrzutów, nie badanie z udziałem
ludzi. Czas poniżej opisuje zamierzone tempo poznawania, nie wymuszone odliczanie.

- **0–2 min:** briefing przedstawia termin, dwa niezależne cele i dwie osoby.
  Jeden przycisk prowadzi od razu do aktualnej sprawy; nie wymaga zwiedzania mapy.
- **2–4 min:** alert daje powód badania, ale nie ujawnia sesji ani przyszłego
  harmonogramu przeciwnika. Gracz ma wybór badania lub ograniczenia przy tej
  samej jawnej informacji o biznesie. Koszt i wykonawca są przy działaniu.
- **4–7 min:** pierwsze logi dostarczają sukcesu z ID sesji. Odczyt tuneli i
  rozmowa to różne dowody. Można zlecić zmianę Bartkowi równolegle z kolejnym
  badaniem; gracz nie musi najpierw odblokować wszystkich kart.
- **7–10 min:** reguły pokazują odrębne protokoły SMB i HTTPS. Po ukończeniu
  zmiany najpierw przychodzi potwierdzenie konfiguracji, a następnie informacja
  o rzeczywistej pracy ERP. Alternatywna szeroka blokada daje widoczny koszt
  kolejki. Samo zakończenie tunelu pozwala później odkryć nowe logowanie.

Usunięto konieczność szukania alertu pod mapą i długim dziennikiem: Sprawy są
kontekstem startowym, a zegar pozostaje pod ręką. Już pozyskane dowody można
czytać bez kosztu tury. Na telefonie stałe odnośniki skracają drogę do zleceń.
Brak sensora plikowego pozostawia świadomą niepewność o poufności aż do raportu.

**Do sprawdzenia z ludźmi:** czy rozróżniają udane logowanie od aktywnego tunelu,
czy rozumieją dwa wyniki mimo dobrego biznesu, oraz czy raport zachęca do
samodzielnego wyboru innej strategii. Testy automatyczne nie potwierdzają
zaangażowania ani skuteczności edukacyjnej.

## Ograniczenia

- Jedna stała misja, jeden przeciwnik i jedna zdefiniowana rozmowa. Po poznaniu
  rozwiązania nie ma jeszcze wariantu wymagającego transferu wiedzy.
- Dwa lokalne źródła VPN; bez adresów IP, sensora ruchu, audytu plików i pełnego SIEM.
- Brak odczytu logów lokalnych przy wyłączonej bramie; wcześniej pozyskane dowody pozostają dostępne.
- Jeden alert na konto i sensor; brak zarządzania cyklem życia alertów lub spraw.
- Prosty planer 4A: trzy kolejne porażki, backoff 10 minut, brak automatycznego wznowienia po wyczerpaniu limitu.
- Ocena możliwości dotyczy konfiguracji na końcu okna, bez obietnicy przyszłego bezpieczeństwa.
- Analiza wybiera pierwsze trzy zmiany możliwości, bez rozbudowanej analizy kontrfaktycznej całej rozgrywki.
- Brak zapisu gry, backendu i przywracania zablokowanego konta; reset odtwarza całą próbę.

## Zmienione pliki

Nowe kontrakty i treść: `src/domain/telemetry.ts`, `src/domain/incident.ts`,
`src/content/nexusIncident.ts`.

Nowa logika: `src/simulation/telemetry.ts`, `src/simulation/narrative.ts`,
`src/simulation/threatAssessment.ts`, `src/application/selectMissionReport.ts`.

Nowy interfejs: `src/ui/MissionBriefing.tsx`, `src/ui/InvestigationPanel.tsx`,
`src/ui/NarrativeFeed.tsx`, `src/ui/MissionReportPanel.tsx`, `src/ui/mission.css`.

Nowe testy i materiały: `src/simulation/incident.test.ts`, ten raport i cztery
zrzuty `docs/screenshots/incident-*.png`.

Integracja: `src/domain/simulation.ts`, `src/application/createInitialSimulation.ts`,
`src/application/selectPlayerView.ts`, `src/simulation/engine.ts`,
`src/simulation/attacker.ts`, `src/simulation/tasks.ts`, `src/simulation/engine.test.ts`,
`src/ui/App.tsx`, `src/ui/OperationsPanel.tsx`, `src/ui/SimulationTimeBar.tsx`,
`src/ui/infrastructurePresentation.ts`, `src/ui/simulationPresentation.ts`.

Dokumentacja: `README.md`, `docs/architecture.md`,
`docs/threat-simulation-validation.md`, `src/simulation/README.md`.

Nie zmieniono GDD, HTML prototypu, pakietów i lockfile, CI, modelu dostępu,
parametrów ataku, biznesu, mapy i pozostałych wcześniejszych testów.
