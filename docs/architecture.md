# Architektura FORTRESS LAB — Sprint 3

Jedna aplikacja React + TypeScript + Vite z natywną mapą SVG. Silnik to czyste
funkcje TypeScript: bez Reacta, DOM, zegara systemowego, I/O i losowości.
`tsconfig.simulation.json` sprawdza domenę i silnik z samą biblioteką ES2022.
Nie ma dodatkowych zależności projektu ani backendu.

## Moduły i jedno źródło prawdy

| Katalog              | Odpowiedzialność                                                     |
| -------------------- | -------------------------------------------------------------------- |
| `src/domain`         | Kontrakty infrastruktury, tożsamości, dostępu i symulacji.           |
| `src/content`        | Infrastruktura i referencyjny wariant symulacji NEXUS.               |
| `src/simulation`     | Zegar, biznes, dostęp, walidacja zadań i przejścia stanu.            |
| `src/application`    | Inicjalizacja, reset/reducer, projekcja dla gracza i selektory mapy. |
| `src/ui`             | Mapa, inspektor, panele, formularze komend i polskie opisy zdarzeń.  |
| `src/persistence`    | Miejsce na przyszłe adaptery zapisu i migracje.                      |
| `docs` / `prototype` | Dokumentacja, screenshoty i niezmieniony prototyp 0.1.               |

`SimulationState` zawiera jeden `world: WorldState` oraz zegar, proces i bilans
biznesowy, fakty dostępu, zadania, wiedzę gracza, historię i ukryte pochodzenie
sesji. Dostępność zasobu istnieje tylko w `world.assets[].status`: nie ma drugiej
flagi VPN w React ani w stanie dostępu. `WorldState` nadal zawiera 9 zasobów,
5 stref i 11 relacji topologii. Konta i uprawnienia są odrębnymi faktami silnika.

`createInitialSimulation` głęboko kopiuje dane scenariusza i inicjalizuje pustą
wiedzę oraz historię. `simulationReducer` obsługuje reset przez nową inicjalizację;
pozostałe komendy przekazuje do `applySimulationCommand`. React korzysta z tego
reducera i przechowuje osobno tylko wybór mapy, warstwę i wartości formularzy.
Nie ma timerów, osobnych liczników biznesowych ani reguł gry w komponentach.

## Czas, zadania i kolejność granicy tury

Start 14:00, 18 tur po 5 minut, termin 15:30. Godzina jest wyliczana z numeru tury,
bez `Date.now`, interwałów i upływu czasu rzeczywistego. Czytanie i przyjmowanie
komend nie przesuwa zegara. Na granicy tury:

1. Rozliczamy napływ i obsługę zamówień za zakończony przedział według starej konfiguracji.
2. Kończymy należne zadania, sortując po terminie, priorytecie i stabilnym ID. Zmiany administratora poprzedzają odczyt analityka.
3. Wygaszamy sesje i rozstrzygamy ponowne logowanie legalnego zespołu przy aktualnej konfiguracji.
4. Ukończone badanie odczytuje dozwolone pola aktywnych sesji z dostępnej bramy.
5. Po turze 18 oceniamy cel biznesowy i blokujemy dalszą rozgrywkę. Reset pozostaje dostępny.

Włączenie VPN o 14:15 nie poprawia wyniku okresu 14:10–14:15. Raport poprzedniego
przedziału oraz bieżąca wydajność są celowo osobnymi wartościami. Zmiany dokonane
na granicy poprzedzają próbę nowego logowania, zgodnie z kontraktem GDD.

Jeden analityk i jeden administrator pracują równolegle, ale każdy może mieć
najwyżej jedno zadanie. Zajęty wykonawca oznacza jawne odrzucenie, bez kolejki.
Badanie sesji, zakończenie tunelu, blokada nowych logowań i zmiana stanu VPN trwają
jedną turę. Reset poświadczenia i zmiana konkretnej reguły trwają dwie tury.
Zadania nie kończące się do 15:30 są odrzucane już przy zleceniu.

Walidacja obejmuje rodzaj komendy, wykonawcę, jego zajętość, cel, stan symulacji,
obserwację wskazanej sesji/konta i sens zmiany. Przyjęcie zadania rezerwuje kanał
pracy, lecz nie zmienia infrastruktury. Historia używa kolejnych stabilnych ID,
a identyczne sekwencje komend dają identyczny wynik i historię.

## Proces obsługi zamówień

Niezależny portal dostarcza 20 zamówień na turę. Lokalne stanowiska mają wydajność
8, a zagregowany legalny zespół zdalny dodaje 14, łącznie 22. Lokalny kanał wymaga
sprawnych stanowisk i ERP oraz dopuszczonej ścieżki HTTPS. Zdalny wymaga ERP,
sprawnego VPN, aktywnego legalnego tunelu, polityki HTTPS i uprawnienia do ERP.
Niedostępny ERP daje 0; wyłączony VPN przy sprawnej reszcie daje 8.

`obsłużone = min(zaległość + 20, aktualna wydajność)`

`nowa zaległość = poprzednia zaległość + 20 - obsłużone`

Nie ma ujemnej kolejki ani przenoszenia niewykorzystanej wydajności. Bez awarii
firma obsługuje wszystkie 360 zamówień. Po sześciu **początkowych** turach bez VPN
kolejka wynosi 72; po pozostałych dwunastu sprawnych turach wynosi 48, a liczba
obsłużonych zamówień 312. To wyjaśnienie rachunkowe wymagania Sprintu 3, bez
zmiany GDD i parametrów. Test ustawia początkową niedostępność jako fixture;
zlecenie wyłączenia przy starcie działa dopiero o 14:05. Cel to ≤ 40 o 15:30.

24 zdalnych dyspozytorów reprezentuje na razie jeden legalny aktor biznesowy,
testowe konto `dispatch-team` i tunel `B-01`. To agregacja wydajności, nie zalecenie
współdzielenia rzeczywistych kont. Legalny zespół po przywróceniu bramy próbuje
zalogować się z własnym aktualnym poświadczeniem, podlega blokadzie konta i
wymaganiom uwierzytelnienia. Nie omija reguł ani uprawnień. Nie odtwarza S-19.
Pełne modelowanie kont 24 osób oraz dystrybucji nowych haseł jest poza zakresem.

## Topologia, polityka, sesja i uprawnienie

Linia mapy jest kierunkową relacją, a nie regułą dostępu. Dla każdego użycia usługi
silnik sprawdza osobno topologię, oferowany protokół i dostępność usług, decyzję
polityki, aktywną sesję oraz uprawnienie konta do wskazanej usługi/protokołu.
Konto nie otrzymuje dostępu do dowolnej usługi tylko dlatego, że ma sesję VPN.

Reguły mają źródło, cel, protokół, priorytet i decyzję. Pierwsza pasująca reguła
wygrywa; przy remisie rozstrzyga ID; brak reguły oznacza odmowę. Wariant definiuje
R-ERP (VPN → ERP, HTTPS), R-SMB (VPN → FS-01, SMB) i R-LOCAL (stanowiska → ERP,
HTTPS). Dokumentacja tych reguł jest dostępna graczowi od początku. Własne zmiany
są potwierdzane po zakończeniu zadania. Każde użycie istniejącego połączenia jest
ponownie oceniane po zmianie polityki, zgodnie z GDD §6.4. Blokada SMB nie dotyka
HTTPS. Inspektor rozróżnia topologię i aktualną regułę.

Konto ma odrębną tożsamość, stan nowych logowań, wersję poświadczenia i rezerwę
wymagania MFA. Nowa sesja wymaga działającej bramy, usługi tożsamości i relacji
uwierzytelniania, aktywnego konta, aktualnej wersji poświadczenia i spełnionego
wymagania logowania. Pełne wyzwanie MFA nie jest implementowane; wymaganie MFA
powoduje odmowę wydania sesji w tym silniku.

- Blokada logowania konta nie usuwa istniejącego tunelu.
- Reset poświadczenia zmienia wersję dla nowych logowań, pozostawiając istniejące tunele.
- Zakończenie pojedynczej sesji nie blokuje konta i nie zmienia hasła.
- Wyłączenie VPN zamyka wszystkie tunele tej bramy. Włączenie umożliwia nowe uwierzytelnienie.
- Sesja ma początek, termin ważności i status; po wygaśnięciu nie uprawnia do działania.

To jawna semantyka fikcyjnej bramy. Nie modelujemy routingu wszystkich urządzeń,
pełnego AD, stanowego firewalla ani osobnych sesji aplikacyjnych ERP i chmury.
Lokalny kanał biznesowy zakłada istniejące uprawnienia stanowisk do ERP; zdalne
uprawnienia są sprawdzane jawnie. Nie symulujemy odczytu ani kopiowania danych.

## Wiedza gracza i obserwacje

`selectPlayerView` tworzy jawną projekcję, zamiast przekazywać cały stan do paneli.
Jawne źródła to dokumentacja infrastruktury i polityk, bieżący raport operacyjny
usług/procesu, potwierdzenia własnych zadań i ukończony odczyt bramy VPN. Raport
biznesowy jest agregatem; nie ujawnia prywatnych danych kont lub pochodzenia sesji.

`S-19` z konta `magazyn-07` istnieje od 13:58, ale przed badaniem nie trafia do
interfejsu. Lista aktywnych sesji jest migawką z czasem odczytu; zawiera tylko ID,
konto, bramę i czas początku, bez stanu logowania, wersji hasła i etykiety sprawcy.
Zmiany świata nie aktualizują magicznie starego odczytu. Badanie należy ponowić.
Jeżeli brama przestanie działać przed zakończeniem badania, nie powstaje fikcyjna
pusta lista. Historia zgłasza brak nowej obserwacji, zachowując wcześniejszą.

Ukryte pochodzenie S-19 jest zgodne z GDD, ale nie trafia do projekcji ani historii
publicznej. Nie ma modelowanego źródła logów uwierzytelnienia ani sensorów ruchu,
więc komenda pobrania logów jest odrzucana, a warstwa telemetrii pozostaje pusta.
Dziennik operacyjny to potwierdzenia działań i raporty firmy, nie pozorowany SIEM.

## Mapa, testy i granice etapu

Zachowano warstwy, kierunki, legendę, klawiaturę i inspektor Sprintu 2.
Selektory mapy filtrują tylko relacje aktywnej warstwy. Wybór relacji z inspektora
może ją zmienić. `ui/mapLayout.ts` wylicza pozycje z danych stref i zasobów; nie
zawiera identyfikatorów NEXUS. Mapa od razu pokazuje potwierdzony stan operacyjny
VPN z jedynego `SimulationState.world`.

Testy obejmują wszystkie dotychczasowe przypadki oraz bilans i granice czasu,
niezależne kanały dostępu, wersje poświadczeń, walidację i zajętość wykonawców,
priorytety na granicy tury, brak wycieku wiedzy, deterministyczność i reset.
`npm run typecheck` sprawdza również silnik bez typów DOM. `npm run build` najpierw
wykonuje te kontrole. Testy silnika działają w Node, bez emulacji przeglądarki.

Nie ma maszyny przeciwnika, transferu plików, SIEM/SOAR, detekcji, ekonomii,
rozbudowanej kampanii, FastAPI ani trwałych zapisów. GDD v1.0 i oryginalny HTML
pozostają niezmienionymi materiałami referencyjnymi; Sprint 3 realizuje fundament
przyczynowo-skutkowej symulacji, bez implementacji pełnej pierwszej misji.
