# Zapis i odczyt — Sprint 7

- `gameSave.ts`: FortressSaveV2 dla misji samodzielnej i kampanii; kontrola wersji, struktury i deterministycznego odtworzenia.
- `gameStorage.ts`: nowy klucz V2, leniwy odczyt, ochrona oryginalnych bajtów V1.
- `saveFormat.ts`: zgodny walidator FortressSaveV1 oraz współdzielone walidatory JSON; stary format nie zapisuje nowej kampanii.
- `localStorage.ts`: adapter przeglądarki, historyczny adapter V1 (zachowany dla testów) i niezależna historia 50 prób samodzielnych.
- `attemptHistory.ts`: podsumowania wcześniejszej gry i ich walidacja.
- `fixtures/`: pliki wygenerowane niezmienionym kodem commita Sprintu 6, a nie nowym silnikiem.

Nowy interfejs używa wyłącznie `gameStorage` do zapisu gry. Nie usuwa i nie aktualizuje klucza V1.
Nie ma drugiego mechanizmu symulacji, backendu ani sekretów użytkownika.
Kontrakt: [V2](../../docs/game-save-v2.md), [archiwalny V1](../../docs/persistence.md).
