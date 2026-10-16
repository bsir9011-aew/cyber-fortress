# Sprint 5 — porównanie wariantów i walidacja

Raport ujawnia rozwiązania. Trzy warianty rozpoczynają się o 14:00, trwają
18 tur i otrzymują 360 zamówień. Początkowy alert jest identyczny, lecz prawda
świata pozostaje różna i ustalona przed decyzjami gracza.

## Pełne przebiegi porównawcze

Każda komórka: **ujawnione rekordy / obsłużone zamówienia / zaległe**.
Wszystkie 12 przebiegów wykonuje te same mechanizmy i dokładnie 18 tur.

| Strategia | A — przejęty S-19 | B — legalna sesja | C — nowe logowanie |
| --- | --- | --- | --- |
| Bez ograniczeń dostępu | 2000 / 360 / 0 | 0 / 360 / 0 | 2000 / 360 / 0 |
| SMB deny zlecone 14:00, gotowe 14:10 | 0 / 360 / 0 | 0 / 296 / 64 | 0 / 296 / 64 |
| Tylko blokada nowych logowań gotowa 14:05 | 2000 / 360 / 0 | 0 / 360 / 0 | 0 / 360 / 0 |
| Logi, rozmowa i decyzja zależna od dowodów | 0 / 360 / 0 | 0 / 360 / 0 | 0 / 360 / 0 |

Ostatnia strategia jest testowym przykładem, nie automatyczną poradą w grze.
Pozyskuje logi do 14:05 i relację do 14:10. Przy relacji o laptopie zestawionej
z legalną rolą konta pozostawia dostęp. Przy zaprzeczeniu użycia konta i sukcesie
w logach kończy wskazaną sesję do 14:15 i blokuje logowania do 14:20. Gdy nie ma
sukcesu, blokuje nowe logowania do 14:15. Nie odczytuje ID ani prywatnego typu
wariantu. Nie jest to dowód, że sama relacja człowieka daje pewność techniczną.

W C brak obrony daje rzeczywiste logowanie S-20 o 14:15, rekonesans o 14:20,
start o 14:25 i porcje 400/800/800 o 14:30/14:35/14:40. Nie istnieje S-19 ani
sukces z 13:58. Blokada ukończona o 14:15 ma pierwszeństwo przed pierwszą próbą;
odmowy występują o 14:15/14:25/14:35 i wyczerpują trzy próby.

### Koszt stałej strategii „zawsze SMB”

W B/C dwie pierwsze tury obsługują po 20 zamówień. Po ukończeniu deny o 14:10
pozostałe 16 przedziałów ma wydajność 16:

`obsłużone = 2 × 20 + 16 × 16 = 296`

`zaległe = 360 − 296 = 64 > 40`

ERP/HTTPS pozostaje dostępny; znika wyłącznie część 6 wymagająca także SMB
i legalnego uprawnienia. Odebranie legalnej sesji lub uprawnienia daje ten sam
spadek bez zmiany reguły. Nie odejmujemy punktów ani zamówień za przycisk.
W A nie ma tej części procesu, dlatego wynik pozostaje 360/0.

Dodatkowe sprawdzenia:

- Zakończenie legalnego S-19 w B daje ponowne logowanie Marty po jednej turze;
  jeden przedział ma wydajność 16, a końcowa kolejka zostaje nadrobiona.
- Blokada konta i zakończenie S-19 w B uniemożliwiają powrót legalnej klientki:
  296 obsłużonych i 64 zaległe, mimo braku napastnika.
- Tymczasowe deny w C do wyczerpania prób, potem allow gotowe 14:50: **0 / 344 / 16**.
  Raport nadal pokazuje niespełniony cel ograniczenia dostępu i zatrzymanie tylko
  budżetem planera. Dobry wynik dwóch osi nie dowodzi usunięcia możliwości.

### Zachowane pięć strategii referencyjnych 4B

| Strategia historyczna | Ujawnione | Obsłużone | Zaległe |
| --- | ---: | ---: | ---: |
| A — ignorowanie ostrzeżenia | 2000 | 360 | 0 |
| B — dowody i SMB deny gotowe 14:20 | 0 | 360 | 0 |
| C — VPN off 14:05 bez przywrócenia | 0 | 156 | 204 |
| D — zakończenie tylko S-19 o 14:10 | 2000 | 360 | 0 |
| E — późne SMB deny gotowe 14:25 | 400 | 360 | 0 |

Litery strategii w historycznym raporcie są niezależne od liter nowych wariantów.

## Testy

```bash
npm test
npm run typecheck
npm run build
git diff --check

# Nazwy nowych przypadków i rzeczywiste liczniki przebiegów:
npm test -- src/simulation/scenarioVariants.test.ts --reporter=verbose --disableConsoleIntercept
```

**192/192 testy w 9 plikach, zero pominiętych i błędów.** Zachowano 123 wcześniejsze
przypadki; dodano 30 przypadków konfiguracji i 39 przypadków mechanizmów/strategii.

| Plik | Przypadki |
| --- | ---: |
| `createInitialWorld.test.ts` | 6 |
| `infrastructureSelectors.test.ts` | 6 |
| `access.test.ts` | 11 |
| `attacker.test.ts` | 40 |
| `engine.test.ts` | 21 |
| `mapLayout.test.ts` | 3 |
| `incident.test.ts` | 36 |
| `createScenario.test.ts` | 30 |
| `scenarioVariants.test.ts` | 39 |

Starsze testy otrzymały wyłącznie typ `ReferenceSimulationState` oraz jawny
parametr typu jednej redukcji. Nie zmieniono asercji, oczekiwań ani wyników.
Nie usunięto i nie wyłączono żadnego przypadku.

Nowe testy obejmują walidację referencji i seedów, niezależność kopii, rzeczywisty
brak przeciwnika, mechaniczne wytwarzanie legalnych logowań, brak nieistniejących
sukcesów, odrębne relacje, reset, ponowienia i warunki każdej porcji. Siedem
przeciwprzykładów po pierwszych 400 rekordach usuwa kolejno tunel, ważność,
politykę, uprawnienie, serwer, topologię lub protokół — następna porcja nie dociera.

Testy prywatności obejmują wszystkie warianty i jawnie zaznaczoną hipotezę.
Podmiana prywatnego typu, nazwy, pochodzenia sesji i przeciwnika nie zmienia
projekcji, detekcji ani narracji przy zachowaniu jawnych faktów. Dostępne
hipotezy nie są traktowane jako ujawnienie prawdziwego typu. Raport jest
niedostępny przed końcem; legalny wynik ma pustą historię i ocenę zagrożenia
`applicable: false`, bez fikcyjnego stanu przeciwnika.

Typecheck nadal obejmuje domenę i silnik z samym ES2022, bez DOM. Build używa
dotychczasowych zależności, bez nowych bibliotek lub backendu.

## Chromium i screenshoty

Produkcję sprawdzono w Chromium przez rzeczywiste przyciski, bez wstrzykiwania
stanu. **Osiem pełnych przebiegów:** A/B/C bez ograniczeń, A/B/C ze stałą blokadą
SMB oraz A i C z reakcją po dowodach. B bez ograniczeń obejmował także badania.
Wyniki zgadzały się z tabelą.

Sprawdzono wybór treningu/nieznanego incydentu, zachowanie numeru przy powtórce,
przejście B→C→A, czyszczenie dowodów i zadań, różne relacje Marty, brak S-19 w C,
nowy S-20 dopiero w późniejszym odczycie, feedback o FS-01 i właściwe raporty.
Legalny raport nie zawiera historii ani oceny pokonania przeciwnika.

Desktop **1366 × 950** i **375 px**: trzy konteksty, mapa, inspektor, klawiatura,
mobilne skróty i brak poziomego przepełnienia strony. Brak błędów JavaScript lub
konsoli. Opisy dowodów mają co najmniej 12 px; poprawiono też małe etykiety,
statusy i kontrast, zachowując istniejący motyw i układ.

1. [Wybór trybu](screenshots/variants-01-selection.png).
2. [Raport A — brak obrony](screenshots/variants-02-reference-report.png).
3. [Raport B — legalna sesja, 64 zaległe po SMB deny](screenshots/variants-03-legitimate-report.png).
4. [Raport C — zatrzymane nowe logowanie](screenshots/variants-04-credential-report.png).
5. [Legalne zależności i wydajność 16 po blokadzie SMB](screenshots/variants-05-smb-business-cost.png).

## Techniczna ocena grywalności

| Obszar | Obserwacja |
| --- | --- |
| Uczciwe dowody | Każdy wariant ma płatne logi, sesje, własną relację i jawną dokumentację procesu przed końcem. Brak sukcesu w C jest rzeczywistą różnicą źródła. |
| Jedna strategia | Stałe SMB, same logowania i brak reakcji nie są optymalne we wszystkich wariantach. Nie jest to dowód wykluczający każdą możliwą uniwersalną sekwencję. |
| Rozpoznanie legalnej aktywności | W B relacja o laptopie zgadza się z sukcesem i legalną rolą w FS-01. Rozmowa nie daje automatycznej oceny ani pewności technicznej. |
| Koszt kolejnego badania | Logi i rozmowa do 14:10 pozwalają zareagować przed pierwszym logowaniem C. Kolejne badanie przesuwa termin administracyjnej zmiany; nie odświeża się wiedzy bez kosztu. |
| Uzasadniony koszt blokowania | SMB odbiera realną część wydajności, a wyłączenie VPN szerszą. Skutki wynikają z tych samych funkcji dostępu co atak. |
| Podobny początek, inne decyzje | Identyczne alerty, a nawet logi A/B, prowadzą do potrzeby kontekstu; C premiuje zablokowanie nowego uwierzytelnienia, A wymaga uwagi dla istniejącego tunelu. |

Nie deklarujemy potwierdzonego FUN. Przejście techniczne i testy nie zastępują
badania z ludźmi: trzeba sprawdzić rozumienie źródeł, odróżnianie relacji od
dowodu technicznego i chęć ponownej próby po poznaniu wyniku.

## Ograniczenia

- Trzy stałe definicje i przewidywalny cykl, bez proceduralnego generatora.
  Po poznaniu całego katalogu można zapamiętać wzorce; to nie jest rozwiązanie
  nieskończonej regrywalności.
- Legalne zachowania są małymi profilami i sekwencją uwierzytelnień, bez pełnej
  symulacji użytkowników, urządzeń i dystrybucji haseł.
- Jeden przeciwnik lub jego brak; zachowany budżet 3 porażek można wykorzystać
  czasową blokadą. Raport wykazuje pozostawioną możliwość i niespełniony cel
  ograniczenia po otwarciu przepływu, zamiast przypisywać trwałe bezpieczeństwo.
- Brak sensora ruchu, audytu plików, pełnego SIEM, zapisu gry i backendu.
- Wniosek z hipotezy pozostaje decyzją gracza; nie tworzymy automatycznego
  potwierdzenia na podstawie samej wypowiedzi Marty.

Kontrakty, walidację i API opisuje [konfiguracja scenariuszy](scenario-configuration.md).
