# Sprint 9 — walidacja inwestycji i grywalności

## Warunki porównania A–G

Wszystkie przebiegi zaczynają się od rzeczywistej kampanii: M01 bez zakupu i
reakcji → M02 bez reakcji → powrót → jawna transza. Brak odpowiedzi we
wcześniejszej M02 zachowuje prawo zapisu hosta we wszystkich porównywanych
wariantach. Nie resetujemy praw po skutecznej wcześniejszej reakcji.

Dla każdego przebiegu rozliczono rezerwacje, płatności i pracę. Wariant E
potrzebuje kolejnego okna: przed brakującą godziną admina jest dodatkowa
nieopanowana M02. Dlatego ma inny seed, lecz ta rodzina ma identyczną
referencyjną definicję. Każdy wynik kończy się po 18 turach / 15:30.

Źródło powtarzalnych przebiegów: `src/testSupport/resilienceStrategies.ts`.
Test wykonuje je dwukrotnie i porównuje cały świat; pełne dane są w
[resilience-results.json](resilience-results.json). Kolumny dotyczą końcowej,
powtórzonej M02. „Dowód” oznacza faktycznie pozyskany zapis operacji endpointu,
nie zgłoszenie człowieka, alert ani prywatną wiedzę autora scenariusza.

| Strategia | Dowód | Izolacja | Poprawne / uszkodzone / do uzgodnienia | Obsłużone / zaległe | RPO | RTO | Faktyczny restore | Dostępne środki |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| A: brak inwestycji i reakcji | — | — | 0 / 100 / 0 | 206 / 154 | — | niepotwierdzone | — | 93 000 zł |
| B: dobra ręczna reakcja | 14:10 lokalny | 14:05 | 100 / 0 / 0 | 360 / 0 | 40 min | 45 min | 10 min FS-1320 | 93 000 zł |
| C: EDR wykorzystany | 14:05 EDR | 14:10 | 100 / 0 / 0 | 360 / 0 | 40 min | 40 min | 10 min FS-1320 | 69 000 zł |
| D: Backup wykorzystany | 14:10 lokalny | 14:05 | 100 / 0 / 0 | 360 / 0 | 10 min | 35 min | 10 min FS-1350 | 65 000 zł |
| E: oba wykorzystane | 14:05 EDR | 14:10 | 100 / 0 / 0 | 360 / 0 | 10 min | 30 min | 10 min FS-1350 | 41 000 zł |
| F: EDR, alert zignorowany | — | — | 0 / 100 / 0 | 206 / 154 | — | niepotwierdzone | — | 69 000 zł |
| G: Backup bez ograniczenia źródła | — | — | 0 / 100 / 0 | 243 / 117 | 10 min | niepotwierdzone | 10 min FS-1350 | 65 000 zł |

RTO to czas od 14:00 do ostatniej skutecznej kontroli odzyskanych dokumentów;
nie sam czas wykonywania restore. Kopia FS-1320 pomija 20 późniejszych
zmian, jawnie uzgadnianych z ERP w B/C. FS-1350 obejmuje 100 dokumentów.

### Wykonane działania

- A/F: 18 tur bez reakcji; F ma działający sensor, lecz nie korzysta z niego.
- B: izolacja i dziennik lokalny równolegle; spis kopii; restore FS-1320;
  ograniczenie zapisu i uzgodnienie równolegle; podłączenie i kontrola ERP.
- C: dowód EDR; izolacja i spis kopii; restore FS-1320; ograniczenie zapisu
  i uzgodnienie; podłączenie i kontrola ERP.
- D: izolacja i dziennik; spis kopii; restore przygotowanej FS-1350;
  ograniczenie zapisu i kontrola ERP; kontrolowane podłączenie.
- E: dowód EDR; izolacja i spis kopii; restore przygotowanej FS-1350;
  ograniczenie zapisu i kontrola ERP; kontrolowane podłączenie.
- G: spis kopii; restore FS-1350; kontrola ERP, bez ograniczenia źródła.

Ręczna reakcja B zaczyna izolować przed uzyskaniem dowodu, korzystając ze
zgłoszenia. C/E czekają na EDR i izolują później. EDR skraca pozyskanie dowodu
oraz końcową kontrolę w tych harmonogramach, ale **nie przyspiesza samej
izolacji** względem administratora zleconego od razu. Każdy pracownik wykonuje
jedno zadanie naraz; restore i ograniczenie zapisu nie biegną równolegle.

B jest lepsze od niewykorzystanego narzędzia F. F i A mają identyczny wynik
incydentu, mimo różnicy wydatków. G wykonał szybsze odtworzenie, ale aktywne
źródło ponownie uszkodziło dokumenty. Nie ma premii za sam produkt.

## Automatyczne sprawdzenia

Wynik końcowy: **526 testów w 20 plikach — wszystkie przechodzą**. Zachowano
wszystkie 434 dotychczasowe przypadki i dodano 92 nowe. Kontrola typów (także
silnika bez DOM), produkcyjny build oraz `git diff --check` przechodzą.
Build: 93 moduły; JavaScript 451,47 kB / gzip 132,62 kB; CSS 62,17 kB / gzip
13,99 kB. Nie dodano zależności.

Nowe testy obejmują:

- alokację po dowolnym wyniku M02, ochronę przed powtórzeniem i brak transzy
  w M01/aktywnej misji/raporcie przed powrotem;
- zachowanie ledgeru, rezerwacji, bilans 60 000 / 45 000, oba projekty przy
  oszczędności, pełne godziny i brak ponownej płatności;
- rzeczywiste zdarzenia agenta, granice pokrycia, zasilanie, opóźnienie,
  retencję, bufor podczas izolacji, niedostępny kolektor i późne dostarczenie;
- próg, okno, duplikaty, odmowę, odczyt, przyszły rekord, wiele stacji,
  legalną serię modify i niezależność od prywatnej klasyfikacji;
- analizę EDR 5 min, analizę lokalną 10 min i brak automatycznej reakcji;
- test backup dopiero po pełnym wdrożeniu, niezmienione RPO, uszkodzoną,
  zmienioną i niedostępną kopię/usługę oraz brak późniejszych dokumentów;
- historyczne M01 i M02 bez nowych efektów, dziedziczenie i świeżość dowodów;
- oryginalne V1/V2/V3, V4 podczas wdrożenia i restore, manipulacje i wszystkie
  niezależne klucze; siedem pełnych deterministycznych strategii.

Końcowe polecenia: `npm test`, `npm run typecheck`, `npm run build`,
`git diff --check`. Wyniki końcowego wykonania są w opisie PR.

## Chromium

Produkcyjny build Vite uruchomiono lokalnie przez istniejące `npm run preview`.
Chromium 154.0.8037.57, strefa Europe/Warsaw, szerokości 1366 i 375 px.
Interakcje mobilne sprawdzono przy wysokości 812 px; długą sekcję raportu
zapisano jako screenshot zawartości przy szerokości 375 px. Czas gry pozostaje
fikcyjnym zegarem tur, niezależnym od zegara systemowego.

Zweryfikowano przez przyciski UI:

1. Start kampanii, ukończenie M01, ukończenie nieudanej M02 i powrót.
2. Brak propozycji przed M02, jawne przyjęcie 25 000 zł, jeden wpis po reload.
3. Oba projekty, przydziały, częściowy stan po 4 h i ostatnią godzinę w następnym
   oknie; po jednej płatności.
4. Powtórzoną M02, alert, pobranie rzeczywistych rekordów EDR i raport pokazujący
   brak decyzji ograniczających mimo pozyskanego dowodu.
5. Przygotowaną FS-1350, 10-minutowy restore, reakcję, 100 poprawnych dokumentów,
   360 obsłużonych, RPO 10 i RTO 30 min.
6. Zapis/reload podczas wdrożenia, badania EDR oraz aktywnego restore.
7. Ponowny start po finansowaniu i po ukończeniu obu wdrożeń.
8. Błędny import i anulowanie poprawnego: aktywny stan bez zmian.
9. Oryginalny V3: start bez zapisu migracji, eksport bajt w bajt, kontynuację,
   import i reload bez przyznania pieniędzy ani nowych projektów.
10. Prywatne pola niewidoczne w aktywnym DOM; karty, finansowanie, trzy konteksty
    misji i raport bez poziomego przepełnienia przy 375 px.

Brak błędów JavaScript i odpowiedzi HTTP 4xx/5xx w sprawdzonym przebiegu.
[Zapis wyników Chromium](resilience-browser-results.json).

## Screenshoty

- [Finansowanie, 375 px](screenshots/resilience/01-funding-mobile.png)
- [Karta EDR](screenshots/resilience/02-edr-project.png)
- [Karta Backup](screenshots/resilience/03-backup-project.png)
- [Dowód EDR, źródło i czasy](screenshots/resilience/04-edr-evidence-desktop.png)
- [Gotowość i inspektor FS-01](screenshots/resilience/05-backup-readiness-inspector.png)
- [FS-1350 po teście](screenshots/resilience/06-prepared-backup.png)
- [Raport 375 px](screenshots/resilience/07-investment-report-mobile.png)
- [Wpływ inwestycji w raporcie](screenshots/resilience/08-investment-report-desktop.png)

## Ograniczenia i obserwacje grywalności

- W tym scenariuszu dobra ręczna reakcja już osiąga 360 zamówień. Nowe narzędzia
  skracają dochodzenie/odzyskiwanie i zmieniają RPO, lecz nie dodają zamówień
  ponad rzeczywiste zapotrzebowanie ani nie gwarantują wygranej.
- Trwały zakaz zapisu po dobrej poprzedniej reakcji może zapobiec sabotażowi
  kolejnej M02. Nie przywracamy podatności. Taki przebieg może mieć małą
  dodatkową korzyść z EDR; raport pokazuje rzeczywiste użycie.
- Jedna stacja, jedna reguła, jeden nazwany abstrakcyjny kolektor. Brak floty,
  portów zarządzających, SOC, SOAR, prawdziwego malware i adaptera Sysmon.
- Agent/bufor i kolektor mają oddzielne stany. Stały kanał zarządzający nie
  modeluje topologii chmury; izolacja i zasilanie są jawnymi warunkami dostępu.
- Wynik testu backup odnosi się do skończonej zawartości snapshotu. Nie ma
  generowania nowych kopii, replikacji ani harmonogramu. Nieudany test pełnego
  programu nie powtarza się sam po przywróceniu infrastruktury; pozostaje
  istniejąca ręczna weryfikacja kopii w incydencie.
- Dla obu projektów trzeba przejść kolejne okno przez istniejącą pętlę misji.
  Nie dodano kalendarza ani możliwości dowolnego pomijania okien.
- Pełny zapis zawiera prywatną prawdę i ma walidację spójności, bez ochrony
  kryptograficznej. Brak backendu, synchronizacji i nowych zależności.
- Nie zmieniono workflow ani GitHub Pages. Publikacja wymaga późniejszej,
  osobnej decyzji o merge; ten PR nie uruchamia deploymentu Pages.
