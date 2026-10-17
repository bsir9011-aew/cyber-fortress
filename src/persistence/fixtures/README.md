# Rzeczywiste pliki Sprintu 6

Pliki wygenerowano niezmienionym kodem commita
`d1c3d56e9293f78ac6cadeef4339b8e699341508` (PR #7, scalony na main).
Źródła odczytano przez `git archive`, bez nowego worktree i bez modyfikacji
obecnego drzewa. Jednorazowy generator użył starych `createOperationSession`,
`applyOperationCommand`, `createSave` i `serializeSave`.

- `sprint6-active-v1.json`: trening, 14:25; logi 14:05, sesje 14:10,
  SMB zlecone 14:20 i w trakcie realizacji; 1200 ujawnionych rekordów;
  kontekst Operacje, briefing zakończony.
- `sprint6-legal-v1.json`: seed 1, wariant bez przeciwnika po 18 turach.

Metadane obu plików: 2026-10-16T12:00:00.000Z, wyłącznie fikcyjne dane gry.
Nie poprawiamy ich razem z nową wersją silnika. Test aktualizacji musi porównać
stary stan ze zweryfikowaną migawką V2 i zachować bajty starego klucza.
