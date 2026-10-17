# FortressSaveV3 — integralność i zachowane oryginały

Sprint 8 używa koperty `schemaVersion: 3`, `engineVersion: '8.0.0'`,
`contentVersion: 'nexus-integrity-1'`, `savedAt` i jednego `GameSession`.
Kod: `persistence/gameSaveV3.ts`, `currentGameStorage.ts`.

## Co jest nowe

Aktywny `SimulationState` może posiadać opcjonalne `integrity`, a `hidden`
opcjonalnego lokalnego aktora. W ich zakresie są pełne dokumenty i generacje,
kopie i wyniki weryfikacji, zadania z oryginalnymi terminami, obserwacje,
historia odtworzeń, uzgodnienia, hipoteza, wiedza w chwili decyzji i prywatne
próby. `CampaignCommand` rozróżnia jawny start nowej rodziny. `TaskAction`
obejmuje badania, izolację, ograniczenie zapisu, podłączenie i recovery.
Sesje nie są używane do reprezentowania lokalnej stacji.

Raporty kampanii mogą mieć podsumowanie integralności, a SecurityPosture
zachowuje rzeczywiste ograniczenia endpointu. Żadnego z tych nowych pól nie
dodajemy domyślnie do dawnych stanów. `scenarioCatalog` nadal ma trzy pozycje;
historyczne `seed % 3` oraz referencje UI pozostają niezmienione.

## Walidacja i migracja

V1 i V2 przechodzą swoje dotychczasowe walidatory koperty i komend. Następnie
wspólny mechanizm odtwarza journal istniejącym reducerem i porównuje **cały**
stan, zadań, źródeł, prywatnej prawdy i metadanych nie pomijając. Zgodna stara
sesja jest przenoszona do koperty V3 bez zmiany świata. Nie wykonujemy tury,
nowego logowania, zadań, inicjalizacji Misji 02 ani resetu blokad.

V3 korzysta z tego samego `validateGameSession`, ale ma odrębny, ścisły
walidator nowych komend. V2 nadal odrzuca `start-integrity-incident` i nowe
operacje; sama podmiana numeru koperty nie daje poprawnej migracji. Nie
uzupełniamy brakujących istotnych danych zgadywaniem. Odrzucamy obce wersje,
nadmiarowe pola, niepoprawne identyfikatory, enumy udawane tablicą, klucze
prototypu oraz migawki niezgodne z rzeczywistym odtworzeniem.

Limity pozostają 8 MiB UTF-8, 10 000 komend, 150 000 węzłów i 48 poziomów
JSON. Błędy nie zastępują aktywnej gry ani nie powodują obcinania danych.
To kontrola spójności, nie zabezpieczenie kryptograficzne przeciw oszukiwaniu.

## Trzy niezależne klucze

| Klucz | Zachowanie Sprintu 8 |
| --- | --- |
| `fortress-lab.save.v1` | wyłącznie odczyt i eksport oryginalnych bajtów |
| `fortress-lab.game.v2` | wyłącznie odczyt i eksport oryginalnych bajtów |
| `fortress-lab.game.v3` | aktualna misja/kampania, jedyny zapisywany klucz gry |
| `fortress-lab.history.v1` | zachowana historia samodzielnych prób |

Przy starcie kolejność jest V3 → V2 → V1. Niepoprawnego V3 nie maskujemy
powrotem do starszej gry. Sam początkowy render niczego nie zapisuje.
Kontynuacja lub zatwierdzony import zapisuje zweryfikowaną sesję do V3.
Przyciski **Eksportuj oryginał V1/V2** działają także dla nieobsługiwanych
wersji. Rozpoczęcie nowej gry nadpisuje V3 po potwierdzeniu, zachowując stare
oryginały. Nie ma automatycznej konwersji pojedynczej misji w kampanię.

Odświeżenie w trakcie restore zachowuje termin, wszystkie generacje i stany
dokumentów, wybraną kopię, jej sprawdzenie oraz zaplanowane działania aktora.
Import nie przyspiesza pracy. Testy porównują identyczny dalszy przebieg i
raport, nie tylko wybrane liczniki.

## Rzeczywiste pliki poprzednich wersji

Testy importują dwa V1 ze źródeł Sprintu 6 oraz dwa V2 sprzed Sprintu 8:
blokadę przeniesioną do legalnego B i trwające odblokowanie administratora.
Nie wygenerowano ich nowym silnikiem. [Pochodzenie fixture'ów](../src/persistence/fixtures/README.md).
Chromium dodatkowo sprawdza brak zapisów przed kontynuacją, równość pełnego
świata oraz eksport oryginału bajt po bajcie.

Getter localStorage, quota i odczyt/serializacja pliku są obsłużone. Przy braku
pamięci gra może działać w pamięci i eksportować V3. Nie ma synchronizacji
kart ani backendu. Pliki zawierają fikcyjną prywatną prawdę gry; eksport nie
jest formatem ukrywającym rozwiązanie przed czytającym JSON.
