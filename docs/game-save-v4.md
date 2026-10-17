# FortressSaveV4 — zgodność V1–V4

Aktywny UI używa `gameSaveV4.ts` i `resilienceGameStorage.ts`:

```json
{
  "schemaVersion": 4,
  "engineVersion": "9.0.0",
  "contentVersion": "nexus-resilience-1",
  "savedAt": "2026-10-17T12:00:00.000Z",
  "session": "GameSession (pełny obiekt)"
}
```

`GameSession` zachowuje pełen świat, metadane, UI i historię komend. Dodaje
jawne finansowanie, opcjonalne przygotowanie EDR/backup oraz telemetrię nowego
incydentu. Limit pliku pozostaje 8 MiB, limity historii i struktury JSON są
współdzielone z istniejącymi formatami.

| Format | Klucz | Obsługa przez aktualny UI |
| --- | --- | --- |
| V1 | `fortress-lab.save.v1` | Historyczny odczyt/replay, eksport oryginalnych bajtów |
| V2 | `fortress-lab.game.v2` | Historyczny odczyt/replay, eksport oryginalnych bajtów |
| V3 | `fortress-lab.game.v3` | Historyczny odczyt/replay, eksport oryginalnych bajtów |
| V4 | `fortress-lab.game.v4` | Nowy zapis, odczyt i eksport; pełny replay z nowymi komendami |

Adapter wybiera najnowszy **obecny** klucz:
V4 → V3 → V2 → V1. Uszkodzony nowszy plik nie powoduje cichego odtworzenia
starszej kampanii. Oryginalne bajty pozostają dostępne do eksportu także przy
błędzie walidacji. Historia samodzielnych prób ma nadal osobny klucz.

Sam start aplikacji odczytuje pamięć, lecz nie zapisuje migracji. Dopiero
kontynuowanie/komenda/import aktywują zapis do V4. Nowa gra również zmienia
wyłącznie V4. Oryginalne trzy klucze nie są nadpisywane ani usuwane. Wybór
starszego pliku do importu wymaga istniejącego potwierdzenia zastąpienia
aktywnej gry; anulowanie i błędny plik pozostawiają ją bez zmian.

## Semantyka replay

V1/V2/V3 zachowują dotychczasowe walidatory i wersje silnika/treści. V4 deleguje
ich odczyt do historycznego `readCurrentGameSave` V3, które korzysta z V1/V2.
Zgodna sesja przechodzi do nowej koperty **bez zmiany świata**. Nie przyznajemy
transzy i nie rozszerzamy katalogu przy imporcie.

Wspólne `createCampaign()` nadal zaczyna z trzema projektami i pulą 80 000 zł.
Nowe D/E i 25 000 zł powstają wyłącznie przez komendę finansowania. Opcjonalne
pola sensorów i gotowości są nieobecne w starych światach. Wspólny silnik ma
nowe ścieżki tylko po jawnej instalacji. To zachowuje historyczne migawki oraz
znaczenie dawnych komend, mimo współdzielenia implementacji.

V4 poszerza allowlistę o `accept-resilience-funding`, operacje na dwóch nowych
ProjectId oraz analityczne `inspect-edr-telemetry`. Nie dopuszcza kwoty z
zewnątrz, dodatkowych pól ani dowolnego wykonawcy tego badania. V3 nadal
odrzuca te komendy. Walidacja odtwarza historię i porównuje cały wynik: budżet,
alokacje, projekty, pozostałą pracę, polityki, sensor, źródła, obserwacje i
zadania w toku. Podmiana gotowości, bezpłatne wdrożenie czy powielona transza
bez zgodnej historii są odrzucane.

To kontrola spójności lokalnego zapisu, nie podpis ani zabezpieczenie przed
użytkownikiem celowo konstruującym inną poprawną kampanię. Pełny eksport
zawiera również fikcyjną prywatną prawdę incydentu.

## Rzeczywiste fixture'y i walidacja

Zachowano dwa oryginalne V1 i dwa V2, a dodano dwa niezmienione eksporty V3
pochodzące z Chromium Sprintu 8, sprzed implementacji Sprintu 9:

- `sprint8-headquarters-v3.json`: przed startem Misji 02;
- `sprint8-restore-pending-v3.json`: restore FS-1320 w toku.

[Proweniencja plików](../src/persistence/fixtures/README.md).
Testy porównują dokładne sesje, nie samo powodzenie parsowania. V4 testuje
również zapis pracy częściowej, aktywne badanie EDR, aktywny restore po teście
backup, identyczne dalsze tury, ponowny import, manipulacje alokacją i
brak/quota localStorage. Chromium potwierdza oryginalny eksport V3 bajt w bajt,
brak transzy po migracji, import i ponowne uruchomienie.
