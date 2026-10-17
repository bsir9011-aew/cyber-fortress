# Sprint 8 — The Last Clean Copy: walidacja i dostarczenie

Baza: `main` 292732977e6813361c0aac581137185932574942, zawierający Sprint 7
i poprawkę odzyskiwania konta z PR #8. Gałąź `feat/mission-02-integrity`.
Walidacja 17.10.2026: Node.js 24.19.0, Vite 8.3.4, Vitest 5.0.5,
Chromium; strefa przeglądarki Europe/Warsaw. Nie wykonano merge ani wdrożenia.

## Wynik kontroli

| Kontrola | Wynik |
| --- | --- |
| `npm test` | **434/434**, 16 plików, bez pominięć |
| Poprzednie testy | 350 zachowanych bez modyfikacji ich plików i asercji |
| Nowe | 43 lokalny dostęp/integralność/strategie, 9 kampania/seedy, 32 V3/migracja |
| `npm run typecheck` | PASS, także domain/simulation bez DOM |
| `npm run build` | PASS, 88 modułów; JS 431,29 kB, gzip 127,07 kB |
| `git diff --check` | PASS |
| Produkcyjny preview `/cyber-fortress/` | HTTP 200, zasoby bez błędów |
| Chromium | pełna kampania, dwie strategie, 1366 i 375 px, V1/V2/V3 i offline po załadowaniu |

Bez nowych zależności, backendu ani zmiany workflow. Produkcyjna baza Vite
pozostaje `/cyber-fortress/`. Workflow Pages publikuje dopiero `main`; lokalna
walidacja produkcyjnego buildu nie jest deklaracją publicznego wdrożenia Sprintu 8.

## Macierz pełnych przebiegów

Parametry są w [danych misji](../src/content/scenarios/integrity.ts), a model,
predykaty, kolejność tur i definicje RPO/RTO opisano w
[specyfikacji z diagramami](mission-02-integrity.md). Wszystkie przebiegi
poniżej mają 100 oczekiwanych dokumentów, 360 przyjętych zamówień i 18 tur.
Nie zmieniamy porcji ani uprawnień po decyzji gracza.

| Strategia | Poprawne / uszkodzone / do uzgodnienia | Obsłużone / zaległe | Źródło nadal może zapisywać | RPO / potwierdzone RTO danych |
| --- | --- | --- | --- | --- |
| A. Brak reakcji | 0 / 100 / 0 | 206 / 154 | tak | — / niepotwierdzone |
| B. Izolacja ukończona 14:05, bez naprawy | 88 / 12 / 0 | 326 / 34 | nie | — / niepotwierdzone |
| C. Nowsza kopia, bez ograniczenia źródła | 0 / 100 / 0 | 250 / 110 | tak | 10 / niepotwierdzone |
| D1. Izolacja, starsza kopia, uzgodnienie, kontrola i podłączenie | 100 / 0 / 0 | 360 / 0 | nie | 40 / 45 min |
| D2. Izolacja, weryfikacja nowszej kopii, kontrola i podłączenie | 100 / 0 / 0 | 360 / 0 | nie | 10 / 50 min |
| E1. Starsza kopia bez uzgodnienia i podłączenia | 80 / 0 / 20 | 311 / 49 | nie | 40 / niepotwierdzone |
| E2. D1 + zbędne wyłączenie VPN ukończone 14:50 | 100 / 0 / 0 | 254 / 106 | nie | 40 / 45 min |

Liczby kontrolują testy z konkretnymi oczekiwanymi wynikami, nie tylko bilansem.
W każdym przypadku `poprawne + uszkodzone + do uzgodnienia = 100` oraz
`obsłużone + zaległe = 360`. Liczniki historyczne odzyskania nie powiększają
zbioru. RTO jest mierzone od 14:00 do potwierdzenia poprawnego zbioru; RPO to
wiek ostatniej użytej kopii względem 14:00, nie automatyczna liczba utraconych
plików. Udana kontrola jest unieważniana po następnym uszkodzeniu.

**Dlaczego wyniki się różnią:**

- A doprowadza do utraty całej poprawnej puli. FS-01 pozostaje online;
  zmniejsza się faktyczny udział poprawnych dokumentów potrzebnych procesowi.
- B zatrzymuje źródło, ale pozostawia pierwsze 12 uszkodzeń. Utrata 2 lokalnych
  zamówień wydajności wskutek izolacji jest realna. Sam cel kolejki zostaje
  osiągnięty, cel naprawy i potwierdzenia integralności nie.
- C przywraca 52 wcześniej uszkodzone dokumenty, lecz bez usunięcia prawa
  modyfikacji ten sam podmiot ponownie narusza nową generację. Końcowe
  „odzyskano historycznie” nie jest deklaracją obecnej poprawności.
- D1 przełącza kopię 14:25 i jawnie uzgadnia 20 późniejszych dokumentów
  do 14:35. Podłącza stację z zakazem zapisu 14:40, kontrolę kończy 14:45.
  D2 potrzebuje sprawdzenia nowszej kopii i dłuższego restore: zbiór wraca
  14:40, kontrola kończy się 14:50, stacja wraca 14:55. Obie strategie mają
  szczyt kolejki 14 i nadrabiają go; czas ograniczenia danych to 35 vs 40 min.
- E1 pokazuje konkretny koszt RPO: brakujące 20 dokumentów nie pojawia się
  samo. E2 odzyskuje integralność, ale wyłącza niezwiązaną drogę zdalnego ERP.
  Poprawne lokalne dane pozostają dostępne; spada działalność, nie integralność.

## F. Porównanie inwestycji

| Przygotowanie, bez reakcji podczas Misji 02 | Uszkodzone | Obsłużone / zaległe | Audyt plikowy |
| --- | --- | --- | --- |
| Brak | 100 | 206 / 154 | brak |
| Remote Access Hardening / MFA | 100 | 206 / 154 | brak |
| VPN Segmentation | 100 | 206 / 154 | brak |
| File Access Visibility | 100 | 206 / 154 | 15 rzeczywistych zdarzeń read/modify |

MFA nadal sprawdza nowe logowania VPN. Segmentacja nadal kontroluje zakres
VPN/HTTPS/SMB, ale nie inną, lokalną drogę. Audyt daje dowód, nie blokadę.
Przy sensorze działają opóźnienie 5 min, zakres od 14:00 i brak retroaktywnego
zdarzenia 13:55. Porcja 14:10 jest dostępna do pozyskania 14:15; zawiera konto,
lokalny endpoint, operację modify i zakres 20 dokumentów, z `sessionId: null`.
Nie ma pola „złośliwy” ani odczytu prywatnej flagi. Bez audytu pozostają
porównanie ERP i dziennik stacji. Faktyczne uszkodzenia są identyczne.

## Pokrycie regresji

- Trzy stare warianty nadal mają 360 obsłużonych/0 zaległych oraz 2000/0/2000
  ujawnionych rekordów. Katalog nadal ma trzy pozycje; historyczne seedy,
  także duże, wybierają identyczne definicje. Rzeczywiste stare migawki
  przechodzą pełne porównanie, nie tylko końcowe liczniki.
- Lokalna modyfikacja wymaga działającej stacji, usługi, drogi, konta,
  uprawnienia operacji i braku ograniczenia zapisu. Brak każdego warunku
  jest osobno testowany. Nie ma sesji S-19 dla lokalnego źródła ani nowej
  drogi po odmowie. Puste porcje nie tworzą fikcyjnej telemetrii.
- Izolacja działa po turze, nie naprawia danych i nie wyłącza serwera.
  Podłączenie wymaga badania i ograniczenia zapisu. Kompromitacja pozostaje.
- Kopie mają różny czas i zakres. Wadliwa kopia jest wykrywana. Restore i
  uzgodnienie nie działają natychmiast ani równolegle na tym samym zbiorze.
  Zajętość, niewłaściwy wykonawca, zły cel i termin blokują operację.
- Raport jest bramkowany końcem misji, rozdziela integralność, bieżącą
  dostępność, działalność i kontrolę źródła. Analiza decyzji pokazuje tylko
  obserwacje znane przy zleceniu, z ich ówczesnymi wartościami i czasem.
  Późniejszego wyniku 100 poprawnych nie przypisuje wcześniejszej decyzji.
- Reset odtwarza cały początkowy stan. Po jednym incydencie odblokowuje się
  nowa rodzina; projekty, finanse, reguły, konta i host-based containment
  są dziedziczone, stare dowody i naruszenie nie są przenoszone jako obecne.
- V3 odtwarza identyczny dalszy przebieg z każdej z trzech tur restore.
  Podmienione dokumenty, kopie, endpoint, terminy, decyzje i ukryty aktor
  są odrzucane. Stare kontrakty nie przyjmują nowych komend po podmianie
  numeru. Testy obejmują limity, błędne enumy/pola i niedostępny storage.

## Chromium na produkcyjnym buildzie

Przebieg wykonano przez widoczne przyciski: start kampanii → zakup audytu →
pierwszy incydent → centrala → Misja 02 → briefing → zgłoszenie i porównanie
ERP → izolacja → spis kopii → starsza kopia → badanie stacji → uzgodnienie i
ograniczenie zapisu → kontrolowane podłączenie → ponowna kontrola → raport.
W toku restore wyeksportowano V3, odświeżono stronę i zaimportowano plik:
cały stan pozostał identyczny, zadanie nie przyspieszyło. Błędny i anulowany
import pozostawiły grę. Tura po załadowaniu zasobów działała offline.

Druga strategia z tego samego checkpointu centrali pozyskała najpierw audyt
14:15, dopiero potem odizolowała źródło. Użyła zweryfikowanej nowszej kopii.
Wynik: **100 poprawnych, 0 uszkodzonych, 327 obsłużonych, 33 zaległe,
RPO 10 min, RTO 65 min**, bez uzgadniania braków. Różnica wobec D2 jest
skutkiem dłuższego zbierania dowodów przed ograniczeniem, nie ukrytej kary.

Sprawdzono 1366×950 i 375×812, konteksty Sprawy/Operacje/Architektura,
inspektor podzasobu w SVG, raport i historię. Brak poziomego przewijania,
błędów JavaScript/konsoli oraz błędnych żądań zasobów. Aktywny DOM nie
zawiera prywatnego planu, zawartości kopii lub flagi kompromitacji.

Osobny przebieg aktualizacji w Chromium:

1. Dwa rzeczywiste V1 i dwa V2 sprzed Sprintu 8: zero zapisów przed
   kontynuacją, identyczna pełna sesja/świat po migracji, oryginalny eksport
   bajt po bajcie. W V2 z zadaniem odblokowania termin pozostaje zachowany.
2. Nieobsługiwany V2 pozostaje nietknięty i eksportowalny po nowej kampanii.
3. Getter localStorage rzucający SecurityError: gra startuje w pamięci,
   eksport V3 działa; brak nieobsłużonego wyjątku.

### Screenshoty

- [Odblokowana karta w centrali](screenshots/mission-02/01-unlocked-headquarters-desktop.png)
- [Briefing](screenshots/mission-02/02-briefing-desktop.png)
- [Stan niebadany](screenshots/mission-02/03-unmeasured-desktop.png)
- [Odtwarzanie w toku](screenshots/mission-02/04-restore-in-progress-desktop.png)
- [Odzyskane i zbadane dokumenty](screenshots/mission-02/05-recovered-documents-desktop.png)
- [Endpoint w inspektorze mapy](screenshots/mission-02/06-endpoint-map-desktop.png)
- [Dokumenty, 375 px](screenshots/mission-02/07-recovered-documents-mobile.png)
- [Raport, 375 px](screenshots/mission-02/08-integrity-report-mobile.png)
- [Raport starszej kopii](screenshots/mission-02/09-integrity-report-desktop.png)
- [Dowód lokalnych modify](screenshots/mission-02/10-audit-local-modifications-desktop.png)
- [Nowsza kopia po dłuższym dochodzeniu](screenshots/mission-02/11-new-copy-report-desktop.png)

## Ocena grywalności i ograniczenia

Serwer online z nieznaną integralnością jest pokazany przed pierwszym badaniem.
Gracz ma powód zestawić źródła: zgłoszenie nie dowodzi ataku, porównanie nie
wskazuje sprawcy, audyt nie naprawia danych. Raport pokazuje, że containment
i recovery mają różne rezultaty. Dwa punkty odtworzenia realnie rozdzielają
pracę, czas i rekonstrukcję; można je wybrać bez quizu lub oceny „poprawnej”
odpowiedzi. Odkładanie izolacji po dodatkowe dowody ma mierzalny koszt.

To jedna deterministyczna referencja. Znający ją gracz może szybko izolować
znaną stację i zoptymalizować plan; nie ma wariantu z nieszkodliwą przyczyną.
Obie referencyjne kopie są czyste, choć przed badaniem gracz tego nie wie.
Proporcja poprawnych dokumentów upraszcza dopasowanie zamówień, a zakaz zapisu
upraszcza egzekwowanie uprawnień lokalnego kontekstu. Nie oczyszcza hosta,
nie zabezpiecza wszystkich innych możliwych technik i nie udaje pełnego EDR.
Katalog kopii jest dany scenariuszem, nie nową gospodarką backupów.

MFA przestaje być dominującą odpowiedzią na ten mechanizm; nadal jest istotne
na swojej drodze VPN. Audyt wnosi dowód, lecz przy znanej referencji nie jest
obowiązkowy do zwycięstwa. **Nie deklarujemy potwierdzonego FUN** ani dobrego
balansu wyłącznie na podstawie testów. Potrzebne są obserwacje graczy: czy
rozumieją wiek kopii, kontrolę po restore i warunki ponownego podłączenia.

Źródła: [modele i diagramy](mission-02-integrity.md),
[kompatybilność V3](game-save-v3.md),
[maszynowy zapis wyników](mission-02-results.json).
