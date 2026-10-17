# Sprint 7 — Strategic Command: raport dostarczenia

Punkt wyjścia: scalony `main` 173d135 (PR #7). Gałąź:
`feat/strategic-command`. Walidacja 17.10.2026: Node.js 24.19.0, Vite 8.3.4,
Vitest 5.0.5 i Chromium; przeglądarka ma strefę Europe/Warsaw.
Nie wykonano merge ani publikacji Sprintu 7 do Pages.

## Modele i prawdziwe efekty

- `CampaignState` rozróżnia przygotowanie/incydent/raport, budżet z ledgerem,
  projekty, dwie kolejki pracy, trwałe polityki, kolejny seed i historię misji.
  Jedyny bieżący świat jest w `campaign.incident`; centrala go nie duplikuje.
- A wymusza modelowany drugi składnik i porządkuje jawne nadania SMB według
  dokumentowanej pracy. Legalni klienci przedstawiają swój składnik. Stare
  sesje nie znikają wskutek samego MFA. Inicjalizacja rozstrzyga logowanie
  13:58 zamiast kopiować z definicji tunel, którego usługa nie wydała.
- B dodaje audyt FS-01 do tej samej telemetrii: pokrycie serwera, rzeczywiste
  próby, opóźnienie 5 min, retencję 120 min i kosztujące turę badanie analityka.
  Legalne odczyty też są mierzone. Nie ma etykiety „złośliwe” ze stanu prywatnego.
- C rozszerza reguły o zakres kont, zachowując pierwszeństwo, domyślną odmowę
  i zgodność starych reguł. Węższy zakres może odebrać legalne dokumenty;
  szerszy nie rozpoznaje osoby posługującej się dozwolonym kontem.
- `GameSession` i `FortressSaveV2` obejmują niezależną misję lub kampanię,
  pełne migawki i journal. Stary V1 pozostaje w oryginalnym kluczu i ma eksport.

Opis kontraktów: [kampania](campaign.md), [silnik](strategic-engine.md),
[zapis V2](game-save-v2.md), [architektura](architecture.md).

## Bilans i zasoby

80 000 zł = 12 000 zł poniesionego pilotażu + 68 000 zł dostępnych.
Do zapłaty A/B/C: 20 000 / 28 000 / 30 000 zł. Wszystkie wymagają dalszych
78 000 zł, czyli o 10 000 zł więcej niż dostępne. Rezerwacja nie aktywuje projektu;
płatność przy pierwszej pracy występuje raz, a aktywacja dopiero po zakończeniu.

A i C wymagają po 4 h administratora; B wymaga 2 h administratora i 4 h analityka.
Kanały są oddzielne. W Chromium A i część B działały równolegle w oknie 1;
B potrzebowało jeszcze 2 h administratora w oknie 2. Wydano łącznie 60 000 zł,
a rezerwa 20 000 zł nie pozwoliła sfinansować C. Nie było drugiej opłaty za B.
Korekta grupy ukończonej segmentacji kosztowała 1 h administratora, bez nowego
zakupu. Zwracane mogą być rezerwacje przed rozpoczęciem, nie ukończone wdrożenia.

## Kontrole automatyczne

| Kontrola            | Wynik                                            |
| ------------------- | ------------------------------------------------ |
| `npm test`          | 329/329, 12 plików, bez pominięć                 |
| Dotychczasowe testy | Wszystkie 249 zachowane, bez modyfikacji asercji |
| Nowe przypadki      | 45 kampanii/mechanizmów + 35 zapisu/aktualizacji |
| `npm run typecheck` | PASS, domain/simulation także bez DOM            |
| `npm run build`     | PASS, 80 modułów, poprawna baza Pages            |
| `git diff --check`  | PASS                                             |

Testy obejmują wszystkie wymagania bilansu, rezerwacji, braku podwójnego zakupu,
nieaktywacji po samej zapłacie, zajętości i równoległości, przenoszenia pracy,
wyników bez inwestycji, MFA i legalnej pracy, braku fikcyjnego S-19, zakresu i
opóźnienia sensora, legalnego audytu, reguł podmiotowych, kosztu SMB, dziedziczenia,
świeżych danych następnej misji i prywatności publicznego widoku.

Dodatkowo sprawdzono pełną równość po eksporcie/importowaniu przygotowania,
trwającej misji oraz następnego okna. Walidacja odrzuca podmienione finanse,
polityki, tury, metadane misji, enumy udawane tablicą, obce komendy, wersje,
nadmierny rozmiar/liczbę komend i klucze prototypu. Zła migracja nie jest udawana.

## Pełne przebiegi: trzy warianty i inwestycje

Poniżej nie ma dodatkowych zleceń obronnych w czasie misji. Komórka:
**ujawnione rekordy / obsłużone zamówienia / zaległe** po 18 turach.

| Przygotowanie                 | A: przejęty tunel | B: legalna sesja | C: hasło bez tunelu |
| ----------------------------- | ----------------- | ---------------- | ------------------- |
| Bez inwestycji                | 2000 / 360 / 0    | 0 / 360 / 0      | 2000 / 360 / 0      |
| A: dostęp zdalny/MFA          | 0 / 360 / 0       | 0 / 360 / 0      | 0 / 360 / 0         |
| B: sam audyt FS-01            | 2000 / 360 / 0    | 0 / 360 / 0      | 2000 / 360 / 0      |
| C: SMB tylko file-team        | 0 / 360 / 0       | 0 / 288 / 72     | 0 / 360 / 0         |
| C: SMB file-team + magazyn-07 | 2000 / 360 / 0    | 0 / 360 / 0      | 2000 / 360 / 0      |

Pierwsze cztery wiersze są 12 jawnie parametryzowanymi testami całych misji.
Szerszy zakres C sprawdzono także jako pełną pętlę A→B oraz Chromium dla C.
Brak inwestycji jest dodatkowo porównywany ze **wszystkimi polami** bazowego stanu
trzech wariantów. W B nie ma przeciwnika; ograniczenie zagrożenia ma `null`.

Przy wąskim C w B minimalna wydajność wynosi **16 zamiast 22**, przez wszystkie
18 przedziałów. Zostaje 288 obsłużonych i 72 zaległe. To inny moment wdrożenia
niż dawny incydentowy SMB deny o 14:10 z kosztem 64 — tutaj polityka obowiązuje
już od startu. Koszt wynika z legalnej zależności, nie z kary za kliknięcie.

## Chromium — rzeczywiste wejścia i pełna pętla

Produkcję uruchomiono przez Vite preview pod `/cyber-fortress/`. Przebiegi używają
przycisków, selectów, potwierdzeń, klawiatury, rzeczywistego pobrania i wyboru
pliku; localStorage odczytywano do asercji, bez podmiany świata i wywoływania
silnika z konsoli. W głównej sesji ukończono osiem incydentów kampanii oraz
samodzielny trening z resetem i zachowaną historią.

| Przebieg przeglądarkowy                    | Dane | Obsłużone | Zaległe |   Wydatki |
| ------------------------------------------ | ---: | --------: | ------: | --------: |
| A po MFA, B jeszcze nieukończone           |    0 |       360 |       0 | 60 000 zł |
| B po ukończeniu audytu w oknie 2           |    0 |       360 |       0 | 60 000 zł |
| Ten sam B po imporcie punktu 14:25         |    0 |       360 |       0 | 60 000 zł |
| C po odziedziczonym MFA i audycie          |    0 |       360 |       0 | 60 000 zł |
| A po samym audycie                         | 2000 |       360 |       0 | 40 000 zł |
| A po wąskiej segmentacji                   |    0 |       360 |       0 | 42 000 zł |
| Kolejny B po tej samej wąskiej segmentacji |    0 |       288 |      72 | 42 000 zł |
| C po poszerzeniu grupy SMB                 | 2000 |       360 |       0 | 42 000 zł |

Sprawdzono: centralę, bilans 80/12/68, jawny zakres projektów, plan i przydziały,
równoległe kanały, przeniesienie pracy, odmowę nadmiernego wydatku, zakończenie
okna, briefing, rzeczywiście zmienione konta/reguły/źródła, raport i powrót.

- A po MFA nie miało S-19 ani sukcesu 13:58. Usługa zarejestrowała odmowę;
  legalny B-01 został wydany. Łącznie 4 odmowy MFA w A, 3 w C, 0 w legalnym B.
- B po MFA zachowało legalne S-19 i pełną działalność. Audyt dostarczył
  analitykowi obserwację legalnego odczytu 6 rekordów.
- A po samym audycie o 14:25 miało dostępny dowód wcześniejszego odczytu
  400 rekordów, a mimo zakupionego monitoringu ostatecznie ujawniło 2000.
- Przygotowanie zapisane w środku pracy wznowiło pozostałe godziny i finanse.
- Zapis, odświeżenie i import misji o 14:25 zachowały dokładnie cały stan kampanii
  i dalszy wynik. Różnice dat zakończenia są tylko metadanymi sesji.
- Błędna wersja i anulowanie poprawnego importu nie zmieniły gry ani zapisu.
- Jedna tura offline po wczytaniu zasobów działała poprawnie.
- Zmieniony ukryty typ/plany nie trafiały do aktywnego DOM. Raport ujawniał prawdę
  dopiero po zakończeniu; następny incydent miał świeżą wiedzę i biznes.
- Laptop **1366×950** i **375×812**: wszystkie konteksty centrali, misji oraz mapa
  bez poziomego przepełnienia strony. Mapa/tabele mają własne przewijanie.
  Sprawdzono Enter na mapie oraz widoczny focus. Osobny przebieg ukończył raport
  strategiczny w 375 px, potwierdził dokładny czas/zakres dowodu i tekst firmy 14 px.
- **0 pageerror, błędów konsoli i nieudanych odpowiedzi zasobów** w głównym przebiegu.

Zrzuty: [centrala](screenshots/strategy-01-headquarters.png),
[budżet/projekty](screenshots/strategy-02-projects.png),
[harmonogram](screenshots/strategy-03-schedule.png),
[aktywne zabezpieczenia](screenshots/strategy-04-active-controls.png),
[raport](screenshots/strategy-05-report.png),
[audyt](screenshots/strategy-06-file-evidence.png),
[koszt legalnego SMB](screenshots/strategy-07-segmentation-cost.png),
[raport 375 px](screenshots/strategy-08-report-mobile.png).
Surowe wyniki/skrypty sesji: `/workspace/scratch/strategic-*` poza produkcyjnym pakietem.

## Aktualizacja z prawdziwego Sprintu 6

Dwa fixture'y wygenerowano starym kodem z d1c3d56: stan 14:25 z administratorem
w trakcie zmiany i 1200 rekordami oraz finał bez przeciwnika. Testy odtwarzają
obie migawki, a aktywną prowadzą dalej do identycznego autorytatywnego wyniku.

Osobny przebieg Chromium uruchomił aplikację z rzeczywistym starym kluczem V1:
zero zapisów przed kontynuacją; po Enter dokładnie 14:25 i niezmieniony świat;
po turze 14:30 administrator ukończony, wyciek nadal 1200, źródło nadal 54 zdarzenia.
Nowy V2 powstał oddzielnie. Ponowne otwarcie kontynuowało V2, a oryginalny V1
pozostał identyczny bajt po bajcie, również po eksporcie.

Nieobsługiwana wersja V1 nie dostała fikcyjnej migracji. Oryginał był możliwy do
wyeksportowania i pozostał po świadomym rozpoczęciu nowej kampanii. Rzucający
getter localStorage nie zatrzymał przygotowania ani eksportu kampanii. Testy
adaptera obejmują również SecurityError/QuotaExceededError. Brak błędów JS.

## Analiza grywalności i ograniczenia

1. **Dlaczego inwestować?** Karty opisują konkretny mechanizm, źródło i granice;
   mapa oraz dokumentacja procesów pozwalają sprawdzić zależności. Raport nie
   dopisuje sukcesu od samej ceny.
2. **Czy trzy projekty różnią się?** A zmienia logowanie/uprawnienia, B dostarcza
   nowe dowody i zajmuje oba kanały pracy, C daje wybór zakresu i realny koszt
   legalnego SMB. Szersze C nie rozpoznaje człowieka za dozwolonym kontem.
3. **Czy czas ogranicza?** Tak: A+B nie dają się ukończyć w jednym oknie
   administratora; analityk B może pracować równolegle. Korekta aktywnej grupy C
   kosztuje godzinę i wymaga wolnego administratora.
4. **Czy można nic nie kupić?** Tak, zachowując 68 000 zł. Dotychczasowe ręczne
   obrony nadal działają, a ich rzeczywiste zmiany przechodzą dalej.
5. **Czy skutki są przewidywalne?** Zakres kont/protokołów, dostępne godziny,
   wymagane usługi, nieunieważnianie starych sesji i opóźnienie są jawne.
6. **Czy zakup zmienia grę?** Dopiero wykonane wdrożenie zmienia sesje, dostęp
   lub źródła dowodów. Rezerwacja i zapłata osobno nie robią tego.
7. **Czy niewłaściwy projekt kosztuje?** Sam audyt nie zapobiega 2000 rekordów;
   wąska segmentacja w legalnym B powoduje 72 zaległe. Płatność za rozpoczętą
   pracę nie jest automatycznie zwracana.
8. **Czy jest powód zmiany planu?** Pozostałe godziny B, bilans finansowy,
   zachowane awaryjne reguły i koszt zakresu w B uzasadniają kolejne okno.

**Balans pozostaje ograniczeniem:** A jest tańszą i w obecnych trzech znanych
przypadkach skuteczniejszą prewencją niż C. Nie udajemy równowagi przez losowe
bonusy, procenty lub ukryte kary. Rzeczywisty wybór C dopracowano przez dwa
zakresy i płatną czasem korektę, B przez odrębny rodzaj wiedzy i obciążenie obu
osób. To nadal pierwszy fragment strategii, nie dowód idealnego wyboru między
cenami narzuconymi GDD. Ekspert może też poprawnie obronić stare misje ręcznie.
Nie deklarujemy potwierdzonego FUN bez badań z ludźmi.

Pozostałe granice: cztery względne godziny i 18 tur, trzy stałe warianty,
uproszczony drugi składnik, grupowa praca zamiast 61 osobnych historii, jeden
serwerowy audyt. Nie ma pełnego SIEM, kampanii wielowątkowej, rynku, backendu ani
synchronizacji. Zachowana ręczna blokada/reset może obciążyć legalnego klienta
w kolejnym incydencie; nie dodano pełnego zarządzania cyklem życia kont.
Zapis V2 ma limity 8 MiB/10 000 komend/150 000 węzłów i 48 poziomów JSON, bez
obcinania danych. Wiele kart nie synchronizuje się; nowy start offline nie jest
gwarantowany przez service worker.

## Dostarczenie i publikacja

Nowe modele: `domain/campaign.ts`; dane: `content/securityProjects.ts`;
pure reducery/fabryki/projekcje: `application/campaignReducer.ts`, `gameSession.ts`,
`prepareCampaignIncident.ts`, `selectStrategyView.ts`; źródło: `simulation/fileAudit.ts`;
zapis: `persistence/gameSave.ts`, `gameStorage.ts`, dwa prawdziwe fixture'y V1;
UI: `Headquarters`, `MissionWorkspace`, `StrategicReport`, `FileEvidence` i style.
Zaktualizowano istniejący dostęp, telemetrię, zadania, aplikację, README i dokumentację.
Nie zmieniono GDD, LICENSE, .gitignore, wariantów treści, manifestu, lockfile ani
workflow publikacji. Nie dodano zależności.

Pages pozostaje na scalonym main. API potwierdza udany deployment 173d135
(Sprint 6). Bezpośredni GET publicznej domeny z tej maszyny zwrócił HTTP 403;
nie ogłaszamy testu nowego publicznego UI na podstawie API. Produkcyjny build
Sprintu 7 i zasoby pod `/cyber-fortress/` zostały sprawdzone lokalnie w Chromium.
PR nie może publikować: dotychczasowy workflow nadal dopuszcza wyłącznie `main`.
Pull Request: [#8 — Strategic Command](https://github.com/bsir9011-aew/cyber-fortress/pull/8).
Gałąź opublikowano do przeglądu; bez merge i bez produkcyjnego wdrożenia Sprintu 7.
