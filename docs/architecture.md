# Architektura bootstrapu 0.2

Jeden projekt React + TypeScript + Vite. Bez backendu, routera, biblioteki stanu
i frameworka grafowego. Mapa będzie korzystać z natywnego SVG.

| Katalog | Odpowiedzialność |
| --- | --- |
| `src/domain` | Typy zasobów, relacji i stanu świata; bez Reacta i DOM. |
| `src/simulation` | Przyszłe czyste funkcje silnika, zależne od domeny. |
| `src/application` | Inicjalizacja świata; później komendy i selektory. |
| `src/content` | Dane organizacji; później definicje scenariuszy. |
| `src/ui` | Komponenty React, style i przyszła mapa SVG. |
| `src/persistence` | Przyszłe adaptery zapisu i migracje. |
| `docs` | Dokumentacja i referencyjny GDD v1.0. |
| `prototype` | Archiwalny prototyp HTML 0.1, poza aplikacją Vite. |

`ui` może korzystać z `application` i `content`. `application` łączy domenę,
treści i przyszłą symulację. `domain` nie zależy od pozostałych modułów.
Symulacja nie importuje UI ani API przeglądarki; testy uruchamiamy w Node.
Nie twórz osobnych pakietów ani uniwersalnych abstrakcji bez konkretnej potrzeby.

## Minimalny kontrakt świata

`InfrastructureAsset` opisuje identyfikator, rodzaj, strefę, właściciela,
dostępność i oferowane protokoły. `online` nie oznacza „bezpieczny”.

`InfrastructureConnection` jest skierowaną relacją między identyfikatorami zasobów.
Rozróżnia sieć, uwierzytelnienie, uprawnienia, zależność biznesową i obserwację.
Nie jest regułą firewalla ani dowodem uprawnienia do komunikacji.
Protokoły konkretnego przepływu i rozstrzyganie dostępu dojdą z silnikiem.

`WorldState` zawiera identyfikator organizacji, zasoby i relacje. Inicjalizacja
tworzy nowy, pusty świat, bez danych pierwszej misji. Typy `readonly` chronią
kontrakt na poziomie TypeScript; nie stanowią walidacji danych w czasie wykonania.
Walidacja referencji i format zapisu zostaną dodane wraz z ładowaniem scenariusza.

Nie dodajemy jeszcze zegara, reguł dostępu, aktorów, incydentów ani trwałego zapisu.
Przyszła wiedza gracza powinna pozostać oddzielona od pełnego stanu świata.

## Materiały projektowe i granica etapu

[GDD v1.0](FORTRESS_LAB_GDD_v1.0.md) jest materiałem do kolejnych etapów,
a nie specyfikacją funkcji już dostępnych. Jego zakres „Prototype 0.2” opisuje
pierwszą misję. Ten PR realizuje wyłącznie **Bootstrap projektu 0.2** zgodnie
z bieżącym zadaniem; implementacja misji wymaga osobnej decyzji.

Oryginalny prototyp 0.1 zachowano bez zmian w `prototype/`. Nie importujemy jego
skryptów do aplikacji ani nie kopiujemy logiki gry do komponentów Reacta.
