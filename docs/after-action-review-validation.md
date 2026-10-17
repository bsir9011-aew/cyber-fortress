# Sprint 10 — walidacja After Action Review

## Automatyczne sprawdzenia

Zachowano wszystkie **526 wcześniejszych testów**. Nowe 74 przypadki obejmują
AAR, zgodność zapisów i rzeczywiste przykłady: łącznie **600 testów w 23 plikach**.

Polecenia walidacyjne:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Wszystkie polecenia powyżej zakończyły się powodzeniem. Produkcyjny build
obejmuje 104 moduły.

Nie zmieniono reguł symulacji, ekonomii ani formatów zapisów V1–V4. Nie dodano
zależności i nie zmieniono workflow. Importer V4 dodatkowo rozpoznaje marker
`FORTRESS_AAR`, aby jasno powiedzieć, że raport nie jest zapisem gry.

Nowe testy sprawdzają:

- brak AAR przed końcem, również przy sfałszowanym UI/clock/history;
- wszystkie trzy warianty M01, M02, wygraną, porażkę, częściowe ograniczenie
  i legalne zdarzenie błędnie potraktowane jako włamanie;
- dokładny czas zlecenia/ukończenia/obowiązywania, odmowy i zadania widoczne
  jako nadal wykonywane podczas następnej decyzji;
- brak późniejszej wiedzy w decyzji wcześniejszej, także w tej samej minucie;
- różnicę między ID z historycznych logów a migawką bramy;
- brak automatycznego przypisania wszystkich dowodów do alertu i brak sensora
  jako ograniczenie obserwacji, nie dowód braku aktywności;
- blokadę nowych logowań/reset przy nadal istniejącej sesji, MFA i legalny tunel,
  regułę SMB z legalnym HTTPS oraz koszt dokumentowych przepływów;
- izolację bez naprawy, restore bez containment, RPO/RTO oraz użyty/zignorowany EDR;
- historyczny kontekst kampanii sprzed finansowania i kontekst z EDR/backup;
- bilanse, progi celów, ID i odwołania, brak przyszłych rekordów w obserwacji;
- brak mutacji gry, brak aliasowania wyniku ze źródłem, deterministyczne fakty,
  wznowienie/import i jawny brak pełnej historii;
- wszystkie sekcje Markdown, neutralizację HTML/składni z danych, poprawny JSON,
  wyraźne odrzucenie AAR przez importer gry i limit rozmiaru/liczby decyzji.

## Scenariusze A–H

Wszystkie wyniki poniżej pochodzą z `playAarScenario` i rzeczywistego
`createAfterActionReport`, nie z ręcznych narracji. Zbiorcze fakty:
[after-action-scenarios.json](after-action-scenarios.json).

| Przebieg | Wynik bezpieczeństwa/danych | Zamówienia / zaległe | Stan wiedzy i rozdzielenie skutków |
| --- | --- | --- | --- |
| A: precyzyjne SMB deny | 0 wykradzionych; wszystkie cele spełnione | 360 / 0 | Reguła znana przed decyzją, pozyskane logi dopiero po ukończeniu analizy; HTTPS pozostaje dostępny |
| B: tylko blokada nowych logowań | 2000 rekordów, tunel nadal ma dostęp | 360 / 0 | Blokada 14:00 nie zna S-19 z późniejszych logów; rzeczywista sesja istnieje przed i po blokadzie |
| C: VPN off → SMB deny → VPN on | 0 rekordów, wszystkie cele spełnione | 352 / 8 | Przestój legalnego procesu, szczyt kolejki 36; sukces celu nie usuwa kosztu biznesowego |
| D: izolacja bez restore | zapis zatrzymany, 88 poprawnych i 12 uszkodzonych | 326 / 34 | Kompromitacja pozostaje, wcześniejsze uszkodzenia nie są naprawione; odzyskanie niepotwierdzone |
| E: restore bez ograniczenia źródła | źródło zapisuje dalej; końcowo 100 uszkodzonych | 250 / 110 | FS-1350 sprawdzona i odtworzona 15 min; RPO 10 min, RTO niepotwierdzone; późniejsze modyfikacje są osobne |
| F: EDR i przygotowana kopia | 100 poprawnych, ograniczony zapis, RPO 10 / RTO 30 min | 360 / 0 | Transza i wdrożenia aktywne na starcie; dowód EDR rzeczywiście pobrany, restore trwa 10 min |
| G: EDR kupiony, ignorowany | 100 uszkodzonych; brak ograniczenia źródła | 206 / 154 | Alert jest dostępny, brak ukończonego pobrania szczegółowych rekordów; brak automatycznego sukcesu produktu |
| H: legalne zdarzenie, blokada/VPN off | brak sprawcy i wykradzionych rekordów; szkoda operacyjna | 180 / 180 | Relacje i sygnały oddzielone od legalnej prawdy scenariusza; nie dopisujemy intencji gracza |

C ma negatywne skutki biznesowe, mimo spełnienia progu końcowego. D pokazuje
ograniczenie źródła bez odzyskania danych. E nie otrzymuje fałszywego trwałego
sukcesu za samo zakończenie restore. Raport nie klasyfikuje rozumowania jako
dobrego/złego na podstawie powyższej tabeli. Pozostawia dowody do analizy.

## Prawdziwe zapisy i przykłady

Testy odczytują dwa historyczne V1, dwa V2, dwa V3 oraz oryginalny V4 ze
Sprintu 9 (restore w toku), kończą je istniejącym silnikiem i sprawdzają AAR.
Nowy fixture V4 jest niezmienionym eksportem Chromium sprzed Sprintu 10.
[Proweniencja](../src/persistence/fixtures/README.md).

Trzy szczegółowe pary JSON/Markdown są w [aar-examples](aar-examples/README.md).
Test porównuje ich fakty z ponownym replay. Niezależnie zweryfikowano JSON-y
standardowym `jsonschema.Draft202012Validator` z kontrolą date-time względem
[schematu 2020-12](fortress-aar-v1.schema.json). To narzędzie środowiska,
nie nowa zależność projektu ani część aplikacji.

## Chromium i pliki z rzeczywistego UI

Produkcję zbudowano Vite i uruchomiono przez istniejący `npm run preview` pod
`/cyber-fortress/`. Chromium **154.0.8037.57**, strefa Europe/Warsaw, szerokości
**1366 i 375 px**. Interakcje mobilne przy 812 px wysokości; długie sekcje
zapisano jako screenshot ich zawartości przy szerokości 375 px.

Sprawdzono przez interfejs:

1. Start treningu M01; brak AAR w aktywnej misji.
2. Blokadę konta, późniejsze logi i sesje; zapis/refresh przed końcem oraz
   identyczną kontynuację do porażki poufności.
3. Offline pobranie obu formatów, rzeczywiste zawartości plików i powiązania
   wiedzy. Raport blokady nie zawiera jeszcze S-19 jako znanej sesji.
4. Kopiowanie instrukcji i osobno odmowę schowka z zaznaczonym tekstem do
   ręcznego skopiowania.
5. Brak zmiany bajtów zapisu V4 przy eksportach/kopiowaniu, brak wysyłki sieciowej.
6. Próbę importu JSON AAR jako gry — odrzucenie bez zmiany aktualnego zapisu.
7. Powtórkę z precyzyjnym SMB deny i porównanie raportów: 2000 vs 0 rekordów.
8. Historię samodzielnych prób: raport bieżącej pełnej sesji i uczciwy komunikat
   dla wcześniejszego wiersza bez dziennika.
9. Import oryginalnego V4 w środku restore M02; dokończenie, ograniczenie zapisu,
   ponowną kontrolę i podłączenie. Kolejny refresh przed końcem nie zmienia świata.
10. AAR po odzyskaniu: 100 poprawnych dokumentów, 360 zamówień, RPO 10 / RTO 30.
11. Pobranie dawnej M02 w Centrali: 80 000 zł i trzy projekty, bez transzy ani
    narzędzi, które pojawiły się dopiero później.
12. Ponowne uruchomienie strony z zachowaniem finansowania.
13. Brak poziomego przepełnienia modułu AAR, raportu, historii i Centrali przy
    375 px. Przewijanie szerokiej tabeli historii pozostaje wewnątrz panelu.

Brak błędów JavaScript i HTTP 4xx/5xx; brak żądań do zewnętrznego AI lub innych
zewnętrznych usług. [Zapis wyników Chromium](after-action-browser-results.json).

## Screenshoty

- [M01 — eksport na laptopie](screenshots/after-action/01-m01-export-desktop.png)
- [M01 — eksport przy 375 px](screenshots/after-action/02-m01-export-mobile.png)
- [M02 — eksport po odzyskaniu](screenshots/after-action/03-m02-export-desktop.png)
- [M02 — eksport przy 375 px](screenshots/after-action/04-m02-export-mobile.png)
- [Raport wcześniejszej operacji kampanii](screenshots/after-action/05-historical-campaign-export.png)

## Ograniczenia

- Brak zapisanego uzasadnienia i brak śladu tego, co gracz naprawdę przeczytał.
  „Znane” oznacza informacje udostępnione, a nie pomiar uwagi lub pamięci.
- Zakończenie zadania może współwystępować z inną pracą i operacją źródła.
  Zakres po granicy tury nie jest dowodem wyłącznej przyczynowości.
- Brak natychmiastowej zmiany możliwości nie oznacza braku znaczenia polityki:
  np. ograniczenie zapisu izolowanego endpointu ma znaczenie przy podłączeniu.
- Samodzielne podsumowania historyczne bez pełnego dziennika nie dają AAR.
  Nie dodano archiwum całych sesji; pobrany raport zachowuje szczegółowe fakty.
- Generator ma limit 256 decyzji i 2 MiB na plik. Przekroczenie daje jawny błąd,
  bez pomijania decyzji i bez niepełnego eksportu.
- Chronologia jest ograniczona do zegara i źródeł silnika; nie ma dokładnych
  czasów ściennych kliknięć ani nieprzeprowadzonego porównania alternatyw.
- Nie ma kryptograficznej autentyczności lokalnych plików. Raport nie jest
  importerem, kodem do wykonania ani automatyczną oceną człowieka.
- Test przygotowuje pliki do rozmowy z ChatGPT; nie przeprowadzono ani nie
  zasymulowano zewnętrznej analizy przez API. Wyników takiej rozmowy nie deklarujemy.
- Nie wykonano merge ani deploymentu Pages. CI PR sprawdza testy, typy i build;
  Chromium sprawdzono osobno narzędziami tego środowiska, bez zależności w repo.
