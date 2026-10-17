# Prawdziwe przykłady Fortress AAR V1

Pliki utworzono przez `playAarScenario` z `src/testSupport/aar.ts`, istniejące
reducery i `createAfterActionReport`. Nie są ręcznie napisanymi historiami ani
zapisami gry. JSON i Markdown każdego przykładu mają te same ID i metadane.
Testy porównują zawartość JSON z ponownie wygenerowanymi faktami. Trzy JSON-y
zweryfikowano także standardowym walidatorem JSON Schema 2020-12.

| Przykład | Faktyczny przebieg | Rezultat |
| --- | --- | --- |
| [Porażka M01 — JSON](01-m01-failure.json) / [Markdown](01-m01-failure.md) | 14:00 blokada magazyn-07; później logi i sesje; brak zakończenia tunelu lub reguły SMB | 2000 rekordów; 360 zamówień; aktywny dostęp pozostaje. Wczesna blokada nie miała późniejszych logów jako wiedzy |
| [Sukces z kosztem biznesowym — JSON](02-m01-success-business-cost.json) / [Markdown](02-m01-success-business-cost.md) | VPN off gotowe 14:05; SMB deny gotowe 14:15; VPN on gotowe 14:20 | Wszystkie cele spełnione, 0 rekordów; 352 zamówienia, 8 zaległych, szczyt kolejki 36. Legalny biznes miał przestój mimo sukcesu |
| [Częściowa reakcja M02 — JSON](03-m02-isolation-without-recovery.json) / [Markdown](03-m02-isolation-without-recovery.md) | Po pierwszej M01 start M02; izolacja gotowa 14:05, brak restore | Źródło nie może dalej zapisywać; 12 dokumentów nadal uszkodzonych, 326 zamówień, 34 zaległe. Ograniczenie działa, odzyskania nie potwierdzono |

Seed samodzielnych przykładów M01: 0. M02 jest właściwie odtworzona w kampanii,
po pierwszej misji i przygotowaniu, nie z pustego domyślnego świata.

RPO/RTO mają zastosowanie tylko tam, gdzie rzeczywiście wykonano odtworzenie
lub potwierdzono odzyskanie. Brak takiego pomiaru pozostaje null, nie zero.

Zastosowanie: dołącz JSON w rozmowie, wklej instrukcję z gry i poproś o ocenę
każdej decyzji na podstawie ówczesnej wiedzy. Późniejsza prawda nie może być
przypisana wstecz. Raporty zawierają wyłącznie fikcyjne dane NEXUS Logistics.
