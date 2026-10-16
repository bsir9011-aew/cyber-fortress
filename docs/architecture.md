# Architektura FORTRESS LAB — Sprint 2

Jeden projekt React + TypeScript + Vite. Bez backendu, routera, biblioteki stanu
i frameworka grafowego. Interaktywna mapa korzysta z natywnego SVG.

| Katalog           | Odpowiedzialność                                              |
| ----------------- | ------------------------------------------------------------- |
| `src/domain`      | Typy zasobów, relacji i stanu świata; bez Reacta i DOM.       |
| `src/simulation`  | Przyszłe czyste funkcje silnika, zależne od domeny.           |
| `src/application` | Inicjalizacja świata i czyste selektory warstw oraz powiązań. |
| `src/content`     | Dane organizacji i scenariusz infrastruktury NEXUS Logistics. |
| `src/ui`          | Komponenty React, układ przestrzenny, style i mapa SVG.       |
| `src/persistence` | Przyszłe adaptery zapisu i migracje.                          |
| `docs`            | Dokumentacja i referencyjny GDD v1.0.                         |
| `prototype`       | Archiwalny prototyp HTML 0.1, poza aplikacją Vite.            |

`ui` może korzystać z `application` i `content`. `application` łączy domenę,
treści i przyszłą symulację. `domain` nie zależy od pozostałych modułów.
Symulacja nie importuje UI ani API przeglądarki; testy uruchamiamy w Node.
Nie twórz osobnych pakietów ani uniwersalnych abstrakcji bez konkretnej potrzeby.

## Minimalny kontrakt świata

`InfrastructureAsset` opisuje identyfikator, rodzaj, strefę, właściciela,
dostępność, oferowane protokoły, opis funkcji i opcjonalną rolę biznesową.
`online` nie oznacza „bezpieczny”.

`InfrastructureConnection` jest skierowaną relacją między identyfikatorami zasobów.
Rozróżnia sieć, uwierzytelnienie, uprawnienia, zależność biznesową i obserwację.
Zawiera etykietę, znaczenie i opcjonalny protokół. Nie jest regułą firewalla ani
dowodem uprawnienia do komunikacji. Rozstrzyganie dostępu dojdzie z silnikiem.
Kierunek relacji biznesowej prowadzi od zasobu wspierającego pracownika do usługi,
od której zależy jego praca. Nie opisuje trasy pakietów.

`WorldState` zawiera identyfikator organizacji, strefy, właścicieli, zasoby i relacje.
`createInitialWorld` głęboko kopiuje scenariusz z `content/nexusInfrastructure.ts`:
9 zasobów, 5 stref i 11 relacji. Nowe światy nie współdzielą encji ani kolekcji.
Typy `readonly` chronią
kontrakt na poziomie TypeScript; nie stanowią walidacji danych w czasie wykonania.
Integralność treści, typy relacji i referencje sprawdzają testy. Walidacja dowolnych
danych zewnętrznych i format zapisu powstaną wraz z ich importem.

## Warstwy i interakcje

`application/infrastructureSelectors.ts` definiuje jedyne przypisanie rodzajów
relacji do warstw. Sieć zawiera `network`, tożsamość `authentication` oraz
`authorization`, biznes `business-dependency`, telemetria `observation`.
Scenariusz nie definiuje uprawnień ani sensorów, więc nie ma relacji
`authorization` i `observation`. Warstwa telemetrii pokazuje jawny pusty stan.

Węzły i strefy pozostają widoczne we wszystkich warstwach. Podświetlenie sąsiadów
dotyczy wyłącznie aktywnej warstwy. Inspektor zasobu pokazuje wszystkie jego
relacje i może otworzyć relację z innej warstwy. Zmiana warstwy zachowuje wybrany
zasób, lecz usuwa wybór relacji, która ma zniknąć. Wybrana relacja wyróżnia oba
końce. Kliknięcia nie zmieniają faktów świata.

`ui/mapLayout.ts` oblicza pozycje na podstawie stref i kolejności zasobów.
Nie zawiera identyfikatorów NEXUS ani drugiej listy zasobów i połączeń.
Geometria nie jest regułą domeny. React przechowuje tylko stan widoku: warstwę
i wybór `{ kind, id }`; nie ma drugiej kopii relacji w komponentach.

Scenariusz zawiera jawne dane infrastruktury, bez ukrytych faktów o napastniku,
lukach, MFA czy pokryciu monitoringu. Przyszły model wiedzy gracza i sensory nie
mogą otrzymać automatycznie wszystkich faktów pełnego świata.

Nie dodajemy jeszcze zegara, reguł dostępu, aktorów, incydentów ani trwałego zapisu.
Przyszła wiedza gracza powinna pozostać oddzielona od pełnego stanu świata.

## Materiały projektowe i granica etapu

[GDD v1.0](FORTRESS_LAB_GDD_v1.0.md) jest materiałem do kolejnych etapów,
a nie specyfikacją funkcji już dostępnych. Jego zakres „Prototype 0.2” opisuje
pierwszą misję. Sprint 2 realizuje wyłącznie **Living Infrastructure**:
eksplorację topologii i zależności. Implementacja misji wymaga osobnej decyzji.

Oryginalny prototyp 0.1 zachowano bez zmian w `prototype/`. Nie importujemy jego
skryptów do aplikacji ani nie kopiujemy logiki gry do komponentów Reacta.
