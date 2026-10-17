# Zapis i odczyt — Sprint 8

- `gameSaveV3.ts`: aktualna koperta V3 i ścisłe komendy integralności; zgodny odczyt V1/V2 przez ich dotychczasowy walidator.
- `currentGameStorage.ts`: UI pisze wyłącznie do V3; oryginały V1/V2 pozostają dostępne do eksportu, także przy niezgodnej wersji.

- `gameSave.ts`: FortressSaveV2 dla misji samodzielnej i kampanii; kontrola wersji, struktury i deterministycznego odtworzenia.
- `gameStorage.ts`: nowy klucz V2, leniwy odczyt, ochrona oryginalnych bajtów V1.
- `saveFormat.ts`: zgodny walidator FortressSaveV1 oraz współdzielone walidatory JSON; stary format nie zapisuje nowej kampanii.
- `localStorage.ts`: adapter przeglądarki, historyczny adapter V1 (zachowany dla testów) i niezależna historia 50 prób samodzielnych.
- `attemptHistory.ts`: podsumowania wcześniejszej gry i ich walidacja.
- `fixtures/`: pliki wygenerowane niezmienionym kodem commita Sprintu 6, a nie nowym silnikiem.

Aktualny interfejs używa wyłącznie `currentGameStorage` do zapisu gry. Nie usuwa i nie aktualizuje kluczy V1/V2. `gameStorage` pozostaje historycznym adapterem V2 dla zgodności i testów.
Nie ma drugiego mechanizmu symulacji, backendu ani sekretów użytkownika.
Kontrakt: [V3](../../docs/game-save-v3.md), [V2](../../docs/game-save-v2.md), [archiwalny V1](../../docs/persistence.md).
