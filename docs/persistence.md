# Zapis operacji — FortressSaveV1 (Sprint 6)

> Aktualny format gry opisuje [FortressSaveV2](game-save-v2.md). Poniżej zachowano
> kontrakt V1 do walidacji starych plików. Sprint 7 odczytuje zgodne V1 i kopiuje
> zweryfikowany stan do V2 po świadomym wznowieniu; nie nadpisuje oryginału V1.

Sprint 6 używa localStorage, zgodnie z jego zakresem. GDD przewiduje IndexedDB
dla większego MVP; nie zmieniamy teraz GDD ani nie dodajemy bazy lub biblioteki.

## Jedna symulacja, pełna migawka

`OperationSession` w application zawiera jeden autorytatywny `SimulationState`,
komendy od początku próby, metadane oraz `SavedUiState`. Komendy rozstrzyga
dotychczasowy `simulationReducer`; zapis nie ma własnych zasad dostępu,
biznesu, logowań ani przeciwnika. Bieżący widok nadal przechodzi przez
`selectPlayerView`, a ujawnienie prawdy przez `selectMissionReport` po turze 18.

Przepływ: komenda → istniejący reducer → nowa sesja → walidacja i zapis.
Odczyt: pamięć/plik → limit i parse → kontrola wersji → struktura komend →
kontrolne odtworzenie istniejącym reducerem → porównanie całej migawki →
potwierdzenie w UI → zastąpienie sesji. Odtworzenie kontrolne jest lokalną
zmienną walidatora, nie drugim stanem rozgrywki. Nie emituje efektów, nie
dopisuje alertów/logowań do wczytanego świata i nie wykonuje dodatkowej tury.

## Kontrakt JSON

Autorytatywna deklaracja: `src/persistence/saveFormat.ts`, interfejs
`FortressSaveV1`. Każde poniższe pole jest wymagane. Nie akceptujemy obcych pól
koperty, komend i UI ani domyślnie nie uzupełniamy brakujących danych.

| Pole              | Typ / wartość V1                                              | Znaczenie                                                           |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `schemaVersion`   | `1`                                                           | Format koperty; inna wersja jest odrzucana.                         |
| `engineVersion`   | `"6.0.0"`                                                     | Kontrakt zapisu tego wydania, niezależny od marketingowego DEV 0.2. |
| `contentVersion`  | `"nexus-variants-1"`                                          | Zgodny katalog trzech konfiguracji.                                 |
| `scenarioId`      | string                                                        | Musi odpowiadać trybowi/seedowi i ukrytej definicji.                |
| `scenarioVersion` | `1`                                                           | Wersja konfiguracji scenariusza.                                    |
| `savedAt`         | UTC ISO `YYYY-MM-DDTHH:mm:ss.sssZ`                            | Rzeczywisty moment zapisu.                                          |
| `attemptId`       | string, 1–96 znaków `[a-zA-Z0-9._-]`, początek alfanumeryczny | UI tworzy UUID; wznowienie/import zachowuje ID.                     |
| `createdAt`       | UTC ISO                                                       | Rzeczywisty początek próby.                                         |
| `completedAt`     | UTC ISO lub `null`                                            | Wymagane po turze 18, wcześniej `null`.                             |
| `simulation`      | pełny `SimulationState`                                       | Wszystkie pola domeny, w tym run, hidden i history.                 |
| `commands`        | tablica `RecordedCommand`                                     | Kolejność komend od początku próby; bez reset/start-run.            |
| `uiState`         | obiekt opisany niżej                                          | Widok potrzebny do wznowienia.                                      |

`simulation.run` przechowuje tryb `training`/`unknown` i nieujemny bezpieczny
całkowity seed. Zegar zawiera turę, początek, długość tury i limit. Świat
obejmuje zasoby/strefy/relacje, access konta/sesje/reguły/uprawnienia, business
bilans i ostatni raport, tasks wszystkie zadania. Knowledge zachowuje źródła,
zakresy i czasy pozyskania dowodów. Telemetry przechowuje także indeks
przetworzonego źródła. Hidden zawiera opcjonalnego przeciwnika z harmonogramem,
historią i licznikami, legalnych aktorów, pochodzenie sesji, decyzje i definicję
scenariusza. Żaden z tych elementów nie jest rekonstruowany domysłem.

`commands` przyjmuje tylko `advance-turn`, `set-hypothesis` i `schedule-task`
z jawnie sprawdzonymi typami akcji, wykonawcą, identyfikatorem i parametrem.
Obejmuje też odrzucone zlecenia, ponieważ ich potwierdzenia należą do historii.
Po zakończeniu misji aplikacja nie dopisuje komend. Reset/powtórka rozpoczyna
nową sesję z nowym ID i pustym dziennikiem, identycznym stanem startowym i seedem.

`uiState` ma dokładnie pola:

```json
{
  "briefing": false,
  "context": "cases",
  "layer": "network",
  "selection": null
}
```

Konteksty: `cases`, `operations`, `architecture`. Warstwy: `network`, `identity`,
`business`, `telemetry`. Selection to `null` lub `{ "kind": "asset" | "connection",
"id": string }` z istniejącą referencją. Formularze niezleconych prac, scroll,
otwarte sekcje HTML i otwarcie historii nie są częścią świata ani zapisu.

## Walidacja i limity

- Do 2 MiB UTF-8, sprawdzane przed JSON.parse; import sprawdza też `File.size`
  przed odczytaniem zawartości.
- Do 2048 komend, 150 000 węzłów JSON i 48 poziomów zagłębienia. Klucze
  `__proto__`, `constructor`, `prototype` są odrzucane. Nie ma eval ani HTML z pliku.
- Typy enum są sprawdzane bez konwersji typów. ID, seed, daty i UI mają jawne
  walidatory. Nieznane wersje zwracają osobny komunikat.
- Cały stan musi być równy wynikowi tych samych komend w znanej wersji treści
  i silnika. Porównanie uwzględnia wszystkie klucze, tablice i wartości, niezależnie
  od kolejności kluczy JSON. To sprawdza zakres tur, bilans biznesu, terminy zadań,
  referencje, liczniki, poświadczenia, sesje, źródła dowodów i ukrytą historię.
- Metadane czasu nie sterują symulacją; daty mają poprawny format i kolejność
  utworzenie ≤ zakończenie ≤ zapis. Nie ma naliczania czasu nieobecności.

Zmiana semantyki silnika wymaga zmiany `ENGINE_VERSION`, a treści
`CONTENT_VERSION`/`SCENARIO_VERSION`. Bramka w `readSave` jest miejscem przyszłej
jawnej migracji. V1 nie migruje, nie zgaduje i nie uruchamia zmienionych treści
na starym zapisie. Migawka musi pochodzić z komend obsługiwanej wersji; ręczne
modyfikacje fixture'ów świata poza API nie są obsługiwanym formatem importu.

To walidacja technicznej spójności, nie zabezpieczenie przed oszukiwaniem:
osoba znająca kod może stworzyć inną spójną sekwencję. Plik zawiera fikcyjną
prywatną prawdę i liczbowe wersje poświadczeń, bez prawdziwych haseł lub danych
osobowych gracza. Nie wysyłamy go na serwer.

## localStorage i awarie

Klucze: `fortress-lab.save.v1` oraz `fortress-lab.history.v1`. Każdy zapis jednego
klucza używa pojedynczego `setItem`, bez czyszczenia starej wartości przed zapisem.
Te dwa klucze nie są wspólną transakcją. Gdy karta zamknie się po zapisaniu finału,
ale przed historią, wznowienie finału dopisze brakujący wiersz bez duplikatu ID.

Leniwy odczyt startowy wykonuje się przed efektami. Flaga `active` pozostaje
fałszywa do świadomego startu/wznowienia/importu. Pierwszy render, otwieranie
historii i wyświetlanie menu nie nadpisują zastanego zapisu. Zmiana sesji lub
zapisywanego widoku uruchamia efekt; sam render, animacja i czytanie dowodów nie.

`SecurityError`, `QuotaExceededError`, uszkodzony JSON i błąd odczytu pliku są
wynikami błędu, nie awariami React. Błędny import nie dotyka pamięci ani sesji;
poprawny pyta o zastąpienie. Gra kontynuuje w pamięci przy błędzie zapisu i
umożliwia eksport oraz ponowienie. Uszkodzona historia pozostaje nietknięta do
jawnego czyszczenia; niedostępna pamięć pozwala porównywać wyniki bieżącej karty.

## Historia i ograniczenia

Historia ma osobną kopertę `{ schemaVersion: 1, attempts: AttemptSummary[],
clearedAt: string | null }`, do 50 unikalnych ID i 64 Ki znaków JSON. Walidator
sprawdza znany wariant, seed, turn=18, liczniki 0–2000/360, bilans 360 zamówień,
cele i zastosowanie ograniczenia zagrożenia. Źródłem podsumowania jest raport,
nie wartości przykładowej tabeli. `keyActions` liczy ukończone zmiany administratora.

Wznowienie nie tworzy nowego wiersza. Ponowne zakończenie zaimportowanego
wcześniejszego punktu tego samego ID aktualizuje jego podsumowanie; nie tworzy
drzewa alternatywnych historii. Jawna powtórka tworzy odrębne ID. `clearedAt`
zapobiega przywróceniu skasowanych finałów po odświeżeniu i nie blokuje przyszłego
wyniku rozgrywki będącej w toku podczas czyszczenia.

Jest jeden bieżący zapis na origin. Różne urządzenia/przeglądarki i dev/Pages nie
współdzielą pamięci; transfer odbywa się przez JSON. Dwie równolegle grające karty
nie synchronizują się — ostatni zapis wygrywa. Historia nie jest częścią eksportu
bieżącej próby. Usunięcie danych strony usuwa oba klucze. Po wczytaniu zasobów
gra działa offline, ale nie ma service workera gwarantującego nowy start lub
odświeżenie strony bez sieci. Przekroczenie limitu zapisu daje komunikat;
nie obcinamy historii świata ani dowodów w celu zmieszczenia pliku.
