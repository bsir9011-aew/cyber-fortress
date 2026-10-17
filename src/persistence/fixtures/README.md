# Rzeczywiste pliki V1/V2/V3

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

## V2 sprzed poprawki odzyskiwania kont

`sprint7-blocked-v2.json` wygenerowano niezmienionymi źródłami commita
`a51312c` przez `git archive` i stare funkcje `createStrategicSession`,
`applyCampaignSession`, `createGameSave`, `serializeGameSave`. Sekwencja:
cztery godziny przygotowania → misja A → zlecenie blokady `magazyn-07` →
18 tur → centrala → cztery godziny → start legalnego B. Konto jest zablokowane,
S-19 nie powstaje, wersja poświadczenia wynosi 1. Metadane:
2026-10-17T06:00:00.000Z, wyłącznie fikcyjne dane. Test wymaga identycznego
odczytu dawnej migawki, a następnie pozwala wykonać nowe zadanie w tym świecie.

`sprint7-recovery-v2.json` to niezmieniony eksport z Chromium wykonany kodem
poprawki `660ad00`, przed rozpoczęciem Sprintu 8. Obejmuje początek legalnego B
po blokadzie w A, z zadaniem `unblock-account` w toku (tura 0, termin 1).
Metadane eksportu: 2026-10-17T06:34:37.339Z. Test V3 wymaga identycznego
odczytu całej sesji, w tym trwającego zadania i zachowanej blokady. Plik jest
fikcyjnym zapisem gry; nie został wygenerowany silnikiem Sprintu 8.


## V3 sprzed Sprintu 9

Dwa oryginalne eksporty z Chromium wykonano kodem Sprintu 8 (`4511257`, PR #9),
przed utworzeniem gałęzi `feat/resilience-investments`. Skopiowano je bez zmiany
bajtów z zachowanych artefaktów walidacji Sprintu 8:

- `sprint8-headquarters-v3.json`: 2026-10-17T08:13:52.370Z; po Misji 01,
  projekt audytu FS-01 ukończony, cztery godziny rozliczone, przed pierwszą M02.
- `sprint8-restore-pending-v3.json`: 2026-10-17T08:13:53.785Z; M02, FS-1320
  w trakcie odtwarzania, izolowana stacja, badanie lokalne w toku.

Nie generowano ich nowym silnikiem. Test V4 porównuje sesję ze starą migawką
oraz odczytem V3. Chromium sprawdza eksport oryginału bajt w bajt, kontynuację,
import i reload bez automatycznego finansowania/katalogu Etapu II.
