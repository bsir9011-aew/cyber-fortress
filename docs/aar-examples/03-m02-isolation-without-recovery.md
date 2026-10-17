# FORTRESS LAB — After Action Review

Raport **AAR-aar-campaign-M2** · Fortress AAR V1 · wygenerowano 2026-10-17T12:56:41.194Z.

To raport analizy zakończonej rozgrywki, **nie zapis do wczytania w grze**. Zawiera prawdę ujawnioną po misji.

## 1. Podsumowanie

M02 — Ostatnia czysta kopia. 14:00–15:30, 18 tur po 5 min. Seed 1.

Cele spełnione łącznie: nie. Poufność: nie dotyczy; ciągłość: tak; ograniczenie źródła: tak; integralność: nie. To wyniki celów, **nie ocena jakości rozumowania**.

## 2. Kontekst firmy

NEXUS Logistics: 120 pracowników, 94 komputerów.

Kampania: misja 2, okno przygotowania 2. Budżet na starcie: 80000 PLN; wydano 12000; zarezerwowano 0; dostępne 68000.

Finansowanie:

Brak danych / nie dotyczy.

Projekty:

- **Uporządkowanie dostępu zdalnego**: available; koszt 32000 PLN; pozostało admin 4 h / analityk 0 h. Mechanizm: Nowe logowania wymagają zarejestrowanego drugiego składnika. Usuwamy nadmiarowy SMB magazyn-07 tylko tam, gdzie konto nie ma udokumentowanego zadania plikowego. Granica: MFA nie kończy wcześniej wydanych tuneli. Nie obejmuje innych usług tożsamości. Pilotaż 12 000 zł jest już opłacony.
- **Widoczność dostępu do plików**: available; koszt 28000 PLN; pozostało admin 2 h / analityk 4 h. Mechanizm: Rejestruje list/open/read, konto, sesję, wynik i mierzony wolumen odczytu. Analityk może pozyskać dowód podczas misji. Granica: Nie blokuje dostępu, nie nadaje uprawnień i nie klasyfikuje ludzi. Nie widzi prób zatrzymanych wcześniej w sieci.
- **Rozdzielenie ruchu VPN**: available; koszt 30000 PLN; pozostało admin 4 h / analityk 0 h. Mechanizm: HTTPS dopuszcza modelowane konta robocze. SMB dopuszcza wybraną grupę dokumentów i odrzuca pozostałe konta, również w istniejących tunelach. Granica: Przejęte konto należące do dozwolonej grupy zachowuje dostęp. Reguła nie rozpoznaje człowieka za kontem.

Praca przygotowawcza (godziny poza zegarem incydentu):



Rejestr inwestycji:

- id: B-0001.
- projectId: remote-access.
- amount: 12000.
- kind: prior-expense.
- stage: preparation.
- window: 0.
- result: applied.

Odziedziczona konfiguracja:

- remoteAccess: false.
- fileVisibility: false.
- segmentation: false.
- segmentationScope: file-team.
- ruleOverrides:


- accountOverrides:


- assetOverrides:



## 3. Cele misji

- maxExposedRecords: —.
- maxFinalBacklog: 40.
- requireThreatContainment: false.
- correctDocuments: 100.
- verifiedRecoveryRequired: true.
- sourceWriteRestrictedRequired: true.

## 4. Najważniejsze decyzje

Zachowano wszystkie zlecenia, odmowy i zmiany hipotez. Przesunięcie zegara jest na osi czasu. Brak zapisanej intencji oznacza, że nie przypisujemy graczowi uzasadnienia ani oczekiwanego skutku.

### D-00001 — 14:00 — Izolacja endpointu · pakowanie-03

Status: **completed**. Wykonawca: administrator. Zadanie: T-0001. Komenda 1. Zakończono: 14:05.

**Wiedza przed decyzją** (14:00): hipoteza VPN insufficient-evidence; integralność insufficient-evidence. Hipotezy są niezweryfikowanymi deklaracjami.

Pozyskane dowody: K-MSG-ewa-briefing. Alerty: brak. Znane ID sesji: brak. Migawka bramy: nie pobrano migawki.

Znana konfiguracja:

- assets (9):

- id: internet.
- name: Internet.
- status: online.

- id: firewall.
- name: Firewall.
- status: online.

- id: vpn.
- name: VPN Gateway.
- status: online.

- id: ad.
- name: Active Directory.
- status: online.

- id: web.
- name: Portal WWW.
- status: online.

- id: erp.
- name: ERP Server.
- status: online.

- id: workstations.
- name: Workstations.
- status: online.

- id: m365.
- name: Microsoft 365.
- status: online.

- id: fs-01.
- name: File Server FS-01.
- status: online.
- networkRules (4):

- id: R-ERP.
- sourceAssetId: vpn.
- targetAssetId: erp.
- protocol: HTTPS.
- priority: 10.
- action: allow.

- id: R-SMB.
- sourceAssetId: vpn.
- targetAssetId: fs-01.
- protocol: SMB.
- priority: 20.
- action: allow.

- id: R-LOCAL.
- sourceAssetId: workstations.
- targetAssetId: erp.
- protocol: HTTPS.
- priority: 30.
- action: allow.

- id: R-LOCAL-SMB.
- sourceAssetId: workstations.
- targetAssetId: fs-01.
- protocol: SMB.
- priority: 30.
- action: allow.
- knownAccounts: brak.
- sensors:

- authentication:

- id: vpn-auth.
- sourceAssetId: vpn.
- enabled: true.
- coverageFromMinute: 810.
- retentionMinutes: 120.
- delayMinutes: 0.
- sessions:

- id: vpn-active-sessions.
- sourceAssetId: vpn.
- enabled: true.
- retentionMinutes: 0.
- delayMinutes: 0.
- file: —.
- endpoint: —.
- endpoint:

- id: pakowanie-03.
- assetId: workstations.
- accountId: packing-local.
- isolated: false.
- writesRestricted: false.
- businessCapacity: 2.
- backupReadiness: —.

Znany stan biznesu: 0 obsłużonych, 0 zaległych. Zadania w toku: brak.

Ograniczenia i niewiadome:

- Alert jest sygnałem do zbadania, nie identyfikacją sprawcy.
- Brak rekordu nie oznacza braku zdarzenia: obowiązują pokrycie, dostępność, opóźnienie i retencja źródła.
- Obserwacja jest migawką z czasu pobrania; nie aktualizuje się po kolejnych zmianach.
- EDR czyta tylko dostarczone dane kolektora. Izolacja odcina nowe dostarczenia; fizyczny dziennik jest osobnym źródłem.
- Nie pobrano migawki sesji VPN.
- Nie pozyskano logów uwierzytelnienia.
- Nie zbadano integralności dokumentów.
- Nie pozyskano dziennika lokalnego ani obserwacji EDR.
- Tożsamość człowieka za kontem oraz prywatny plan zagrożenia nie są wiedzą gracza.

**Rzeczywisty stan przed decyzją — ujawniony dopiero po misji:**

Wydajność: **20 zamówień/turę**; wykradzione rekordy: **0**.

W tej misji ocena nieuprawnionego dostępu VPN nie dotyczy sprawcy. Nie oznacza to, że każda decyzja zachowała legalną działalność.

Dokumenty: 88 poprawnych / 12 uszkodzonych / 0 do uzgodnienia; razem 100. Odzyskane przynajmniej raz: 0.

Endpoint:

- id: pakowanie-03.
- assetId: workstations.
- accountId: packing-local.
- isolated: false.
- writesRestricted: false.
- businessCapacity: 2.
- permissions (2):

- assetId: fs-01.
- protocol: SMB.
- operations: read, modify.

- assetId: erp.
- protocol: HTTPS.
- operations: read.
- compromised: true.
- canRead: true.
- canWrite: true.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.
- packing-local: enabled, credentialVersion=1, MFA=not-required.
- warehouse-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- B-01 / dispatch-team: active, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- B-01 → erp/HTTPS: dopuszczony.
- B-01 → fs-01/SMB: odmowa.

**Rzeczywisty skutek:** zadanie ukończone 14:05. Natychmiastowy ślad before/after istniejącego silnika:

- threatAccessBefore:

- applicable: false.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: false.
- newAuthenticationAllowed: false.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: false.
- accountContained: false.
- threatAccessAfter:

- applicable: false.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: false.
- newAuthenticationAllowed: false.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: false.
- accountContained: false.
- totalCapacityBefore: 20.
- totalCapacityAfter: 18.
- exposedRecordsAtCompletion: 0.
- changedCapabilities: true.

Stan po całej granicy zakończenia (obejmuje także współbieżne działania):

Wydajność: **18 zamówień/turę**; wykradzione rekordy: **0**.

W tej misji ocena nieuprawnionego dostępu VPN nie dotyczy sprawcy. Nie oznacza to, że każda decyzja zachowała legalną działalność.

Dokumenty: 88 poprawnych / 12 uszkodzonych / 0 do uzgodnienia; razem 100. Odzyskane przynajmniej raz: 0.

Endpoint:

- id: pakowanie-03.
- assetId: workstations.
- accountId: packing-local.
- isolated: true.
- writesRestricted: false.
- businessCapacity: 2.
- permissions (2):

- assetId: fs-01.
- protocol: SMB.
- operations: read, modify.

- assetId: erp.
- protocol: HTTPS.
- operations: read.
- compromised: true.
- canRead: false.
- canWrite: false.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.
- packing-local: enabled, credentialVersion=1, MFA=not-required.
- warehouse-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- B-01 / dispatch-team: active, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- B-01 → erp/HTTPS: dopuszczony.
- B-01 → fs-01/SMB: odmowa.

Powiązane zdarzenia granicy: TL-00008, TL-00009, TL-00010, TL-00011, TL-00012.

**Późniejsze następstwa:** oś czasu od TL-00006 do TL-00062 oraz końcowe skutki w sekcjach 7–8. Zakres obejmuje inne przyczyny. Bez zapisanej intencji nie można rozstrzygnąć, które skutki były niezamierzone.

## 5. Oś czasu

Każdy wiersz ma stabilne ID. Minuta to fikcyjny czas świata. Zlecenie, ukończenie, obowiązywanie konfiguracji i pozyskanie obserwacji są osobnymi zdarzeniami. Gotowość rekordu sensora nie oznacza wiedzy gracza.

| ID | Czas / tura | Rodzaj / status | Źródło / faza | Powiązania | Fakty |

| --- | --- | --- | --- | --- | --- |

| TL-00001 | 14:00 / 0 | mission-start / started | scenario / initial |  | null |

| TL-00002 | 14:00 / 0 | authentication / success | authentication-service / actor-resolution |  | {"id":"AUTH-0001","minute":840,"sourceAssetId":"vpn","accountId":"dispatch-team","outcome":"success","sessionId":"B-01"} |

| TL-00003 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0001","minute":840,"sourceAssetId":"vpn","accountId":"dispatch-team","outcome":"success","sessionId":"B-01","sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00004 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0001","operationMinute":840,"availableAtMinute":840} |

| TL-00005 | 14:00 / 0 | evidence-obtained / available-to-player | Ewa / observation | K-MSG-ewa-briefing | {"kind":"narrative-message","assertion":"message"} |

| TL-00006 | 14:00 / 0 | decision-issued / ordered | command-journal / command | D-00001, T-0001 | {"type":"schedule-task","workerId":"administrator","action":{"type":"isolate-endpoint","endpointId":"pakowanie-03"}} |

| TL-00007 | 14:00 / 0 | task-started / running | engine.history / command | D-00001, T-0001 | {"kind":"task-started","task":{"id":"T-0001","workerId":"administrator","action":{"type":"isolate-endpoint","endpointId":"pakowanie-03"},"startTurn":0,"dueTurn":1,"status":"running"},"id":"E-0001","minute":840} |

| TL-00008 | 14:05 / 1 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":1,"received":20,"processed":20,"backlog":0,"localAvailable":true,"remoteAvailable":true,"capacity":20,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":true,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0002","minute":845} |

| TL-00011 | 14:05 / 1 | local-file-operation / allowed | local-operation-resolver / interval-settlement |  | {"minute":845,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"allowed","sourceSequence":2} |

| TL-00009 | 14:05 / 1 | task-completed / completed | engine.history / task-completion | D-00001, T-0001 | {"kind":"task-completed","task":{"id":"T-0001","workerId":"administrator","action":{"type":"isolate-endpoint","endpointId":"pakowanie-03"},"startTurn":0,"dueTurn":1,"status":"completed"},"id":"E-0003","minute":845} |

| TL-00010 | 14:05 / 1 | configuration-effective / applied | engine.history / task-completion | D-00001, T-0001 | {"kind":"configuration-changed","task":{"id":"T-0001","workerId":"administrator","action":{"type":"isolate-endpoint","endpointId":"pakowanie-03"},"startTurn":0,"dueTurn":1,"status":"completed"},"id":"E-0004","minute":845} |

| TL-00012 | 14:05 / 1 | evidence-obtained / available-to-player | Bartek / observation | K-MSG-msg-T-0001 | {"kind":"narrative-message","assertion":"message"} |

| TL-00013 | 14:10 / 2 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":2,"received":20,"processed":18,"backlog":2,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0005","minute":850} |

| TL-00014 | 14:10 / 2 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":850,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":3} |

| TL-00015 | 14:10 / 2 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":850,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":4} |

| TL-00016 | 14:10 / 2 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":2,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00017 | 14:15 / 3 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":3,"received":20,"processed":18,"backlog":4,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0006","minute":855} |

| TL-00018 | 14:15 / 3 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":855,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":5} |

| TL-00019 | 14:20 / 4 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":4,"received":20,"processed":18,"backlog":6,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0007","minute":860} |

| TL-00020 | 14:20 / 4 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":860,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":6} |

| TL-00021 | 14:20 / 4 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":860,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":7} |

| TL-00022 | 14:20 / 4 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":4,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00023 | 14:25 / 5 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":5,"received":20,"processed":18,"backlog":8,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0008","minute":865} |

| TL-00024 | 14:25 / 5 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":865,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":8} |

| TL-00025 | 14:30 / 6 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":6,"received":20,"processed":18,"backlog":10,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0009","minute":870} |

| TL-00026 | 14:30 / 6 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":870,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":9} |

| TL-00027 | 14:30 / 6 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":870,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":10} |

| TL-00028 | 14:30 / 6 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":6,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00029 | 14:35 / 7 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":7,"received":20,"processed":18,"backlog":12,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0010","minute":875} |

| TL-00030 | 14:35 / 7 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":875,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":11} |

| TL-00031 | 14:40 / 8 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":8,"received":20,"processed":18,"backlog":14,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0011","minute":880} |

| TL-00032 | 14:40 / 8 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":880,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":12} |

| TL-00033 | 14:40 / 8 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":880,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":13} |

| TL-00034 | 14:40 / 8 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":8,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00035 | 14:45 / 9 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":9,"received":20,"processed":18,"backlog":16,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0012","minute":885} |

| TL-00036 | 14:45 / 9 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":885,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":14} |

| TL-00037 | 14:50 / 10 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":10,"received":20,"processed":18,"backlog":18,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0013","minute":890} |

| TL-00038 | 14:50 / 10 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":890,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":15} |

| TL-00039 | 14:50 / 10 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":890,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":16} |

| TL-00040 | 14:50 / 10 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":10,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00041 | 14:55 / 11 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":11,"received":20,"processed":18,"backlog":20,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0014","minute":895} |

| TL-00042 | 14:55 / 11 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":895,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":17} |

| TL-00043 | 15:00 / 12 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":12,"received":20,"processed":18,"backlog":22,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0015","minute":900} |

| TL-00044 | 15:00 / 12 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":900,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":18} |

| TL-00045 | 15:00 / 12 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":900,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":19} |

| TL-00046 | 15:00 / 12 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":12,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00047 | 15:05 / 13 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":13,"received":20,"processed":18,"backlog":24,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0016","minute":905} |

| TL-00048 | 15:05 / 13 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":905,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":20} |

| TL-00049 | 15:10 / 14 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":14,"received":20,"processed":18,"backlog":26,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0017","minute":910} |

| TL-00050 | 15:10 / 14 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":910,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":21} |

| TL-00051 | 15:10 / 14 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":910,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":22} |

| TL-00052 | 15:10 / 14 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":14,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00053 | 15:15 / 15 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":15,"received":20,"processed":18,"backlog":28,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0018","minute":915} |

| TL-00054 | 15:15 / 15 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":915,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":23} |

| TL-00055 | 15:20 / 16 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":16,"received":20,"processed":18,"backlog":30,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0019","minute":920} |

| TL-00056 | 15:20 / 16 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":920,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":24} |

| TL-00057 | 15:20 / 16 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":920,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":25} |

| TL-00058 | 15:20 / 16 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":16,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00059 | 15:25 / 17 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":17,"received":20,"processed":18,"backlog":32,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0020","minute":925} |

| TL-00060 | 15:25 / 17 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":925,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":26} |

| TL-00061 | 15:30 / 18 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":18,"received":20,"processed":18,"backlog":34,"localAvailable":true,"remoteAvailable":true,"capacity":18,"status":"degraded","contributions":\[{"id":"packing-station","name":"pakowanie-03 — legalna praca lokalna","available":false,"capacity":2},{"id":"correct-documents","name":"Poprawne dokumenty FS-01 — lokalna droga","available":false,"capacity":14}\]},"id":"E-0021","minute":930} |

| TL-00063 | 15:30 / 18 | local-file-operation / denied | local-operation-resolver / interval-settlement |  | {"minute":930,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"read","documentIds":\["DOC-013","DOC-014"\],"outcome":"denied","sourceSequence":27} |

| TL-00064 | 15:30 / 18 | local-file-operation / denied | local-operation-resolver / actor-resolution |  | {"minute":930,"endpointId":"pakowanie-03","accountId":"packing-local","operation":"modify","documentIds":\["DOC-013","DOC-014","DOC-015","DOC-016","DOC-017","DOC-018","DOC-019","DOC-020","DOC-021","DOC-022","DOC-023","DOC-024","DOC-025","DOC-026","DOC-027","DOC-028","DOC-029","DOC-030","DOC-031","DOC-032"\],"outcome":"denied","sourceSequence":28} |

| TL-00065 | 15:30 / 18 | local-threat-attempt / access-denied | private-integrity-history / actor-resolution |  | {"turn":18,"outcome":"access-denied","documentIds":\[\],"timeBasis":"derived-from-recorded-turn-and-mission-clock"} |

| TL-00062 | 15:30 / 18 | simulation-finished / recorded | engine.history / finish |  | {"sourceEventId":"E-0022","businessGoalMet":true} |

## 6. Dowody i ograniczenia wiedzy

Katalog zawiera również dowody uzyskane później. Dla decyzji obowiązują **wyłącznie** wskazane w niej evidenceIds, nigdy cały katalog. Alert to sygnał, relacja człowieka to relacja; żadne z nich nie jest automatycznym potwierdzeniem sprawcy.

### K-MSG-ewa-briefing — narrative-message

Źródło: Ewa. Pozyskano: 14:00, tura 0, po komendzie 0. Rodzaj: message. Zadanie: —.

- id: ewa-briefing.
- minute: 840.
- speaker: Ewa.
- text: ERP działa, FS-01 odpowiada, ale dokumenty wysyłkowe nie zgadzają się z zamówieniami. Zespół pakowanie-03 zgłasza rozbieżności od 13:55. To relacja pracowników, nie potwierdzenie przyczyny. Do 15:30 musimy przywrócić poprawne dokumenty i zamknąć wysyłki..
- source: briefing.
- referenceId: mission-briefing.

### K-MSG-msg-T-0001 — narrative-message

Źródło: Bartek. Pozyskano: 14:05, tura 1, po komendzie 2. Rodzaj: message. Zadanie: —.

- id: msg-T-0001.
- speaker: Bartek.
- text: Odizolowałem pakowanie-03. Sieć tej stacji jest odcięta; stan dokumentów i kompromitacja nie zostały naprawione..
- source: configuration.
- referenceId: T-0001.
- minute: 845.

## 7. Skutki techniczne

Wykradzione rekordy: 0. Stan końcowy:

Wydajność: **18 zamówień/turę**; wykradzione rekordy: **0**.

W tej misji ocena nieuprawnionego dostępu VPN nie dotyczy sprawcy. Nie oznacza to, że każda decyzja zachowała legalną działalność.

Dokumenty: 88 poprawnych / 12 uszkodzonych / 0 do uzgodnienia; razem 100. Odzyskane przynajmniej raz: 0.

Endpoint:

- id: pakowanie-03.
- assetId: workstations.
- accountId: packing-local.
- isolated: true.
- writesRestricted: false.
- businessCapacity: 2.
- permissions (2):

- assetId: fs-01.
- protocol: SMB.
- operations: read, modify.

- assetId: erp.
- protocol: HTTPS.
- operations: read.
- compromised: true.
- canRead: false.
- canWrite: false.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.
- packing-local: enabled, credentialVersion=1, MFA=not-required.
- warehouse-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- B-01 / dispatch-team: active, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- B-01 → erp/HTTPS: dopuszczony.
- B-01 → fs-01/SMB: odmowa.

RPO: nie dotyczy. RTO od początku okna do skutecznej kontroli danych: niepotwierdzone. Ostatnia kopia: —. Źródło nadal może zapisywać: nie. Brakujące zmiany z kopii: 0; odtworzone jawnie z ERP: 0; nadal do uzgodnienia: 0.

Kopie i wykonane odtworzenia:

- snapshots (2):

- id: FS-1320.
- minute: 800.
- documentIds: DOC-001, DOC-002, DOC-003, DOC-004, DOC-005, DOC-006, DOC-007, DOC-008, DOC-009, DOC-010, DOC-011, DOC-012, DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032, DOC-033, DOC-034, DOC-035, DOC-036, DOC-037, DOC-038, DOC-039, DOC-040, DOC-041, DOC-042, DOC-043, DOC-044, DOC-045, DOC-046, DOC-047, DOC-048, DOC-049, DOC-050, DOC-051, DOC-052, DOC-053, DOC-054, DOC-055, DOC-056, DOC-057, DOC-058, DOC-059, DOC-060, DOC-061, DOC-062, DOC-063, DOC-064, DOC-065, DOC-066, DOC-067, DOC-068, DOC-069, DOC-070, DOC-071, DOC-072, DOC-073, DOC-074, DOC-075, DOC-076, DOC-077, DOC-078, DOC-079, DOC-080.
- damagedIds: brak.
- previouslyVerified: true.
- available: true.
- restoreTurns: 2.

- id: FS-1350.
- minute: 830.
- documentIds: DOC-001, DOC-002, DOC-003, DOC-004, DOC-005, DOC-006, DOC-007, DOC-008, DOC-009, DOC-010, DOC-011, DOC-012, DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032, DOC-033, DOC-034, DOC-035, DOC-036, DOC-037, DOC-038, DOC-039, DOC-040, DOC-041, DOC-042, DOC-043, DOC-044, DOC-045, DOC-046, DOC-047, DOC-048, DOC-049, DOC-050, DOC-051, DOC-052, DOC-053, DOC-054, DOC-055, DOC-056, DOC-057, DOC-058, DOC-059, DOC-060, DOC-061, DOC-062, DOC-063, DOC-064, DOC-065, DOC-066, DOC-067, DOC-068, DOC-069, DOC-070, DOC-071, DOC-072, DOC-073, DOC-074, DOC-075, DOC-076, DOC-077, DOC-078, DOC-079, DOC-080, DOC-081, DOC-082, DOC-083, DOC-084, DOC-085, DOC-086, DOC-087, DOC-088, DOC-089, DOC-090, DOC-091, DOC-092, DOC-093, DOC-094, DOC-095, DOC-096, DOC-097, DOC-098, DOC-099, DOC-100.
- damagedIds: brak.
- previouslyVerified: false.
- available: true.
- restoreTurns: 3.
- verification (2):

- id: FS-1320.
- verification: clean.
- verifiedAtMinute: 800.

- id: FS-1350.
- verification: unknown.
- verifiedAtMinute: —.
- readiness: —.
- recoveries: brak.
- reconciledIds: brak.

Rzeczywiste wykorzystanie inwestycji:

- edr: —.
- firstLocalEvidenceMinute: —.
- backup: —.
- restoreMinutes: —.

## 8. Skutki biznesowe

Wpłynęło **360**; obsłużono **326**; zaległe **34**; szczyt kolejki **34**. Nie przeliczamy zamówień na straty w PLN.

| Tura / przedział | Wydajność | Wpłynęło | Obsłużono | Zaległe |

| --- | ---: | ---: | ---: | ---: |

| 1 / 14:00–14:05 | 20 | 20 | 20 | 0 |

| 2 / 14:05–14:10 | 18 | 20 | 18 | 2 |

| 3 / 14:10–14:15 | 18 | 20 | 18 | 4 |

| 4 / 14:15–14:20 | 18 | 20 | 18 | 6 |

| 5 / 14:20–14:25 | 18 | 20 | 18 | 8 |

| 6 / 14:25–14:30 | 18 | 20 | 18 | 10 |

| 7 / 14:30–14:35 | 18 | 20 | 18 | 12 |

| 8 / 14:35–14:40 | 18 | 20 | 18 | 14 |

| 9 / 14:40–14:45 | 18 | 20 | 18 | 16 |

| 10 / 14:45–14:50 | 18 | 20 | 18 | 18 |

| 11 / 14:50–14:55 | 18 | 20 | 18 | 20 |

| 12 / 14:55–15:00 | 18 | 20 | 18 | 22 |

| 13 / 15:00–15:05 | 18 | 20 | 18 | 24 |

| 14 / 15:05–15:10 | 18 | 20 | 18 | 26 |

| 15 / 15:10–15:15 | 18 | 20 | 18 | 28 |

| 16 / 15:15–15:20 | 18 | 20 | 18 | 30 |

| 17 / 15:20–15:25 | 18 | 20 | 18 | 32 |

| 18 / 15:25–15:30 | 18 | 20 | 18 | 34 |

Zmiany przepustowości (rozliczany przedział używa konfiguracji sprzed efektów na jego końcu):

- 14:00–14:05: początek → 20 zamówień/turę.

- 14:05–14:10: 20 → 18 zamówień/turę.

## 9. Faktyczna przyczyna

Na pakowanie-03 przejęto lokalny kontekst packing-local z prawem SMB read/modify do FS-01. Proces zmieniał treść dokumentów bez zmiany ERP. Nie potrzebował VPN ani uprawnień administratora domeny. Izolacja i zakaz zapisu ograniczają źródło, odtworzenie i uzgodnienie naprawiają dane. Kompromitacja nie jest automatycznie usuwana.

Rzeczywiste logowania (również prelude sprzed początku misji):

- id: AUTH-0001.
- minute: 840.
- sourceAssetId: vpn.
- accountId: dispatch-team.
- outcome: success.
- sessionId: B-01.

Modelowane źródło VPN i posiadany materiał uwierzytelniający:

Brak danych / nie dotyczy.

Rzeczywiste działania źródła VPN:



Rzeczywiste operacje lokalne:

- minute: 835.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-001, DOC-002, DOC-003, DOC-004, DOC-005, DOC-006, DOC-007, DOC-008, DOC-009, DOC-010, DOC-011, DOC-012.
- outcome: allowed.

- minute: 845.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: allowed.

- minute: 850.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 850.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 855.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 860.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 860.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 865.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 870.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 870.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 875.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 880.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 880.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 885.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 890.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 890.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 895.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 900.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 900.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 905.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 910.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 910.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 915.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 920.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 920.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

- minute: 925.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 930.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: read.
- documentIds: DOC-013, DOC-014.
- outcome: denied.

- minute: 930.
- endpointId: pakowanie-03.
- accountId: packing-local.
- operation: modify.
- documentIds: DOC-013, DOC-014, DOC-015, DOC-016, DOC-017, DOC-018, DOC-019, DOC-020, DOC-021, DOC-022, DOC-023, DOC-024, DOC-025, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032.
- outcome: denied.

Próby źródła modyfikacji lokalnych:

- turn: 2.
- outcome: access-denied.
- documentIds: brak.

- turn: 4.
- outcome: access-denied.
- documentIds: brak.

- turn: 6.
- outcome: access-denied.
- documentIds: brak.

- turn: 8.
- outcome: access-denied.
- documentIds: brak.

- turn: 10.
- outcome: access-denied.
- documentIds: brak.

- turn: 12.
- outcome: access-denied.
- documentIds: brak.

- turn: 14.
- outcome: access-denied.
- documentIds: brak.

- turn: 16.
- outcome: access-denied.
- documentIds: brak.

- turn: 18.
- outcome: access-denied.
- documentIds: brak.

## 10. Pytania do analizy

1. Jakie dowody były dostępne przed każdą decyzją, a jakie dotarły później?

2. Które mechanizmy zmieniło działanie, a które pozostały aktywne?

3. Jak ograniczenie bezpieczeństwa wpłynęło na legalną pracę?

4. Jak sprawdzono wynik odzyskiwania i trwałość ograniczenia?

5. Jakich danych lub kontrolowanego replay potrzeba do porównania alternatywy?

## 11. Kontekst powtórki

- mode: unknown.
- seed: 1.
- scenarioId: nexus-last-clean-copy.
- requiresCampaignPreparation: true.
- campaignMissionId: aar-campaign-M2.
- warning: Ponowienie z innymi decyzjami jest nowym przebiegiem. Hipotetyczny wynik nie jest faktem tego raportu..

### Jednostki, pochodzenie i ograniczenia

minute: liczba minut od północy fikcyjnego dnia, np. 840 = 14:00. turn: granica tury 0–18, null dla zdarzeń poza granicą lub przed oknem. generatedAt: rzeczywisty UTC ISO 8601.

Zamówienia i dokumenty to liczby sztuk. exposedRecords to rekordy danych, nie dokumenty. Budżet w PLN. Praca przygotowawcza w godzinach; RPO/RTO i czasy misji w minutach.

Czas świata, kolejność komend w tej samej minucie, faza istniejącego silnika i kolejność źródła. Fazy: rozliczenie starego przedziału, ukończenie zadań/konfiguracja, aktorzy, sensory, badania. Prelude sprzed okna jest w groundTruth, nie na osi czasu.

- timeline: SimulationState.history + istniejące źródła/rekordy telemetryczne i prywatne ślady aktorów; bez DOM.

- knownEvidence: Ukończone obserwacje i komunikaty zbierane podczas replay; nigdy końcowa wiedza nakładana wstecz.

- actualState: Istniejące assessThreatAccess, canUseService, canUseLocalService, businessAvailability i documentCounts.

- campaignContext: Pełny replay kampanii od initialSeed, stan przygotowania w chwili właściwego startu misji.

- Raport zawiera fikcyjną prywatną prawdę scenariusza; jest dostępny tylko po zakończeniu misji.

- Nie ma kryptograficznej autentyczności lokalnego raportu. Zmieniony plik może przedstawiać inne dane.

- MFA jest przygotowaniem przed misją, bez komendy zmiany MFA w środku incydentu. Nie oznacza automatycznego zakończenia wydanych sesji.

- Nie zarejestrowano toku myślenia, uzasadnień ani informacji faktycznie przeczytanych przez człowieka. Hipoteza nie jest zweryfikowanym faktem.

- Chronologia odtwarza zarejestrowane granice tur; nie zna czasu ściennego kliknięć ani kolejności fizycznej między niezależnymi źródłami w tej samej fazie.

- Skutki wspólnej granicy tury nie stanowią izolowanego eksperymentu. Nie obliczamy nieprzeprowadzonych alternatyw ani pieniężnych strat zamówień.

- Historyczne podsumowanie bez dziennika nie wystarcza do rekonstrukcji AAR. Raporty nie zastępują zapisu gry.

- Brak sensora, opóźnienie, retencja i odcięcie dostarczania mogą ograniczyć dowody; nie dowodzą braku aktywności.
