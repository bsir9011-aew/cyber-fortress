# Sprint 6 — zgodność zapisu i web release

Walidacja 16.10.2026 na Node.js 24.19.0, Vite 8.3.4, Vitest 5.0.5 i Chromium.
Punkt wyjścia: `main` 6302082 z PR #6, zawierający Sprint 5. Implementacja jest
na `feat/persistent-operations`, bez zmian silnika, nowych wariantów lub zależności.

## Kontrole automatyczne

| Kontrola                             | Wynik                                            |
| ------------------------------------ | ------------------------------------------------ |
| `npm test`                           | 249/249, 10 plików, bez pominięć i błędów        |
| Zachowane testy poprzednich sprintów | Wszystkie 192 przechodzą, bez zmian ich asercji  |
| Nowe testy persistence               | 57 przypadków                                    |
| `npm run typecheck`                  | PASS, również domain/simulation z ES2022 bez DOM |
| `npm run build`                      | PASS, 67 modułów, poprawna baza Pages            |
| `git diff --check`                   | PASS                                             |

Nowe testy sprawdzają pełne migawki A/B/C od startu po finał, prywatne `null`+w B, przywrócenie administratora w trakcie zmiany, 1200 ujawnionych rekordów
po częściowym transferze, źródła i czasy dowodów, harmonogram, sesje, liczniki
uwierzytelnienia, kolejkę firmy, dziennik zdarzeń, decyzje i ukrytą historię.
Ponowny odczyt i eksport nie przesuwają czasu i nie dodają uwierzytelnienia.

Dla każdego A/B/C test wykonuje identyczną sekwencję: logi, tura, sesje, tura,
rozmowa, tura, hipoteza, tura, zmiana SMB, tura i pozostałe 13 tur. Porównuje
rozgrywkę ciągłą z eksportem/importem po piątej turze. Asercja dotyczy całego
`SimulationState`, dodatkowo raportu, historii, źródeł, wiedzy i przeciwnika.
Wyniki są równe bez wykluczania pól stanu. Daty i ID są poza stanem symulacji.

Walidacja odrzuca brak struktur, ujemne/nadmierne tury, zmienione liczniki,
sesje i konta, brak przeciwnika, nieznany scenariusz, nieprawidłowy seed,
nieobsługiwane wersje, daty i komendy, obce klucze, reset w dzienniku,
nadmiar komend, duży/głęboki plik i klucze prototypu. Tablice nie mogą udawać
tekstowych enumów. Błąd nie mutuje oryginału ani poprawnego lokalnego zapisu.
Adapter ma testy odczytu bez zapisu przy inicjalizacji, braku danych,
SecurityError/QuotaExceededError, limitu historii, deduplikacji, aktualizacji
tego samego ID i zachowania historii podczas powtórki.

## Rzeczywista rozgrywka w Chromium

Testy uruchomiono na produkcyjnym `dist/` serwowanym przez Vite preview
z bazą **`/cyber-fortress/`**. Akcje przechodzą przez widoczne przyciski,
wybór pliku, pobieranie pliku i klawiaturę. Odczyt localStorage służy asercjom;
nie podmieniano świata ani nie wywoływano reducera z konsoli.

Przebieg A:

1. Trening i briefing. Logi ukończone 14:05, odczyt sesji 14:10.
2. Wyłączenie VPN ukończone 14:15, przywrócenie 14:20.
3. Zlecenie dziesięciominutowej odmowy SMB 14:20; przejście do 14:25.
4. Migawka: tura 5, administrator zajęty do tury 6, ukończone badania,
   dowody z dawnymi źródłami/czasami, aktualna prywatna sesja **S-20**,
   **10 zaległych zamówień** i kontekst Operacje.
5. Eksport, odświeżenie i ekran kontynuacji. Instrumentacja adaptera potwierdza
   **zero zapisów przed wznowieniem** oraz identyczną zastaną migawkę i savedAt.
6. Enter na automatycznie wybranej kontynuacji odtwarza 14:25, bez nowej tury,
   powielonej sesji, alertu, badania lub utraty biznesu.
7. Dokończenie do 15:30. Porównanie całego stanu z wcześniejszym przebiegiem
   bez odświeżenia, następnie z zaimportowanym punktem 14:25: **pełna zgodność**.

| Przebieg Chromium                                                  | Ujawnione | Obsłużone | Zaległe |
| ------------------------------------------------------------------ | --------: | --------: | ------: |
| A, ciągły, opisane komendy                                         |         0 |       360 |       0 |
| A, te same komendy, odświeżenie 14:25                              |         0 |       360 |       0 |
| A, import punktu 14:25, jedna tura offline, dalej ten sam przebieg |         0 |       360 |       0 |
| B, kolejny wariant, stała odmowa SMB od 14:10                      |         0 |       296 |      64 |

Historia pokazała trzy odrębne ID (dwa przebiegi A i nowy B), a wznowienie
zaimportowanego ID aktualizowało ten sam wiersz. B miał faktyczne
`hidden.attacker: null`, „Brak potwierdzonej złośliwej aktywności”, ograniczenie
„Nie dotyczy” i wynik „Problem operacyjny”. Brak ataku nie stawał się zwycięstwem
nad przeciwnikiem.

Dodatkowo potwierdzono:

- Uszkodzony JSON i nieobsługiwana wersja pozostawiają sesję i localStorage
  nietknięte. Anulowanie poprawnego importu także zachowuje bieżącą próbę.
- Kontekst, warstwa i wybrany zasób mapy wracają po odświeżeniu. Czytanie dowodów
  i powrót z historii nie zmieniają symulacji.
- Zmiana na offline po załadowaniu zasobów pozwala wykonać kolejną turę i zapis.
- Prawdziwy rzucający getter `window.localStorage` (SecurityError): gra dochodzi
  do tury 18, eksport działa, historia bieżącej karty zachowuje wynik i ostrzega
  o braku utrwalenia.
- Rzucające `setItem` (QuotaExceededError): po wznowieniu tury 5 i przejściu do
  tury 6 poprzedni zapis pozostaje bez zmian, a eksport zawiera aktualną turę 6.
- Uszkodzone zapisy startowe nie są nadpisywane renderem. Historia pozostaje
  nietknięta do wyczyszczenia. Czyszczenie w trakcie próby pozwala zachować jej
  przyszły finał; czyszczenie po finale pozostaje skuteczne po odświeżeniu.
- Laptop **1366 × 950** oraz **375 × 812**: brak poziomego przepełnienia strony
  w Sprawach, Operacjach, Architekturze, raporcie i historii. Mapa i tabela
  porównawcza mają własne przewijanie.
- Klawiatura: Enter na kontynuacji i zasobie mapy, widoczny focus, skupienie
  nagłówka historii, przewijanie regionu tabeli. Tekst zadania w prawym panelu
  ma zmierzone **13 px**, a aktywna praca wyróżnienie.
- **0 błędów konsoli/pageerror i 0 nieudanych odpowiedzi zasobów** w głównym
  przebiegu produkcyjnym. Osobne testy błędów storage także bez pageerror.

Zrzuty: [wznowienie](screenshots/persistence-01-resume.png),
[historia](screenshots/persistence-02-history.png),
[historia 375 px](screenshots/persistence-03-history-mobile.png).
Skrypty i surowe wyniki tej sesji są w `/workspace/scratch/persistence-*`;
nie stanowią zależności aplikacji ani elementu publikowanego `dist/`.

## Pliki dostarczone

Nowe: `src/application/operationSession.ts`; `src/persistence/saveFormat.ts`,
`localStorage.ts`, `attemptHistory.ts`, `saveFormat.test.ts`;
`src/ui/usePersistentOperations.ts`, `PersistenceToolbar.tsx`, `AttemptHistory.tsx`,
`persistence.css`; `.github/workflows/pages.yml`; `docs/persistence.md`,
`persistence-validation.md`, `github-pages.md` i trzy zrzuty
`docs/screenshots/persistence-01-resume.png`, `persistence-02-history.png`,
`persistence-03-history-mobile.png`.

Zmodyfikowane: `src/ui/App.tsx`, `ScenarioSelection.tsx`, `vite.config.ts`,
`.github/workflows/ci.yml`, `README.md`, `docs/architecture.md`,
`src/persistence/README.md`. LICENSE, .gitignore, GDD, prototyp, manifest,
lockfile, definicje scenariuszy, silnik i poprzednie testy pozostają bez zmian.

## Publikacja i granice dowodu

Dev na porcie 5173 nadal zwraca HTML z `/src/main.tsx`. Produkcyjne HTML używa
`/cyber-fortress/assets/...` i `/cyber-fortress/favicon.svg`. `dist/` zawiera tylko
HTML, ikonę, CSS i JavaScript. Workflow Pages jest odrębny od CI PR i ma bramkę
`main` oraz zależność wdrożenia od pozytywnych testów/builda.

Repozytorium nie miało włączonego Pages (`has_pages: false`, API Pages 404).
**Nie wykonano publicznego deploymentu ani merge.** Udany preview nie dowodzi
działania publicznej domeny. Wymagana konfiguracja i kontrola po zatwierdzeniu:
[instrukcja GitHub Pages](github-pages.md).

Obsługujemy zgodny V1, bez automatycznych migracji, synchronizacji kart/urządzeń
i gwarancji startu offline po nowym otwarciu strony. Jeden aktywny zapis, 2 MiB,
2048 komend i 50 podsumowań są jawnymi limitami. Nie dodano mechanik ataku,
backendu, sekretów API, nowych bibliotek, kampanii ani gałęzi powtórek.
Testy techniczne nie zastępują obserwacji grywalności z ludźmi.
