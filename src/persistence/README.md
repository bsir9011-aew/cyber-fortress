# Zapis i odczyt

- `gameSaveV7.ts`: aktywna koperta V7 (silnik 13.0.0, nexus-recovery-1), nowe komendy odzyskiwania ERP, zgodny odczyt V1–V6 oraz ścisły replay stanu.
- `resilienceGameStorage.ts`: aktywny adapter UI; zapisuje wyłącznie klucz V7, zachowuje oryginalne bajty V1–V6 do eksportu i nie ukrywa uszkodzonego nowszego zapisu przez fallback.

Historyczne czytniki i adaptery:

- `gameSaveV3.ts`: koperta V3 i ścisłe komendy integralności; zgodny odczyt V1/V2 przez ich dotychczasowy walidator.
- `currentGameStorage.ts`: UI pisze wyłącznie do V3; oryginały V1/V2 pozostają dostępne do eksportu, także przy niezgodnej wersji.

- `gameSave.ts`: FortressSaveV2 dla misji samodzielnej i kampanii; kontrola wersji, struktury i deterministycznego odtworzenia.
- `gameStorage.ts`: nowy klucz V2, leniwy odczyt, ochrona oryginalnych bajtów V1.
- `saveFormat.ts`: zgodny walidator FortressSaveV1 oraz współdzielone walidatory JSON; stary format nie zapisuje nowej kampanii.
- `localStorage.ts`: adapter przeglądarki, historyczny adapter V1 (zachowany dla testów) i niezależna historia 50 prób samodzielnych.
- `attemptHistory.ts`: podsumowania wcześniejszej gry i ich walidacja.
- `fixtures/`: pliki wygenerowane niezmienionym kodem commita Sprintu 6, a nie nowym silnikiem.

`currentGameStorage` i `gameStorage` pozostają historycznymi adapterami V3/V2 dla zgodności i testów.
Nie ma drugiego mechanizmu symulacji, backendu ani sekretów użytkownika.
Kontrakt: [V3](../../docs/game-save-v3.md), [V2](../../docs/game-save-v2.md), [archiwalny V1](../../docs/persistence.md).
