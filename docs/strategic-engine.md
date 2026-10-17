# Semantyka silnika — Sprint 7

## Uwierzytelnianie przez materiał i politykę

`SessionRequest.secondFactorVersion?` jest abstrakcją przedstawionego składnika;
`Account.secondFactorVersion?` reprezentuje jego zarejestrowaną wersję.
To nie są prawdziwe hasła, tokeny, TOTP ani operacje kryptograficzne.

`issueVpnSession` sprawdza referencje/usługi, stan konta, wersję hasła i wymóg MFA.
Przy `mfaPolicy: required` brak lub niezgodność zarejestrowanego składnika
powoduje odmowę `mfa-required`. Prawidłowy składnik pozwala wydać sesję.
Resolver nie przyjmuje `hidden`, pochodzenia sesji ani klasy aktora.

Legalne profile w ukończonym wdrożeniu A otrzymują własny modelowany składnik;
przedstawiają go także przy ponownym logowaniu po przerwaniu VPN. Przeciwnik
nie dostaje tego materiału — nadal używa tylko znanej wersji hasła. Nawet blokada
lub wymóg MFA nie kończy wcześniej wydanego tunelu; uprawnienia/reguły mogą
osobno odebrać jego użycie. Stare wywołania bez składnika i bez wymogu MFA
zachowują wcześniejsze zachowanie.

## Inicjalizacja po przygotowaniu

Bez aktywnych zmian strategicznych `createCampaignIncident` zwraca fabrykę
bazowego wariantu, co test porównuje pole po polu. Przy zmianach:

1. Nakłada dostępność, stany kont, politykę MFA, porządkowanie nadmiarowych
   uprawnień i reguły kont z trwałej konfiguracji.
2. Zamienia opisane początkowe logowania w uporządkowane żądania z materiałem
   danej konfiguracji/klienta i rozstrzyga je przez `issueVpnSession`.
3. Rejestruje rzeczywiste odmowy/sukcesy, zachowując ID sesji tylko po sukcesie.
4. Przekazuje sprawdzoną konfigurację do istniejącego `createScenario`.

To składanie danych i uruchomienie istniejących usług, bez drugiego silnika.
Pochodzenie sesji jest zapisywane **po** decyzji, nie służy obejściu MFA.
Definicja scenariusza i jego typ pozostają ustalone przed decyzjami incydentu.

Jeżeli S-19 o 13:58 nie został wydany, nie istnieje ani w access, ani jako
fikcyjny sukces w źródle. Plan przeciwnika zaczyna wtedy od nowej próby
uwierzytelnienia w turze 1. Historyczna odmowa przed startem jest w źródle VPN;
budżet trzech kolejnych niepowodzeń planera dotyczy późniejszych tur.
W A po MFA daje to jedną odmowę historyczną i trzy późniejsze. C rozpoczyna
pierwszą próbę w turze 3, więc ma trzy późniejsze odmowy. B nie ma przeciwnika.

Materiały legalnych klientów respektują wcześniejsze polityki `managed-current`
i `fixed`. Zachowana ręczna zmiana wersji konta może odrzucić stary klient fixed;
nie przekazujemy mu nowego hasła bez modelowanego powodu. Brak dostępnego VPN
nie tworzy lokalnych logów ani nowego początkowego sygnału w briefingu.

## Reguły podmiotowe

`NetworkRule.accountIds?` ogranicza regułę do konta sesji.
`NetworkFlow.accountId?` przenosi ten podmiot z `canUseService`.
Brak zakresu zachowuje stare reguły; pusta lista nie dopasowuje żadnego konta.

1. Obowiązuje topologia, protokół i dostępność źródła/celu.
2. Reguły sortuje rosnący priorytet, a przy remisie stabilne ID.
3. Pierwsza reguła zgodna z przepływem **i zakresem** wygrywa; brak oznacza odmowę.
4. Dalej trzeba mieć aktywną własną sesję i uprawnienie do usługi.

C dodaje `SEG-ERP-WORK`/`SEG-ERP-DENY` i
`SEG-SMB-DOCUMENTS`/`SEG-SMB-DENY`, z priorytetami 1 i 2. Zachowane reguły
R-ERP/R-SMB/R-LOCAL mają późniejsze priorytety; lokalny HTTPS nie jest ruchem VPN.
Ręczna zmiana szerokiej R-SMB nie omija wcześniejszej reguły SEG — UI opisuje to
przy zleceniu. Każde użycie istniejącej sesji sprawdza aktualną politykę.

Dozwolony `magazyn-07` obejmuje dowolnego posiadacza jego sesji. Żaden warunek
nie brzmi „jeżeli napastnik, odmów”. Zmiana ukrytej klasyfikacji tej samej próby
nie zmienia decyzji dostępu. ERP i dokumenty są sprawdzane osobno, więc odmowa
SMB może zostawić HTTPS, ale odebrać rzeczywiste 6 zamówień części procesu.

## FS-01: źródło, kolektor i wiedza

Opcjonalne `TelemetryState.fileAudit` rozszerza ten sam model telemetryczny.
Bez B pole nie jest dodawane do bazowego stanu, źródło/dowód nie istnieje.

Źródło zawiera wyłącznie:

- stabilne ID oraz czas świata;
- konto, sesję i cel, które zna serwer;
- `list`, `open` albo `read`;
- `allowed`/`denied` z rzeczywistego mechanizmu dostępu;
- `recordsRead`, gdy udany odczyt daje pomiar; w pozostałych przypadkach `null`.

Resolver usługi wylicza wynik, a ten sam wolumen zasila kopiowanie i jego pomiar.
Nie przepisuje prywatnej historii. Przechwycenie `sessionOrigins`, zmiana
obecności przeciwnika czy etykiety klasy nie daje źródłu dodatkowej wiedzy.
Żądanie odrzucone wcześniej przez sieć lub bez aktywnego tunelu nie dociera do
serwera. Docierająca odmowa uprawnienia może zostać zarejestrowana. Sensor nie
obejmuje innych hostów/protokołów ani operacji, których nie modelujemy.

Legalna część dokumentów także podejmuje raz na przedział próbę odczytu własną
sesją, odpowiadającą jej modelowanemu zakresowi pracy. W obecnych danych czyta
6 rekordów dokumentów; nie są to „wykradzione rekordy” i nie muszą odpowiadać
liczbie faktycznie zakończonych zamówień. Wariant B wytwarza więc 18 legalnych
odczytów bez jakiegokolwiek przeciwnika.

Kolektor filtruje pokrycie, dostępność usługi i retencję 120 min. Zapisy mają
czas zebrania oraz `availableAtMinute = capturedAtMinute + 5`. Konsumuje indeks
źródła także przy braku pokrycia; włączenie sensora nie odzyskuje utraconej
przeszłości. Pozyskane obserwacje zostają migawkami z własnym zakresem i czasem.

## Granica tury i koszt badania

1. Rozliczamy biznes według starej konfiguracji i rejestrujemy modelowaną
   legalną pracę plikową z zakończonego przedziału.
2. Przesuwamy zegar oraz kończymy prace administratora przed badaniami analityka.
3. Wygaszamy/odnawiamy sesje i rozstrzygamy najwyżej jedną akcję przeciwnika.
4. Zbieramy autentykację i audyt, stosując pokrycie/opóźnienie.
5. Ukończone badania pobierają wyłącznie dostępne wtedy zapisy.
6. Wyprowadzamy narrację z jawnych faktów, a po turze 18 udostępniamy raport.

`inspect-file-access` zajmuje analitykowi jedną turę i wymaga dostępnego sensora
FS-01; nie blokuje administratora. Odczyt jest lokalną pracą w firmie, nie wymaga
istniejącego tunelu VPN. Nowo powstały zapis nie staje się dowodem w tej samej
turze, jeśli termin dostarczenia jeszcze nie minął. Brak sensora/serwera oznacza
odrzucenie albo badanie bez nowego dowodu, a nie fałszywy pusty dowód bezpieczeństwa.
Przeglądanie pozyskanych dowodów nie przesuwa symulacji.

## Raport i zachowana zgodność

Raport strategiczny pokazuje faktyczne powody odmów wraz z czasem, pozyskane
obserwacje wraz ze źródłem/zakresem, minimalną i pełną wydajność, bilans firmy
oraz rzeczywiście ukończone projekty. Sam zakup nie przypisuje sukcesu.
W B ograniczenie zagrożenia jest `null`; 0 danych nie oznacza pokonania napastnika.

Dodatkowe pola są opcjonalne w bazowym silniku, więc brak inwestycji zachowuje
stare stany oraz wszystkie 249 regresji Sprintu 6. Nie modelujemy prawdziwego
MFA, ruchu sieciowego, plików lub pełnego SIEM; pozostaje limit planera trzech
niepowodzeń i 18 tur incydentu. [Wyniki](strategic-command-validation.md).
