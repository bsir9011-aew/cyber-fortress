# Detection Engineering (Sprint 11)

W Centrali po wdrożeniu Endpoint EDR można zlecić zmianę reguły **Unusual
Document Modification Activity**: próg 2–30 dokumentów, ruchome okno 5/10/20
minut (domyślnie 10/10). Zadanie zajmuje analityka przez jedną godzinę
przygotowania, bez opłaty. Reguła działa po rozliczeniu godziny; dziedziczy
się przez `SecurityPosture.endpointCoverage`. Zmiana nie przelicza
poprzednich misji ani alertów. Wdrożenie, konfiguracja i czas pracy są osobnymi decyzjami.

Reguła liczy **unikalne ID dokumentów**, nie rekordy ani sumę powtórnych
zapisów. Bierze wyłącznie dopuszczone operacje SMB `modify` na objętej
sensorem stacji, z dostarczonych rekordów, po opóźnieniu, w retencji.
Okno źródłowe jest domknięte `[teraz − okno, teraz]`; przy opóźnieniu 5 min
krótkie okno pozostawia mniej dostępnych danych. Ciągła seria daje jeden
alert; kolejna może dać nowy po przerwie aktywności dłuższej niż okno.
Pierwotne rekordy wyzwalające alert pozostają niezmienne, a osobny kursor
serii służy wyłącznie deduplikacji. Alert to sygnał do badania.

**Misja 02 — Nieznany przypadek** wymaga ukończonej M01 i rozliczonego okna,
lecz nie wymaga EDR. Komenda `start-detection-incident` wymaga jawnego
`familyId: nexus-integrity-detection-v1`. Wybór to FNV-1a identyfikatora
rodziny plus seed modulo 3 (bez zmiany katalogu M01):

- A: istniejący referencyjny przebieg integralności, ze wspólnym briefingiem.
- B: legalne partie po 12 dokumentów w turach 1, 2, 9, 10, 17. Prawdziwy
  dostęp SMB `modify`, nowa generacja dokumentu, poprawność zachowana.
  Rozszerzona praca tej stacji wnosi 4 z 8 lokalnych jednostek wydajności;
  niepotrzebna izolacja może obniżyć całość z 22 do 18 zamówień/turę i tworzyć zaległości.
- C: przejęty lokalny kontekst modyfikuje po 2 dokumenty w turach 2, 4, …, 18.
  Wysoki próg może pominąć uszkodzenia. Obowiązują te same uprawnienia,
  ścieżka, izolacja i ograniczenie zapisu; brak magicznego omijania sensora.

Wspólny briefing nie ujawnia przyczyny. Bez sensora pozostają lokalny dziennik,
porównanie z ERP i dotychczasowe operacje. Alert sam nie obniża wydajności:
czas dochodzenia zajmuje analityka, a izolacja odcina faktyczną pracę.

Po 18. turze przegląd detekcji pokazuje źródłowe operacje, alerty legalnej
aktywności (FP), alerty szkodliwej aktywności i dopuszczone szkodliwe operacje
niewykryte przez regułę (FN). Kontynuacje wykrytej serii są rozróżniane od
zdarzeń wyzwalających alert i nie są osobnymi FN. Operacje poza pokryciem
lub niedostarczone do końca misji są pokazywane osobno od FN reguły. Nie jest to uniwersalny pomiar
skuteczności EDR. Raport pokazuje czasy pozyskania dowodów, reakcje i bilans
biznesowy; nie wystawia ocen ani nie zakłada, że gracz przeczytał alert.

AAR V1 zachowuje dotychczasowe pola; generator 1.1 dodaje opcjonalne
`campaignContext.detectionChanges` i `securityConsequences.detectionReview`.
JSON i Markdown zawierają konfigurację na starcie, pracę w Centrali, źródła,
klasyfikację po misji i skutki. Wiedza przed decyzją pozostaje oddzielona od
później ujawnionej prawdy. Starsze AAR nadal powstają bez nowych pól.

## Zapis V5

Aktywny zapis: `FortressSaveV5`, `schemaVersion: 5`, `engineVersion: 11.0.0`,
`contentVersion: nexus-detection-1`, klucz `fortress-lab.game.v5`.
Nowe komendy są ściśle walidowane, a pełny command journal odtwarzany tym
samym reduktorem. Podmiana migawki lub parametrów bez zgodnego dziennika
powoduje odrzucenie pliku. Limity 8 MiB / 10 000 komend pozostają bez zmian.

Odczyt: V5 → V4 → V3 → V2 → V1. Istniejące walidatory V1–V4 i oryginalne
pliki pozostają; nie przyznajemy inwestycji ani konfiguracji przy imporcie.
Adapter zachowuje stare klucze i udostępnia eksport oryginalnych bajtów.
Uszkodzony nowszy zapis nie uruchamia cichego cofnięcia do starszego.
Samo otwarcie aplikacji nie zapisuje migracji; kontynuacja zapisuje do V5.

Historyczna komenda `start-integrity-incident` nadal wybiera referencyjną M02.
Bez nowej konfiguracji zachowuje oryginalny detektor V4 (suma wystąpień i
jeden alert na endpoint); nowa rodzina jawnie aktywuje liczenie unikalnych ID
i ponowne uzbrojenie. Dzięki temu starsze migawki, seedy i AAR pozostają zgodne.
