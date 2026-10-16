# Silnik symulacji

Czyste funkcje TypeScript, niezależne od Reacta, DOM, Node I/O i czasu rzeczywistego.

- `clock.ts`: arytmetyka czasu i koniec okna operacyjnego.
- `access.ts`: topologia, reguły, sesje, uprawnienia i wydanie nowego tunelu.
- `business.ts`: zależności procesu i bilans zamówień.
- `tasks.ts`: czas pracy, role i walidacja przydziału.
- `engine.ts`: deterministyczne przejście stanu na komendę.
- `attacker.ts`: planer z ograniczoną wiedzą i prywatne rozstrzyganie prób dostępu/transferu.
- `telemetry.ts`: źródłowe zdarzenia uwierzytelnienia, kolekcja, retencja, dostępność i detekcja.
- `narrative.ts`: wiadomości wynikające z jawnych faktów, bez dostępu do prywatnej prawdy.
- `threatAssessment.ts`: prywatny ślad decyzji i ocena rzeczywistych możliwości do raportu.

Inicjalizacja, reset, publiczna projekcja i bramka raportu pozostają w `application`;
scenariusz i wypowiedzi postaci w `content`, kontrakty w `domain`, prezentacja w `ui`.
Kolejność tury i uproszczenia opisano w `docs/architecture.md`.
