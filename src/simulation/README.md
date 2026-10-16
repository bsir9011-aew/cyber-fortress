# Silnik symulacji

Czyste funkcje TypeScript, niezależne od Reacta, DOM, Node I/O i czasu rzeczywistego.

- `clock.ts`: arytmetyka czasu i koniec okna operacyjnego.
- `access.ts`: topologia, reguły, sesje, uprawnienia i wydanie nowego tunelu.
- `business.ts`: zależności procesu i bilans zamówień.
- `tasks.ts`: czas pracy, role i walidacja przydziału.
- `engine.ts`: deterministyczne przejście stanu na komendę.

Inicjalizacja, reset i publiczna projekcja pozostają w `application`; scenariusz
w `content`, kontrakty w `domain`, a komunikaty interfejsu w `ui`.
Kolejność tury i uproszczenia opisano w `docs/architecture.md`.
