# FORTRESS LAB — After Action Review

Raport **AAR-aar-C** · Fortress AAR V1 · wygenerowano 2026-10-17T12:56:41.194Z.

To raport analizy zakończonej rozgrywki, **nie zapis do wczytania w grze**. Zawiera prawdę ujawnioną po misji.

## 1. Podsumowanie

M01 — Przejęty tunel. 14:00–15:30, 18 tur po 5 min. Seed 0.

Cele spełnione łącznie: tak. Poufność: tak; ciągłość: tak; ograniczenie źródła: tak; integralność: nie dotyczy. To wyniki celów, **nie ocena jakości rozumowania**.

## 2. Kontekst firmy

NEXUS Logistics: 120 pracowników, 94 komputerów.

Samodzielna misja, bez budżetu i przygotowania kampanii.

## 3. Cele misji

- maxExposedRecords: 0.
- maxFinalBacklog: 40.
- requireThreatContainment: true.

## 4. Najważniejsze decyzje

Zachowano wszystkie zlecenia, odmowy i zmiany hipotez. Przesunięcie zegara jest na osi czasu. Brak zapisanej intencji oznacza, że nie przypisujemy graczowi uzasadnienia ani oczekiwanego skutku.

### D-00001 — 14:00 — Zmiana dostępności VPN · vpn

Status: **completed**. Wykonawca: administrator. Zadanie: T-0001. Komenda 1. Zakończono: 14:05.

**Wiedza przed decyzją** (14:00): hipoteza VPN insufficient-evidence; integralność —. Hipotezy są niezweryfikowanymi deklaracjami.

Pozyskane dowody: K-AL-VPN-AL-vpn-auth-magazyn-07, K-MSG-ewa-briefing. Alerty: K-AL-VPN-AL-vpn-auth-magazyn-07. Znane ID sesji: brak. Migawka bramy: nie pobrano migawki.

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
- networkRules (3):

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
- knownAccounts (1):

- id: magazyn-07.
- blocked: false.
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
- endpoint: —.
- backupReadiness: —.

Znany stan biznesu: 0 obsłużonych, 0 zaległych. Zadania w toku: brak.

Ograniczenia i niewiadome:

- Alert jest sygnałem do zbadania, nie identyfikacją sprawcy.
- Brak rekordu nie oznacza braku zdarzenia: obowiązują pokrycie, dostępność, opóźnienie i retencja źródła.
- Obserwacja jest migawką z czasu pobrania; nie aktualizuje się po kolejnych zmianach.
- Nie pobrano migawki sesji VPN.
- Nie pozyskano logów uwierzytelnienia.
- Tożsamość człowieka za kontem oraz prywatny plan zagrożenia nie są wiedzą gracza.

**Rzeczywisty stan przed decyzją — ujawniony dopiero po misji:**

Wydajność: **22 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: S-19. Tunele z dostępem do celu: S-19. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: tak. Dostęp do celu po nowym uwierzytelnieniu: tak.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: active, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: active, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: dopuszczony.
- B-01 → erp/HTTPS: dopuszczony.
- B-01 → fs-01/SMB: odmowa.

**Rzeczywisty skutek:** zadanie ukończone 14:05. Natychmiastowy ślad before/after istniejącego silnika:

- threatAccessBefore:

- applicable: true.
- activeSessionIds: S-19.
- usableSessionIds: S-19.
- stolenCredentialStillCurrent: true.
- newAuthenticationAllowed: true.
- accessAfterNewAuthentication: true.
- targetAccessCutOff: false.
- accountContained: false.
- threatAccessAfter:

- applicable: true.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: true.
- newAuthenticationAllowed: false.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: true.
- accountContained: false.
- totalCapacityBefore: 22.
- totalCapacityAfter: 8.
- exposedRecordsAtCompletion: 0.
- changedCapabilities: true.

Stan po całej granicy zakończenia (obejmuje także współbieżne działania):

Wydajność: **8 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: brak. Tunele z dostępem do celu: brak. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: nie. Dostęp do celu po nowym uwierzytelnieniu: nie.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: terminated, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: terminated, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: odmowa.
- B-01 → erp/HTTPS: odmowa.
- B-01 → fs-01/SMB: odmowa.

Powiązane zdarzenia granicy: TL-00115, TL-00116, TL-00117, TL-00118.

**Późniejsze następstwa:** oś czasu od TL-00113 do TL-00159 oraz końcowe skutki w sekcjach 7–8. Zakres obejmuje inne przyczyny. Bez zapisanej intencji nie można rozstrzygnąć, które skutki były niezamierzone.

### D-00003 — 14:05 — Zmiana reguły sieciowej · R-SMB

Status: **completed**. Wykonawca: administrator. Zadanie: T-0002. Komenda 3. Zakończono: 14:15.

**Wiedza przed decyzją** (14:05): hipoteza VPN insufficient-evidence; integralność —. Hipotezy są niezweryfikowanymi deklaracjami.

Pozyskane dowody: K-AL-VPN-AL-vpn-auth-magazyn-07, K-MSG-ewa-briefing, K-MSG-msg-T-0001. Alerty: K-AL-VPN-AL-vpn-auth-magazyn-07. Znane ID sesji: brak. Migawka bramy: nie pobrano migawki.

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
- status: offline.

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
- networkRules (3):

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
- knownAccounts (1):

- id: magazyn-07.
- blocked: false.
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
- endpoint: —.
- backupReadiness: —.

Znany stan biznesu: 20 obsłużonych, 0 zaległych. Zadania w toku: brak.

Ograniczenia i niewiadome:

- Alert jest sygnałem do zbadania, nie identyfikacją sprawcy.
- Brak rekordu nie oznacza braku zdarzenia: obowiązują pokrycie, dostępność, opóźnienie i retencja źródła.
- Obserwacja jest migawką z czasu pobrania; nie aktualizuje się po kolejnych zmianach.
- Nie pobrano migawki sesji VPN.
- Nie pozyskano logów uwierzytelnienia.
- Tożsamość człowieka za kontem oraz prywatny plan zagrożenia nie są wiedzą gracza.

**Rzeczywisty stan przed decyzją — ujawniony dopiero po misji:**

Wydajność: **8 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: brak. Tunele z dostępem do celu: brak. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: nie. Dostęp do celu po nowym uwierzytelnieniu: nie.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: terminated, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: terminated, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: odmowa.
- B-01 → erp/HTTPS: odmowa.
- B-01 → fs-01/SMB: odmowa.

**Rzeczywisty skutek:** zadanie ukończone 14:15. Natychmiastowy ślad before/after istniejącego silnika:

- threatAccessBefore:

- applicable: true.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: true.
- newAuthenticationAllowed: false.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: true.
- accountContained: false.
- threatAccessAfter:

- applicable: true.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: true.
- newAuthenticationAllowed: false.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: true.
- accountContained: false.
- totalCapacityBefore: 8.
- totalCapacityAfter: 8.
- exposedRecordsAtCompletion: 0.
- changedCapabilities: false.

Stan po całej granicy zakończenia (obejmuje także współbieżne działania):

Wydajność: **8 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: brak. Tunele z dostępem do celu: brak. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: nie. Dostęp do celu po nowym uwierzytelnieniu: nie.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: terminated, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: terminated, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: odmowa.
- B-01 → erp/HTTPS: odmowa.
- B-01 → fs-01/SMB: odmowa.

Powiązane zdarzenia granicy: TL-00124, TL-00125, TL-00126, TL-00127.

**Późniejsze następstwa:** oś czasu od TL-00119 do TL-00159 oraz końcowe skutki w sekcjach 7–8. Zakres obejmuje inne przyczyny. Bez zapisanej intencji nie można rozstrzygnąć, które skutki były niezamierzone.

### D-00006 — 14:15 — Zmiana dostępności VPN · vpn

Status: **completed**. Wykonawca: administrator. Zadanie: T-0003. Komenda 6. Zakończono: 14:20.

**Wiedza przed decyzją** (14:15): hipoteza VPN insufficient-evidence; integralność —. Hipotezy są niezweryfikowanymi deklaracjami.

Pozyskane dowody: K-AL-VPN-AL-vpn-auth-magazyn-07, K-MSG-ewa-briefing, K-MSG-msg-T-0001, K-MSG-ewa-queue, K-MSG-msg-T-0002. Alerty: K-AL-VPN-AL-vpn-auth-magazyn-07. Znane ID sesji: brak. Migawka bramy: nie pobrano migawki.

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
- status: offline.

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
- networkRules (3):

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
- action: deny.

- id: R-LOCAL.
- sourceAssetId: workstations.
- targetAssetId: erp.
- protocol: HTTPS.
- priority: 30.
- action: allow.
- knownAccounts (1):

- id: magazyn-07.
- blocked: false.
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
- endpoint: —.
- backupReadiness: —.

Znany stan biznesu: 36 obsłużonych, 24 zaległych. Zadania w toku: brak.

Ograniczenia i niewiadome:

- Alert jest sygnałem do zbadania, nie identyfikacją sprawcy.
- Brak rekordu nie oznacza braku zdarzenia: obowiązują pokrycie, dostępność, opóźnienie i retencja źródła.
- Obserwacja jest migawką z czasu pobrania; nie aktualizuje się po kolejnych zmianach.
- Nie pobrano migawki sesji VPN.
- Nie pozyskano logów uwierzytelnienia.
- Tożsamość człowieka za kontem oraz prywatny plan zagrożenia nie są wiedzą gracza.

**Rzeczywisty stan przed decyzją — ujawniony dopiero po misji:**

Wydajność: **8 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: brak. Tunele z dostępem do celu: brak. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: nie. Dostęp do celu po nowym uwierzytelnieniu: nie.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: terminated, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: terminated, pochodzenie legitimate; 14:00–16:00.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: odmowa.
- B-01 → erp/HTTPS: odmowa.
- B-01 → fs-01/SMB: odmowa.

**Rzeczywisty skutek:** zadanie ukończone 14:20. Natychmiastowy ślad before/after istniejącego silnika:

- threatAccessBefore:

- applicable: true.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: true.
- newAuthenticationAllowed: false.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: true.
- accountContained: false.
- threatAccessAfter:

- applicable: true.
- activeSessionIds: brak.
- usableSessionIds: brak.
- stolenCredentialStillCurrent: true.
- newAuthenticationAllowed: true.
- accessAfterNewAuthentication: false.
- targetAccessCutOff: true.
- accountContained: false.
- totalCapacityBefore: 8.
- totalCapacityAfter: 8.
- exposedRecordsAtCompletion: 0.
- changedCapabilities: true.

Stan po całej granicy zakończenia (obejmuje także współbieżne działania):

Wydajność: **22 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: S-20. Tunele z dostępem do celu: brak. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: tak. Dostęp do celu po nowym uwierzytelnieniu: nie.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: terminated, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: terminated, pochodzenie legitimate; 14:00–16:00.
- B-reconnect-04 / dispatch-team: active, pochodzenie legitimate; 14:20–16:20.
- S-20 / magazyn-07: active, pochodzenie unauthorized; 14:20–16:20.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: odmowa.
- B-01 → erp/HTTPS: odmowa.
- B-01 → fs-01/SMB: odmowa.
- B-reconnect-04 → erp/HTTPS: dopuszczony.
- B-reconnect-04 → fs-01/SMB: odmowa.
- S-20 → erp/HTTPS: odmowa.
- S-20 → fs-01/SMB: odmowa.

Powiązane zdarzenia granicy: TL-00130, TL-00131, TL-00132, TL-00133, TL-00134, TL-00135, TL-00136, TL-00137, TL-00138, TL-00139, TL-00140, TL-00141.

**Późniejsze następstwa:** oś czasu od TL-00128 do TL-00159 oraz końcowe skutki w sekcjach 7–8. Zakres obejmuje inne przyczyny. Bez zapisanej intencji nie można rozstrzygnąć, które skutki były niezamierzone.

## 5. Oś czasu

Każdy wiersz ma stabilne ID. Minuta to fikcyjny czas świata. Zlecenie, ukończenie, obowiązywanie konfiguracji i pozyskanie obserwacji są osobnymi zdarzeniami. Gotowość rekordu sensora nie oznacza wiedzy gracza.

| ID | Czas / tura | Rodzaj / status | Źródło / faza | Powiązania | Fakty |

| --- | --- | --- | --- | --- | --- |

| TL-00001 | 14:00 / 0 | mission-start / started | scenario / initial |  | null |

| TL-00002 | 14:00 / 0 | authentication / success | authentication-service / actor-resolution |  | {"id":"AUTH-0054","minute":840,"sourceAssetId":"vpn","accountId":"dispatch-team","outcome":"success","sessionId":"B-01"} |

| TL-00003 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0001","minute":820,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00004 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0001","operationMinute":820,"availableAtMinute":840} |

| TL-00005 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0002","minute":820,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00006 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0002","operationMinute":820,"availableAtMinute":840} |

| TL-00007 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0003","minute":820,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00008 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0003","operationMinute":820,"availableAtMinute":840} |

| TL-00009 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0004","minute":821,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00010 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0004","operationMinute":821,"availableAtMinute":840} |

| TL-00011 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0005","minute":821,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00012 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0005","operationMinute":821,"availableAtMinute":840} |

| TL-00013 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0006","minute":821,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00014 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0006","operationMinute":821,"availableAtMinute":840} |

| TL-00015 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0007","minute":822,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00016 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0007","operationMinute":822,"availableAtMinute":840} |

| TL-00017 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0008","minute":822,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00018 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0008","operationMinute":822,"availableAtMinute":840} |

| TL-00019 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0009","minute":822,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00020 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0009","operationMinute":822,"availableAtMinute":840} |

| TL-00021 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0010","minute":823,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00022 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0010","operationMinute":823,"availableAtMinute":840} |

| TL-00023 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0011","minute":823,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00024 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0011","operationMinute":823,"availableAtMinute":840} |

| TL-00025 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0012","minute":823,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00026 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0012","operationMinute":823,"availableAtMinute":840} |

| TL-00027 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0013","minute":824,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00028 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0013","operationMinute":824,"availableAtMinute":840} |

| TL-00029 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0014","minute":824,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00030 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0014","operationMinute":824,"availableAtMinute":840} |

| TL-00031 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0015","minute":824,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00032 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0015","operationMinute":824,"availableAtMinute":840} |

| TL-00033 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0016","minute":825,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00034 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0016","operationMinute":825,"availableAtMinute":840} |

| TL-00035 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0017","minute":825,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00036 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0017","operationMinute":825,"availableAtMinute":840} |

| TL-00037 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0018","minute":825,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00038 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0018","operationMinute":825,"availableAtMinute":840} |

| TL-00039 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0019","minute":826,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00040 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0019","operationMinute":826,"availableAtMinute":840} |

| TL-00041 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0020","minute":826,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00042 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0020","operationMinute":826,"availableAtMinute":840} |

| TL-00043 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0021","minute":826,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00044 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0021","operationMinute":826,"availableAtMinute":840} |

| TL-00045 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0022","minute":827,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00046 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0022","operationMinute":827,"availableAtMinute":840} |

| TL-00047 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0023","minute":827,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00048 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0023","operationMinute":827,"availableAtMinute":840} |

| TL-00049 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0024","minute":827,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00050 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0024","operationMinute":827,"availableAtMinute":840} |

| TL-00051 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0025","minute":828,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00052 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0025","operationMinute":828,"availableAtMinute":840} |

| TL-00053 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0026","minute":828,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00054 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0026","operationMinute":828,"availableAtMinute":840} |

| TL-00055 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0027","minute":828,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00056 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0027","operationMinute":828,"availableAtMinute":840} |

| TL-00057 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0028","minute":829,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00058 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0028","operationMinute":829,"availableAtMinute":840} |

| TL-00059 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0029","minute":829,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00060 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0029","operationMinute":829,"availableAtMinute":840} |

| TL-00061 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0030","minute":829,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00062 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0030","operationMinute":829,"availableAtMinute":840} |

| TL-00063 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0031","minute":830,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00064 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0031","operationMinute":830,"availableAtMinute":840} |

| TL-00065 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0032","minute":830,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00066 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0032","operationMinute":830,"availableAtMinute":840} |

| TL-00067 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0033","minute":830,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00068 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0033","operationMinute":830,"availableAtMinute":840} |

| TL-00069 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0034","minute":831,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00070 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0034","operationMinute":831,"availableAtMinute":840} |

| TL-00071 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0035","minute":831,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00072 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0035","operationMinute":831,"availableAtMinute":840} |

| TL-00073 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0036","minute":831,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00074 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0036","operationMinute":831,"availableAtMinute":840} |

| TL-00075 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0037","minute":832,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00076 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0037","operationMinute":832,"availableAtMinute":840} |

| TL-00077 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0038","minute":832,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00078 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0038","operationMinute":832,"availableAtMinute":840} |

| TL-00079 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0039","minute":832,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00080 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0039","operationMinute":832,"availableAtMinute":840} |

| TL-00081 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0040","minute":833,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00082 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0040","operationMinute":833,"availableAtMinute":840} |

| TL-00083 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0041","minute":833,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00084 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0041","operationMinute":833,"availableAtMinute":840} |

| TL-00085 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0042","minute":833,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00086 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0042","operationMinute":833,"availableAtMinute":840} |

| TL-00087 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0043","minute":834,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00088 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0043","operationMinute":834,"availableAtMinute":840} |

| TL-00089 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0044","minute":834,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00090 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0044","operationMinute":834,"availableAtMinute":840} |

| TL-00091 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0045","minute":834,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00092 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0045","operationMinute":834,"availableAtMinute":840} |

| TL-00093 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0046","minute":835,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00094 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0046","operationMinute":835,"availableAtMinute":840} |

| TL-00095 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0047","minute":835,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00096 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0047","operationMinute":835,"availableAtMinute":840} |

| TL-00097 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0048","minute":835,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00098 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0048","operationMinute":835,"availableAtMinute":840} |

| TL-00099 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0049","minute":836,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00100 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0049","operationMinute":836,"availableAtMinute":840} |

| TL-00101 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0050","minute":836,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00102 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0050","operationMinute":836,"availableAtMinute":840} |

| TL-00103 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0051","minute":836,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00104 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0051","operationMinute":836,"availableAtMinute":840} |

| TL-00105 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0052","minute":837,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"failure","sessionId":null,"sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00106 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0052","operationMinute":837,"availableAtMinute":840} |

| TL-00107 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0053","minute":838,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"success","sessionId":"S-19","sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00108 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0053","operationMinute":838,"availableAtMinute":840} |

| TL-00109 | 14:00 / 0 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0054","minute":840,"sourceAssetId":"vpn","accountId":"dispatch-team","outcome":"success","sessionId":"B-01","sensorId":"vpn-auth","capturedAtMinute":840,"availableAtMinute":840} |

| TL-00110 | 14:00 / 0 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0054","operationMinute":840,"availableAtMinute":840} |

| TL-00111 | 14:00 / 0 | evidence-obtained / available-to-player | vpn-detector / observation | K-AL-VPN-AL-vpn-auth-magazyn-07 | {"kind":"vpn-alert","assertion":"signal"} |

| TL-00112 | 14:00 / 0 | evidence-obtained / available-to-player | Ewa / observation | K-MSG-ewa-briefing | {"kind":"narrative-message","assertion":"message"} |

| TL-00113 | 14:00 / 0 | decision-issued / ordered | command-journal / command | D-00001, T-0001 | {"type":"schedule-task","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":false}} |

| TL-00114 | 14:00 / 0 | task-started / running | engine.history / command | D-00001, T-0001 | {"kind":"task-started","task":{"id":"T-0001","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":false},"startTurn":0,"dueTurn":1,"status":"running"},"id":"E-0001","minute":840} |

| TL-00115 | 14:05 / 1 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":1,"received":20,"processed":20,"backlog":0,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0002","minute":845} |

| TL-00116 | 14:05 / 1 | task-completed / completed | engine.history / task-completion | D-00001, T-0001 | {"kind":"task-completed","task":{"id":"T-0001","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":false},"startTurn":0,"dueTurn":1,"status":"completed"},"id":"E-0003","minute":845} |

| TL-00117 | 14:05 / 1 | configuration-effective / applied | engine.history / task-completion | D-00001, T-0001 | {"kind":"configuration-changed","task":{"id":"T-0001","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":false},"startTurn":0,"dueTurn":1,"status":"completed"},"id":"E-0004","minute":845} |

| TL-00118 | 14:05 / 1 | evidence-obtained / available-to-player | Bartek / observation | K-MSG-msg-T-0001 | {"kind":"narrative-message","assertion":"message"} |

| TL-00119 | 14:05 / 1 | decision-issued / ordered | command-journal / command | D-00003, T-0002 | {"type":"schedule-task","workerId":"administrator","action":{"type":"set-network-rule","ruleId":"R-SMB","action":"deny"}} |

| TL-00120 | 14:05 / 1 | task-started / running | engine.history / command | D-00003, T-0002 | {"kind":"task-started","task":{"id":"T-0002","workerId":"administrator","action":{"type":"set-network-rule","ruleId":"R-SMB","action":"deny"},"startTurn":1,"dueTurn":3,"status":"running"},"id":"E-0005","minute":845} |

| TL-00121 | 14:10 / 2 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":2,"received":20,"processed":8,"backlog":12,"localAvailable":true,"remoteAvailable":false,"capacity":8,"status":"degraded"},"id":"E-0006","minute":850} |

| TL-00122 | 14:10 / 2 | vpn-actor-action / session-lost | private-attack-history / actor-resolution |  | {"id":"A-0001","turn":2,"minute":850,"action":"reconnaissance","outcome":"session-lost","sessionId":"S-19","copiedRecords":0,"totalExposedRecords":0} |

| TL-00123 | 14:10 / 2 | evidence-obtained / available-to-player | Ewa / observation | K-MSG-ewa-queue | {"kind":"narrative-message","assertion":"message"} |

| TL-00124 | 14:15 / 3 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":3,"received":20,"processed":8,"backlog":24,"localAvailable":true,"remoteAvailable":false,"capacity":8,"status":"degraded"},"id":"E-0007","minute":855} |

| TL-00125 | 14:15 / 3 | task-completed / completed | engine.history / task-completion | D-00003, T-0002 | {"kind":"task-completed","task":{"id":"T-0002","workerId":"administrator","action":{"type":"set-network-rule","ruleId":"R-SMB","action":"deny"},"startTurn":1,"dueTurn":3,"status":"completed"},"id":"E-0008","minute":855} |

| TL-00126 | 14:15 / 3 | configuration-effective / applied | engine.history / task-completion | D-00003, T-0002 | {"kind":"configuration-changed","task":{"id":"T-0002","workerId":"administrator","action":{"type":"set-network-rule","ruleId":"R-SMB","action":"deny"},"startTurn":1,"dueTurn":3,"status":"completed"},"id":"E-0009","minute":855} |

| TL-00127 | 14:15 / 3 | evidence-obtained / available-to-player | Bartek / observation | K-MSG-msg-T-0002 | {"kind":"narrative-message","assertion":"message"} |

| TL-00128 | 14:15 / 3 | decision-issued / ordered | command-journal / command | D-00006, T-0003 | {"type":"schedule-task","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":true}} |

| TL-00129 | 14:15 / 3 | task-started / running | engine.history / command | D-00006, T-0003 | {"kind":"task-started","task":{"id":"T-0003","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":true},"startTurn":3,"dueTurn":4,"status":"running"},"id":"E-0010","minute":855} |

| TL-00130 | 14:20 / 4 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":4,"received":20,"processed":8,"backlog":36,"localAvailable":true,"remoteAvailable":false,"capacity":8,"status":"degraded"},"id":"E-0011","minute":860} |

| TL-00131 | 14:20 / 4 | task-completed / completed | engine.history / task-completion | D-00006, T-0003 | {"kind":"task-completed","task":{"id":"T-0003","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":true},"startTurn":3,"dueTurn":4,"status":"completed"},"id":"E-0012","minute":860} |

| TL-00132 | 14:20 / 4 | configuration-effective / applied | engine.history / task-completion | D-00006, T-0003 | {"kind":"configuration-changed","task":{"id":"T-0003","workerId":"administrator","action":{"type":"set-vpn","assetId":"vpn","enabled":true},"startTurn":3,"dueTurn":4,"status":"completed"},"id":"E-0013","minute":860} |

| TL-00133 | 14:20 / 4 | authentication / success | authentication-service / actor-resolution |  | {"id":"AUTH-0055","minute":860,"sourceAssetId":"vpn","accountId":"dispatch-team","outcome":"success","sessionId":"B-reconnect-04"} |

| TL-00134 | 14:20 / 4 | authentication / success | authentication-service / actor-resolution |  | {"id":"AUTH-0056","minute":860,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"success","sessionId":"S-20"} |

| TL-00135 | 14:20 / 4 | vpn-actor-action / authentication-accepted | private-attack-history / actor-resolution |  | {"id":"A-0002","turn":4,"minute":860,"action":"authenticate","outcome":"authentication-accepted","sessionId":"S-20","copiedRecords":0,"totalExposedRecords":0} |

| TL-00136 | 14:20 / 4 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0055","minute":860,"sourceAssetId":"vpn","accountId":"dispatch-team","outcome":"success","sessionId":"B-reconnect-04","sensorId":"vpn-auth","capturedAtMinute":860,"availableAtMinute":860} |

| TL-00137 | 14:20 / 4 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0055","operationMinute":860,"availableAtMinute":860} |

| TL-00138 | 14:20 / 4 | sensor-captured / captured | authentication-sensor / telemetry |  | {"id":"AUTH-0056","minute":860,"sourceAssetId":"vpn","accountId":"magazyn-07","outcome":"success","sessionId":"S-20","sensorId":"vpn-auth","capturedAtMinute":860,"availableAtMinute":860} |

| TL-00139 | 14:20 / 4 | sensor-record-eligible / eligible-not-player-observation | authentication-sensor / telemetry |  | {"recordId":"AUTH:AUTH-0056","operationMinute":860,"availableAtMinute":860} |

| TL-00140 | 14:20 / 4 | evidence-obtained / available-to-player | Bartek / observation | K-MSG-msg-T-0003 | {"kind":"narrative-message","assertion":"message"} |

| TL-00141 | 14:20 / 4 | evidence-obtained / available-to-player | Ewa / observation | K-MSG-ewa-restored | {"kind":"narrative-message","assertion":"message"} |

| TL-00142 | 14:25 / 5 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":5,"received":20,"processed":22,"backlog":34,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0014","minute":865} |

| TL-00143 | 14:25 / 5 | vpn-actor-action / access-denied | private-attack-history / actor-resolution |  | {"id":"A-0003","turn":5,"minute":865,"action":"reconnaissance","outcome":"access-denied","sessionId":"S-20","copiedRecords":0,"totalExposedRecords":0} |

| TL-00144 | 14:30 / 6 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":6,"received":20,"processed":22,"backlog":32,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0015","minute":870} |

| TL-00145 | 14:35 / 7 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":7,"received":20,"processed":22,"backlog":30,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0016","minute":875} |

| TL-00146 | 14:35 / 7 | vpn-actor-action / access-denied | private-attack-history / actor-resolution |  | {"id":"A-0004","turn":7,"minute":875,"action":"reconnaissance","outcome":"access-denied","sessionId":"S-20","copiedRecords":0,"totalExposedRecords":0} |

| TL-00147 | 14:40 / 8 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":8,"received":20,"processed":22,"backlog":28,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0017","minute":880} |

| TL-00148 | 14:45 / 9 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":9,"received":20,"processed":22,"backlog":26,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0018","minute":885} |

| TL-00149 | 14:45 / 9 | vpn-actor-action / access-denied | private-attack-history / actor-resolution |  | {"id":"A-0005","turn":9,"minute":885,"action":"reconnaissance","outcome":"access-denied","sessionId":"S-20","copiedRecords":0,"totalExposedRecords":0} |

| TL-00150 | 14:50 / 10 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":10,"received":20,"processed":22,"backlog":24,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0019","minute":890} |

| TL-00151 | 14:55 / 11 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":11,"received":20,"processed":22,"backlog":22,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0020","minute":895} |

| TL-00152 | 15:00 / 12 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":12,"received":20,"processed":22,"backlog":20,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0021","minute":900} |

| TL-00153 | 15:05 / 13 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":13,"received":20,"processed":22,"backlog":18,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0022","minute":905} |

| TL-00154 | 15:10 / 14 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":14,"received":20,"processed":22,"backlog":16,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0023","minute":910} |

| TL-00155 | 15:15 / 15 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":15,"received":20,"processed":22,"backlog":14,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0024","minute":915} |

| TL-00156 | 15:20 / 16 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":16,"received":20,"processed":22,"backlog":12,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0025","minute":920} |

| TL-00157 | 15:25 / 17 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":17,"received":20,"processed":22,"backlog":10,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0026","minute":925} |

| TL-00158 | 15:30 / 18 | business-report / recorded | engine.history / interval-settlement |  | {"kind":"business-report","report":{"turn":18,"received":20,"processed":22,"backlog":8,"localAvailable":true,"remoteAvailable":true,"capacity":22,"status":"available"},"id":"E-0027","minute":930} |

| TL-00159 | 15:30 / 18 | simulation-finished / recorded | engine.history / finish |  | {"sourceEventId":"E-0028","businessGoalMet":true} |

## 6. Dowody i ograniczenia wiedzy

Katalog zawiera również dowody uzyskane później. Dla decyzji obowiązują **wyłącznie** wskazane w niej evidenceIds, nigdy cały katalog. Alert to sygnał, relacja człowieka to relacja; żadne z nich nie jest automatycznym potwierdzeniem sprawcy.

### K-AL-VPN-AL-vpn-auth-magazyn-07 — vpn-alert

Źródło: vpn-detector. Pozyskano: 14:00, tura 0, po komendzie 0. Rodzaj: signal. Zadanie: —.

- id: AL-vpn-auth-magazyn-07.
- minute: 840.
- ruleId: vpn-auth-failures.
- sensorId: vpn-auth.
- accountId: magazyn-07.
- windowStartMinute: 820.
- windowEndMinute: 840.
- failureCount: 52.
- assessment: requires-investigation.

### K-MSG-ewa-briefing — narrative-message

Źródło: Ewa. Pozyskano: 14:00, tura 0, po komendzie 0. Rodzaj: message. Zadanie: —.

- id: ewa-briefing.
- minute: 840.
- speaker: Ewa.
- text: Do 15:30 musimy zamknąć wysyłki. Zdalni dyspozytorzy potrzebują ERP. Mamy sygnał nietypowych logowań VPN. Ustal, co się dzieje, i zabezpiecz dane. Jeśli odetniesz ludzi, potrzebuję planu przywrócenia pracy..
- source: briefing.
- referenceId: mission-briefing.

### K-MSG-msg-T-0001 — narrative-message

Źródło: Bartek. Pozyskano: 14:05, tura 1, po komendzie 2. Rodzaj: message. Zadanie: —.

- id: msg-T-0001.
- speaker: Bartek.
- text: Wyłączyłem VPN i zakończyłem aktywne tunele. Zdalni dyspozytorzy utracili dostęp..
- source: configuration.
- referenceId: T-0001.
- minute: 845.

### K-MSG-ewa-queue — narrative-message

Źródło: Ewa. Pozyskano: 14:10, tura 2, po komendzie 4. Rodzaj: message. Zadanie: —.

- id: ewa-queue.
- speaker: Ewa.
- text: Zdalni dyspozytorzy nie mogą pracować w ERP. Kolejka rośnie. Potrzebujemy planu przywrócenia dostępu..
- source: business.
- referenceId: E-0006.
- minute: 850.

### K-MSG-msg-T-0002 — narrative-message

Źródło: Bartek. Pozyskano: 14:15, tura 3, po komendzie 5. Rodzaj: message. Zadanie: —.

- id: msg-T-0002.
- speaker: Bartek.
- text: Reguła R-SMB ma teraz decyzję DENY. Potwierdzam zmianę konfiguracji, nie wynik incydentu..
- source: configuration.
- referenceId: T-0002.
- minute: 855.

### K-MSG-msg-T-0003 — narrative-message

Źródło: Bartek. Pozyskano: 14:20, tura 4, po komendzie 7. Rodzaj: message. Zadanie: —.

- id: msg-T-0003.
- speaker: Bartek.
- text: Brama VPN jest ponownie dostępna. Zakończone tunele nie zostały przywrócone..
- source: configuration.
- referenceId: T-0003.
- minute: 860.

### K-MSG-ewa-restored — narrative-message

Źródło: Ewa. Pozyskano: 14:20, tura 4, po komendzie 7. Rodzaj: message. Zadanie: —.

- id: ewa-restored.
- speaker: Ewa.
- text: Zdalna obsługa ERP wróciła. Zespół może stopniowo nadrabiać kolejkę..
- source: business.
- referenceId: remote-restored.
- minute: 860.

## 7. Skutki techniczne

Wykradzione rekordy: 0. Stan końcowy:

Wydajność: **22 zamówień/turę**; wykradzione rekordy: **0**.

Aktywne nieuprawnione tunele: S-20. Tunele z dostępem do celu: brak. Skradzione poświadczenie nadal aktualne: tak. Nowe uwierzytelnienie możliwe: tak. Dostęp do celu po nowym uwierzytelnieniu: nie.

Konta (prawda po misji):

- magazyn-07: enabled, credentialVersion=1, MFA=not-required.
- dispatch-team: enabled, credentialVersion=1, MFA=not-required.

Sesje (prawda po misji):

- S-19 / magazyn-07: terminated, pochodzenie unauthorized; 13:58–16:00.
- B-01 / dispatch-team: terminated, pochodzenie legitimate; 14:00–16:00.
- B-reconnect-04 / dispatch-team: active, pochodzenie legitimate; 14:20–16:20.
- S-20 / magazyn-07: active, pochodzenie unauthorized; 14:20–16:20.

Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):

- S-19 → erp/HTTPS: odmowa.
- S-19 → fs-01/SMB: odmowa.
- B-01 → erp/HTTPS: odmowa.
- B-01 → fs-01/SMB: odmowa.
- B-reconnect-04 → erp/HTTPS: dopuszczony.
- B-reconnect-04 → fs-01/SMB: odmowa.
- S-20 → erp/HTTPS: odmowa.
- S-20 → fs-01/SMB: odmowa.

Brak modelu integralności kopii w tej misji.

Rzeczywiste wykorzystanie inwestycji:

- mfaRefusals: 0.
- fileObservationCount: 0.

## 8. Skutki biznesowe

Wpłynęło **360**; obsłużono **352**; zaległe **8**; szczyt kolejki **36**. Nie przeliczamy zamówień na straty w PLN.

| Tura / przedział | Wydajność | Wpłynęło | Obsłużono | Zaległe |

| --- | ---: | ---: | ---: | ---: |

| 1 / 14:00–14:05 | 22 | 20 | 20 | 0 |

| 2 / 14:05–14:10 | 8 | 20 | 8 | 12 |

| 3 / 14:10–14:15 | 8 | 20 | 8 | 24 |

| 4 / 14:15–14:20 | 8 | 20 | 8 | 36 |

| 5 / 14:20–14:25 | 22 | 20 | 22 | 34 |

| 6 / 14:25–14:30 | 22 | 20 | 22 | 32 |

| 7 / 14:30–14:35 | 22 | 20 | 22 | 30 |

| 8 / 14:35–14:40 | 22 | 20 | 22 | 28 |

| 9 / 14:40–14:45 | 22 | 20 | 22 | 26 |

| 10 / 14:45–14:50 | 22 | 20 | 22 | 24 |

| 11 / 14:50–14:55 | 22 | 20 | 22 | 22 |

| 12 / 14:55–15:00 | 22 | 20 | 22 | 20 |

| 13 / 15:00–15:05 | 22 | 20 | 22 | 18 |

| 14 / 15:05–15:10 | 22 | 20 | 22 | 16 |

| 15 / 15:10–15:15 | 22 | 20 | 22 | 14 |

| 16 / 15:15–15:20 | 22 | 20 | 22 | 12 |

| 17 / 15:20–15:25 | 22 | 20 | 22 | 10 |

| 18 / 15:25–15:30 | 22 | 20 | 22 | 8 |

Zmiany przepustowości (rozliczany przedział używa konfiguracji sprzed efektów na jego końcu):

- 14:00–14:05: początek → 22 zamówień/turę.

- 14:05–14:10: 22 → 8 zamówień/turę.

- 14:20–14:25: 8 → 22 zamówień/turę.

## 9. Faktyczna przyczyna

Przeciwnik użył wcześniej przejętego poświadczenia i uzyskał S-19 o 13:58. Błędy logowania uzasadniały alert, lecz nie dowodziły sposobu zdobycia hasła. Marta zaprzeczyła uruchomieniu sesji. Istniejący tunel zachowywał dostęp mimo blokady nowych logowań lub resetu.

Rzeczywiste logowania (również prelude sprzed początku misji):

- id: AUTH-0001.
- minute: 820.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0002.
- minute: 820.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0003.
- minute: 820.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0004.
- minute: 821.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0005.
- minute: 821.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0006.
- minute: 821.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0007.
- minute: 822.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0008.
- minute: 822.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0009.
- minute: 822.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0010.
- minute: 823.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0011.
- minute: 823.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0012.
- minute: 823.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0013.
- minute: 824.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0014.
- minute: 824.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0015.
- minute: 824.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0016.
- minute: 825.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0017.
- minute: 825.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0018.
- minute: 825.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0019.
- minute: 826.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0020.
- minute: 826.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0021.
- minute: 826.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0022.
- minute: 827.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0023.
- minute: 827.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0024.
- minute: 827.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0025.
- minute: 828.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0026.
- minute: 828.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0027.
- minute: 828.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0028.
- minute: 829.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0029.
- minute: 829.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0030.
- minute: 829.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0031.
- minute: 830.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0032.
- minute: 830.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0033.
- minute: 830.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0034.
- minute: 831.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0035.
- minute: 831.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0036.
- minute: 831.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0037.
- minute: 832.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0038.
- minute: 832.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0039.
- minute: 832.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0040.
- minute: 833.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0041.
- minute: 833.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0042.
- minute: 833.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0043.
- minute: 834.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0044.
- minute: 834.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0045.
- minute: 834.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0046.
- minute: 835.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0047.
- minute: 835.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0048.
- minute: 835.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0049.
- minute: 836.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0050.
- minute: 836.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0051.
- minute: 836.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0052.
- minute: 837.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: failure.
- sessionId: —.

- id: AUTH-0053.
- minute: 838.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: success.
- sessionId: S-19.

- id: AUTH-0054.
- minute: 840.
- sourceAssetId: vpn.
- accountId: dispatch-team.
- outcome: success.
- sessionId: B-01.

- id: AUTH-0055.
- minute: 860.
- sourceAssetId: vpn.
- accountId: dispatch-team.
- outcome: success.
- sessionId: B-reconnect-04.

- id: AUTH-0056.
- minute: 860.
- sourceAssetId: vpn.
- accountId: magazyn-07.
- outcome: success.
- sessionId: S-20.

Modelowane źródło VPN i posiadany materiał uwierzytelniający:

- accountId: magazyn-07.
- stolenCredentialVersion: 1.
- gatewayAssetId: vpn.
- targetAssetId: fs-01.
- protocol: SMB.
- finalStatus: blocked.
- authenticationAttempts: 1.
- consecutiveFailures: 3.

Rzeczywiste działania źródła VPN:

- id: A-0001.
- turn: 2.
- minute: 850.
- action: reconnaissance.
- outcome: session-lost.
- sessionId: S-19.
- copiedRecords: 0.
- totalExposedRecords: 0.

- id: A-0002.
- turn: 4.
- minute: 860.
- action: authenticate.
- outcome: authentication-accepted.
- sessionId: S-20.
- copiedRecords: 0.
- totalExposedRecords: 0.

- id: A-0003.
- turn: 5.
- minute: 865.
- action: reconnaissance.
- outcome: access-denied.
- sessionId: S-20.
- copiedRecords: 0.
- totalExposedRecords: 0.

- id: A-0004.
- turn: 7.
- minute: 875.
- action: reconnaissance.
- outcome: access-denied.
- sessionId: S-20.
- copiedRecords: 0.
- totalExposedRecords: 0.

- id: A-0005.
- turn: 9.
- minute: 885.
- action: reconnaissance.
- outcome: access-denied.
- sessionId: S-20.
- copiedRecords: 0.
- totalExposedRecords: 0.

Rzeczywiste operacje lokalne:



Próby źródła modyfikacji lokalnych:



## 10. Pytania do analizy

1. Jakie dowody były dostępne przed każdą decyzją, a jakie dotarły później?

2. Które mechanizmy zmieniło działanie, a które pozostały aktywne?

3. Jak ograniczenie bezpieczeństwa wpłynęło na legalną pracę?

4. Jak sprawdzono wynik odzyskiwania i trwałość ograniczenia?

5. Jakich danych lub kontrolowanego replay potrzeba do porównania alternatywy?

## 11. Kontekst powtórki

- mode: unknown.
- seed: 0.
- scenarioId: nexus-reference.
- requiresCampaignPreparation: false.
- campaignMissionId: —.
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
