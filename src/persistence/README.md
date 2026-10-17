# Zapis i odczyt — Sprint 6

- `saveFormat.ts`: FortressSaveV1, kontrola wersji i limitów, walidacja pełnej migawki przez istniejący reducer.
- `localStorage.ts`: adapter bieżącego zapisu i historii, bezpieczne wyniki błędów pamięci.
- `attemptHistory.ts`: podsumowanie istniejącego raportu, maksymalnie 50 unikalnych prób i walidacja historii.
- `saveFormat.test.ts`: zgodność ciągłej/wznawianej rozgrywki, niezaufane pliki i błędy pamięci.

Nie ma drugiego mechanizmu symulacji, backendu ani sekretów użytkownika.
Pełny kontrakt: [docs/persistence.md](../../docs/persistence.md).
