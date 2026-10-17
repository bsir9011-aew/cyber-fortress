# FortressSaveV2 — kampania i bezpieczna aktualizacja

## Koperta i sesja

`src/persistence/gameSave.ts` definiuje:

```ts
interface FortressSaveV2 {
  schemaVersion: 2;
  engineVersion: '7.0.0';
  contentVersion: 'nexus-strategy-1';
  savedAt: string; // UTC ISO, wyłącznie metadane
  session: GameSession;
}
```

`GameSession` ma dwa jawne warianty:

- `{ kind: 'incident', operation: OperationSession }` — istniejący pojedynczy
  świat, komendy, daty/ID i zapisany kontekst/mapa/briefing.
- `StrategicSession` — `kind: 'campaign'`, `attemptId`, `createdAt`, `initialSeed`,
  `campaign`, `commands`, `missionMetadata`, `uiState`, `headquartersTab`.

`campaign` obejmuje budżet z pełnym ledgerem, statusy i pozostałe godziny projektów,
okno oraz przydziały pracy, trwałe polityki i ręczne zmiany, etap, następny seed,
raporty ukończonych misji i opcjonalny bieżący `SimulationState`. W nim pozostają
sesje, zadania, wiedza, telemetryczne źródła/kursory, prywatni aktorzy i narracja.
Nie zapisujemy drugiej kopii aktywnego świata poza tym polem.

`commands` obejmuje planowanie/rezerwację/anulowanie projektu, przydział pracy,
godzinę przygotowania, wybór grupy segmentacji, start incydentu, istniejące
komendy incydentu i powrót do centrali, także odrzucenia. Zmiany widoku nie są
komendami silnika. `initialSeed` i journal wystarczają do kontrolnego odtworzenia
wszystkich stanów kampanii. Nie ma osobnego silnika do zapisu.

`missionMetadata` istnieje tylko przy bieżącej misji. ID to ID kampanii + numer
okna. Daty początku i końca są poza stanem autorytatywnym, nie sterują światem.
`headquartersTab` to `overview`, `projects`, `schedule`, `posture` lub `map`;
`uiState` zachowuje ten sam kontrakt kontekstu/mapy co V1.

## Walidacja

Przed zastąpieniem gry sprawdzamy:

1. Rozmiar do 8 MiB UTF-8, poprawny JSON i dokładne wersje koperty.
2. Limit 150 000 węzłów / 48 poziomów JSON, brak niebezpiecznych kluczy prototypu.
3. Dokładne wymagane pola, enumy bez konwersji typów, ID, daty i referencje UI.
4. Do 10 000 komend. Każda ma poprawny kształt, projekt, wykonawcę i parametry.
5. Cały `CampaignState` lub pojedynczy `SimulationState` musi być równy wynikowi
   tego samego istniejącego reducera dla journalu. Uwzględniamy budżet, saldo,
   terminy, postęp, polityki, referencje, źródła i ukrytą prawdę.
6. Metadane aktualnej misji muszą odpowiadać etapowi oraz numerowi okna; daty
   muszą mieć poprawny format i kolejność. Nie wykonujemy tury na wczytaniu.

Nie uzupełniamy istotnych braków i nie naprawiamy uszkodzonego świata. Błędny
import nie zmienia sesji, V2 ani V1. Poprawny import wymaga potwierdzenia zamiany.
Eksport nie zmienia świata. Zegar stoi po zamknięciu karty, także podczas
przygotowania. Walidacja jest sprawdzeniem spójności, nie kryptografią przeciw
oszukiwaniu. Pliki zawierają fikcyjną prywatną prawdę; nie ma danych osobowych
użytkownika, haseł lub prawdziwych kluczy MFA.

## Zgodność kontrolowanego odblokowania

Rozszerzenie `schedule-task` o `{ type: 'unblock-account', accountId }` jest
dostępne wyłącznie w walidatorze komend V2 (zarówno samodzielnej misji, jak
kampanii). Wymagamy dokładnych pól i poprawnego identyfikatora. Przy odtwarzaniu
reducer sprawdza istniejące, znane i zablokowane konto, wykonawcę oraz czas.
Migawka musi zgadzać się także w trakcie zadania i po jego ukończeniu; samo
podmienienie stanu konta albo terminu zadania nie przechodzi walidacji.

Koperta pozostaje `2 / 7.0.0 / nexus-strategy-1`: to dodanie nowej operacji bez
zmiany wyników wcześniejszych komend ani kształtu zapisanej migawki. Istniejące
V2 nie wymagają migracji, resetowania blokad ani uzupełniania pól. Fixture
`sprint7-blocked-v2.json` pochodzi z niezmienionego kodu `a51312c`; test porównuje
cały dawny stan, wykonuje nowe zadanie po imporcie i zapisuje jego wynik w
następnym oknie. Kontrakt V1 nadal odrzuca nową operację.

## V1 pozostaje nienaruszony

Klucze są rozdzielone:

| Klucz                     | Rola                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `fortress-lab.save.v1`    | Oryginalny zapis Sprintu 6; nowy UI nigdy go nie nadpisuje ani nie usuwa. |
| `fortress-lab.game.v2`    | Nowy autozapis samodzielnej misji albo kampanii.                          |
| `fortress-lab.history.v1` | Zachowana niezależna historia 50 samodzielnych prób.                      |

Przy starcie adapter odczytuje oryginał V1, a jeśli istnieje V2, sprawdza V2 jako
najnowszą sesję. Uszkodzonego V2 nie maskuje cichym powrotem do starego punktu V1.
Bez V2 zgodne V1 jest sprawdzane kontraktem silnika 6.0.0/content
`nexus-variants-1` i porównaniem pełnej migawki z istniejącym reducerem. Dopiero
potwierdzone wznowienie/import zapisuje zweryfikowany stan jako V2 do nowego
klucza. Sam początkowy render nie pisze żadnego klucza.

Przycisk **Eksportuj oryginał V1** pobiera jego dokładne bajty, także gdy plik ma
nieobsługiwaną wersję lub nie można go bezpiecznie odtworzyć. Nowa gra może
zastąpić V2 po potwierdzeniu, ale nadal zachowuje ten oryginał. V1 nie staje się
synchronizowaną kopią nowych postępów — pozostaje bezpiecznym punktem aktualizacji.

Fixture'y V1 pochodzą z niezmienionych źródeł commita
`d1c3d56e9293f78ac6cadeef4339b8e699341508`, nie z generatora nowej wersji:
[pochodzenie i sekwencje](../src/persistence/fixtures/README.md). Obejmują aktywną
misję 14:25 z zadaniem w toku/1200 ujawnionymi rekordami oraz ukończony wariant
bez przeciwnika. Testy porównują cały stan i dalszy przebieg; Chromium sprawdza
zerowe zapisy przed kontynuacją, migrację i eksport oryginalnych bajtów.

Jeżeli przyszłe zmiany nie pozwolą przejść kontroli zgodności, zachowujemy plik
z błędem zamiast udawać migrację. Nie ma złożonego systemu migracji ani wymuszonej
konwersji samodzielnej misji do kampanii.

## Awarie i limity

Odczyt gettera localStorage, zapis, quota, odczyt pliku i serializacja są objęte
obsługą błędów. Gra może działać w pamięci i eksportować plik przy braku storage.
Wskaźnik pokazuje sukces/błąd/brak zapisu. Autozapis reaguje na zaakceptowaną
zmianę sesji lub zapisywanego widoku; nie zapisuje każdej animacji/renderu.

Jeden bieżący V2 na origin, bez synchronizacji kart i urządzeń. Historia kampanii
jest częścią jej stanu; historyczne samodzielne próby pozostają osobnym kluczem.
Nie ma backendu ani service workera gwarantującego świeże otwarcie offline.
Po załadowaniu zasobów można grać, zapisywać oraz eksportować bez sieci.
Przekroczenie limitów daje błąd zapisu, bez obcinania dowodów lub journalu.
