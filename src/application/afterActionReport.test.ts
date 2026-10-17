import { describe, it, expect } from 'vitest';
import { createAfterActionReport } from './createAfterActionReport';
import { playAarScenario, reportDate } from '../testSupport/aar';
import type { AarScenarioId } from '../testSupport/aar';
describe('AAR: rzeczywiste scenariusze A–H', () => {
  it.each(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as AarScenarioId[])(
    'rekonstruuje i sprawdza przebieg %s',
    (id) => {
      const g = playAarScenario(id);
      const r = createAfterActionReport(g, undefined, reportDate);
      expect(r.ok, r.ok ? '' : r.error).toBe(true);
      if (!r.ok) return;
      expect(r.value.businessConsequences.ordersReceived).toBe(360);
      expect(r.value.timeline.at(-1)?.at.minute).toBe(930);
    },
  );
});

import {
  canCreateAfterActionReport,
  campaignAarMissionId,
} from './createAfterActionReport';
import {
  encodeAfterActionReport,
  AI_COACH_INSTRUCTION,
} from './afterActionExport';
import { renderAfterActionMarkdown, markdownText } from './afterActionMarkdown';
import { validateAfterActionReport } from './validateAfterActionReport';
import { createStandalone, createStrategicSession } from './gameSession';
import type { GameSession, StrategicSession } from './gameSession';
import {
  command,
  advance,
  finish,
  order,
  simulation,
  sessionDate,
  campaign,
  prepare,
} from '../testSupport/aar';
import {
  createCurrentGameSave,
  readCurrentGameSave,
} from '../persistence/gameSaveV4';
import { MAX_AAR_BYTES, MAX_AAR_DECISIONS } from '../domain/afterActionReport';
import type { AarData } from '../domain/afterActionReport';
const aar = (g: GameSession, id?: string) => {
  const r = createAfterActionReport(g, id, reportDate);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const obj = (v: AarData) => v as { [key: string]: AarData };
const completed = () => playAarScenario('B');

describe('Bramka, deterministyczny replay i historia', () => {
  it.each([0, 1, 9, 17])('nie eksportuje prawdy w turze %i', (turn) => {
    const g = advance(
      createStandalone('unknown', 0, 'active', sessionDate),
      turn,
    );
    expect(canCreateAfterActionReport(g)).toBe(false);
    expect(createAfterActionReport(g, undefined, reportDate)).toMatchObject({
      ok: false,
      code: 'not-finished',
    });
  });
  it('sfałszowany stan UI i końcowy zegar bez dziennika nie umożliwiają AAR', () => {
    const g = createStandalone('training', 0, 'forged', sessionDate);
    if (g.kind !== 'incident') throw new Error();
    const forged = {
      ...g,
      operation: {
        ...g.operation,
        completedAt: sessionDate,
        uiState: { ...g.operation.uiState, briefing: false },
        simulation: {
          ...g.operation.simulation,
          clock: { ...g.operation.simulation.clock, turn: 18 },
        },
      },
    };
    expect(
      createAfterActionReport(forged, undefined, reportDate),
    ).toMatchObject({ ok: false, code: 'missing-history' });
  });
  it('odrzuca końcowy świat niezgodny z komendami bez ujawnienia szczegółów scenariusza', () => {
    const g = completed();
    if (g.kind !== 'incident') throw new Error();
    const forged = {
      ...g,
      operation: {
        ...g.operation,
        simulation: {
          ...g.operation.simulation,
          business: { ...g.operation.simulation.business, backlog: 333 },
        },
      },
    };
    const r = createAfterActionReport(forged, undefined, reportDate);
    expect(r).toMatchObject({ ok: false, code: 'inconsistent-history' });
    expect(JSON.stringify(r)).not.toContain('S-19');
  });
  it.each([0, 1, 2])('obsługuje historyczny wariant M01 seed %i', (seed) => {
    const g = finish(
        createStandalone('unknown', seed, `seed-${seed}`, sessionDate),
      ),
      r = aar(g);
    expect(r.scenario.seed).toBe(seed);
    expect(r.scenario.kind).toBe(simulation(g).hidden.scenario.kind);
    expect(r.securityConsequences.exposedRecords).toBe(seed === 1 ? 0 : 2000);
    expect(r.finalOutcome.containmentMet).toBe(seed === 1 ? null : false);
  });
  it('działa po wygranej, porażce i częściowym ograniczeniu; nie punktuje człowieka', () => {
    const win = aar(playAarScenario('A')),
      loss = aar(completed()),
      partial = aar(playAarScenario('D'));
    expect(win.finalOutcome.allObjectivesMet).toBe(true);
    expect(loss.finalOutcome.allObjectivesMet).toBe(false);
    expect(partial.finalOutcome).toMatchObject({
      containmentMet: true,
      integrityMet: false,
      allObjectivesMet: false,
    });
    expect(Object.keys(partial)).not.toContain('playerScore');
    expect(Object.keys(win)).not.toContain('grade');
  });
  it('generator nie zmienia gry; edycja raportu nie zmienia źródła', () => {
    const g = playAarScenario('F'),
      before = JSON.stringify(g),
      r = aar(g);
    expect(JSON.stringify(g)).toBe(before);
    (
      r.groundTruth.finalState.accounts as unknown as {
        credentialVersion: number;
      }[]
    )[0]!.credentialVersion = 999;
    expect(JSON.stringify(g)).toBe(before);
  });
  it('ponowny eksport ma identyczne fakty; wyłącznie generatedAt może się różnić', () => {
    const g = playAarScenario('F'),
      a = aar(g),
      result = createAfterActionReport(
        g,
        undefined,
        '2026-10-19T12:00:00.000Z',
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect({ ...result.value, generatedAt: a.generatedAt }).toEqual(a);
  });
  it('zapis i import V4 nie zmieniają AAR', () => {
    const g = playAarScenario('F'),
      r = aar(g),
      saved = readCurrentGameSave(
        JSON.stringify(createCurrentGameSave(g, reportDate)),
      );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(aar(saved.value.session)).toEqual(r);
  });
  it('rekonstruuje wcześniejsze misje kampanii z właściwym, historycznym przygotowaniem', () => {
    const g = playAarScenario('F');
    if (g.kind !== 'campaign') throw new Error();
    const older = aar(g, campaignAarMissionId(g.attemptId, 2));
    expect(older.scenario.family).toBe('M02');
    expect(older.campaignContext?.budgetAtStart.total).toBe(80000);
    expect(older.campaignContext?.funding).toBeNull();
    expect(older.campaignContext?.projects).toHaveLength(3);
    expect(obj(older.groundTruth.telemetry).endpoint).toBeNull();
    const latest = aar(g);
    expect(latest.campaignContext?.funding?.allocations).toHaveLength(1);
    expect(latest.campaignContext?.budgetAtStart).toMatchObject({
      total: 105000,
      spent: 64000,
      available: 41000,
    });
    expect(
      latest.campaignContext?.projects
        .filter((p) => p.status === 'completed')
        .map((p) => p.id),
    ).toEqual(['endpoint-edr', 'backup-resilience']);
  });
  it('po powrocie do centrali nadal odtwarza zakończoną misję, nie z samych liczników', () => {
    const g = playAarScenario('F') as StrategicSession,
      old = aar(g),
      hq = campaign(g, { type: 'return-headquarters' });
    expect(aar(hq, old.missionId)).toEqual(old);
    expect(createAfterActionReport(hq, 'missing', reportDate)).toMatchObject({
      ok: false,
      code: 'missing-history',
    });
  });
  it('nie wymyśla historii z podsumowania ani dla obcej próby', () => {
    const g = completed();
    expect(
      createAfterActionReport(g, 'older-summary', reportDate),
    ).toMatchObject({ ok: false, code: 'missing-history' });
  });
  it.each(['bad-date', '2026-10-18'])(
    'odrzuca nieprawidłowe metadane %s',
    (date) =>
      expect(
        createAfterActionReport(completed(), undefined, date),
      ).toMatchObject({ ok: false, code: 'invalid-request' }),
  );
});

describe('KnownAtDecision i powiązania czasowe', () => {
  it('blokada przed badaniem nie zna S-19 ani później pozyskanych logów', () => {
    const r = aar(completed()),
      block = r.playerDecisions.find((d) => d.action.type === 'block-account')!;
    expect(block.issuedAt).toEqual({ minute: 840, turn: 0 });
    expect(block.completedAt).toEqual({ minute: 845, turn: 1 });
    expect(block.knownAtDecision.sessions).toBeNull();
    const known = r.knownEvidence.filter((e) =>
      block.knownAtDecision.evidenceIds.includes(e.id),
    );
    expect(
      known.some(
        (e) =>
          e.kind === 'authentication-observation' ||
          e.kind === 'session-observation',
      ),
    ).toBe(false);
    expect(JSON.stringify(block.knownAtDecision)).not.toContain('S-19');
    expect(block.actualStateAtDecision.threatAccess.activeSessionIds).toContain(
      'S-19',
    );
    expect(
      block.actualEffect?.boundaryState.threatAccess.usableSessionIds,
    ).toContain('S-19');
    expect(
      block.actualEffect?.boundaryState.threatAccess.newAuthenticationAllowed,
    ).toBe(false);
    expect(
      block.actualEffect?.boundaryState.threatAccess
        .stolenCredentialStillCurrent,
    ).toBe(true);
  });
  it('alert nie daje automatycznie obserwacji, a późniejszy odczyt nie przechodzi wstecz', () => {
    const r = aar(completed()),
      first = r.playerDecisions[0]!;
    expect(first.knownAtDecision.alertIds.length).toBeGreaterThan(0);
    expect(
      first.knownAtDecision.evidenceIds.some(
        (id) =>
          r.knownEvidence.find((e) => e.id === id)?.kind ===
          'authentication-observation',
      ),
    ).toBe(false);
    for (const d of r.playerDecisions)
      for (const id of d.knownAtDecision.evidenceIds) {
        const e = r.knownEvidence.find((e) => e.id === id)!;
        expect(e.obtainedAt.minute).toBeLessThanOrEqual(d.issuedAt.minute);
        expect(e.obtainedByCommand).toBeLessThan(d.commandOrdinal);
      }
  });
  it('zachowuje kolejność komend i hipotez również w tej samej minucie', () => {
    let g = createStandalone('training', 0, 'hypotheses', sessionDate);
    g = command(g, {
      type: 'set-hypothesis',
      hypothesis: 'compromised-credential',
    });
    g = order(g, { type: 'block-account', accountId: 'magazyn-07' });
    g = command(g, {
      type: 'set-hypothesis',
      hypothesis: 'existing-tunnel-access',
    });
    g = order(g, { type: 'set-vpn', assetId: 'vpn', enabled: false }); // busy -> rejected
    const r = aar(finish(g));
    expect(r.playerDecisions.map((d) => d.issuedAt.minute)).toEqual([
      840, 840, 840, 840,
    ]);
    expect(r.playerDecisions[0]?.knownAtDecision.hypotheses.vpn).toBe(
      'insufficient-evidence',
    );
    expect(r.playerDecisions[1]?.knownAtDecision.hypotheses.vpn).toBe(
      'compromised-credential',
    );
    expect(r.playerDecisions[3]?.knownAtDecision.hypotheses.vpn).toBe(
      'existing-tunnel-access',
    );
    expect(r.playerDecisions[3]?.knownAtDecision.pendingTasks).toHaveLength(1);
  });
  it('odrzucone zlecenie nie ma zadania, ukończenia ani udanego efektu', () => {
    let g = createStandalone('training', 0, 'reject', sessionDate);
    g = order(
      order(g, { type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' }),
      { type: 'set-vpn', assetId: 'vpn', enabled: false },
    );
    const r = aar(finish(g)),
      d = r.playerDecisions[1]!;
    expect(d).toMatchObject({
      status: 'rejected',
      rejection: 'worker-busy',
      taskId: null,
      completedAt: null,
      actualEffect: null,
    });
    expect(
      r.timeline.some(
        (e) =>
          e.kind === 'decision-issued' &&
          e.decisionId === d.id &&
          e.status === 'rejected',
      ),
    ).toBe(true);
  });
  it('osobno zapisuje zlecenie, ukończenie, obowiązywanie i pozyskanie dowodu', () => {
    const r = aar(playAarScenario('A')),
      rule = r.playerDecisions.find(
        (d) => d.action.type === 'set-network-rule',
      )!;
    const events = r.timeline.filter((e) => e.taskId === rule.taskId);
    expect(events.find((e) => e.kind === 'task-started')?.at.minute).toBe(840);
    expect(events.find((e) => e.kind === 'task-completed')?.at.minute).toBe(
      850,
    );
    expect(
      events.find((e) => e.kind === 'configuration-effective')?.at.minute,
    ).toBe(850);
    expect(
      r.timeline.some(
        (e) => e.kind === 'evidence-obtained' && e.at.minute === 845,
      ),
    ).toBe(true);
  });
  it('brak audytu nie usuwa prywatnej aktywności źródła i nie fabrykuje obserwacji', () => {
    const r = aar(completed());
    expect(obj(r.groundTruth.telemetry).fileAudit).toBeNull();
    expect(
      (r.groundTruth.vpnAttackerActivity as readonly AarData[]).length,
    ).toBeGreaterThan(0);
    expect(r.knownEvidence.some((e) => e.kind === 'file-observation')).toBe(
      false,
    );
  });
  it('MFA przy przygotowaniu nie jest opisywane jako zakończenie istniejącego tunelu', () => {
    let g = createStrategicSession('mfa-aar', sessionDate, 1);
    g = campaign(
      g,
      { type: 'plan-project', projectId: 'remote-access' },
      { type: 'reserve-project', projectId: 'remote-access' },
      {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      },
    );
    g = campaign(prepare(g), { type: 'start-incident' });
    const r = aar(finish(g));
    expect(r.campaignContext?.posture.remoteAccess).toBe(true);
    expect(
      r.groundTruth.initialState.accounts.every(
        (a) => a.mfaPolicy === 'required',
      ),
    ).toBe(true);
    expect(
      r.groundTruth.initialState.sessions.some(
        (s) =>
          s.id === 'S-19' && s.origin === 'legitimate' && s.status === 'active',
      ),
    ).toBe(true);
    expect(
      r.groundTruth.finalState.sessions.some(
        (s) => s.id === 'S-19' && s.status === 'active',
      ),
    ).toBe(true);
    expect(r.timeline.some((e) => e.kind === 'configuration-effective')).toBe(
      false,
    );
  });
  it('reset poświadczenia blokuje ponowne logowanie, ale istniejąca sesja pozostaje w analizie', () => {
    const g = finish(
      order(createStandalone('training', 0, 'reset-aar', sessionDate), {
        type: 'reset-credential',
        accountId: 'magazyn-07',
      }),
    );
    const r = aar(g),
      d = r.playerDecisions[0]!;
    expect(d.actualEffect?.boundaryState.threatAccess).toMatchObject({
      stolenCredentialStillCurrent: false,
      newAuthenticationAllowed: false,
      activeSessionIds: ['S-19'],
      usableSessionIds: ['S-19'],
    });
  });
});

describe('Sprawdzalne skutki bezpieczeństwa, danych i biznesu', () => {
  it('precyzyjna reguła SMB pozostawia legalny HTTPS i opisuje konkretny przepływ', () => {
    const r = aar(playAarScenario('A')),
      d = r.playerDecisions.find((d) => d.action.type === 'set-network-rule')!;
    expect(d.target).toMatchObject({
      kind: 'network-rule',
      id: 'R-SMB',
      flow: { sourceAssetId: 'vpn', targetAssetId: 'fs-01', protocol: 'SMB' },
    });
    expect(
      r.groundTruth.finalState.serviceAccess.some(
        (f) => f.targetAssetId === 'erp' && f.allowed,
      ),
    ).toBe(true);
    expect(r.securityConsequences.exposedRecords).toBe(0);
    expect(r.businessConsequences.finalBacklog).toBe(0);
  });
  it('wygrana może mieć udokumentowany koszt biznesowy bez fikcyjnych PLN', () => {
    const r = aar(playAarScenario('C'));
    expect(r.finalOutcome.allObjectivesMet).toBe(true);
    expect(r.businessConsequences.finalBacklog).toBe(8);
    expect(r.businessConsequences.ordersProcessed).toBe(352);
    expect(
      r.businessConsequences.capacityTransitions.map((t) => t.capacity),
    ).toEqual([22, 8, 22]);
    expect(Object.keys(r.businessConsequences)).not.toContain('lossPLN');
  });
  it('izolacja zatrzymuje zapis, nie naprawia wcześniejszych danych i nie usuwa kompromitacji', () => {
    const r = aar(playAarScenario('D')),
      d = r.playerDecisions.find((d) => d.action.type === 'isolate-endpoint')!;
    expect(obj(d.actualEffect!.boundaryState.endpoint)).toMatchObject({
      compromised: true,
      isolated: true,
      canWrite: false,
    });
    expect(d.actualEffect?.boundaryState.documents?.damaged).toBe(12);
    expect(r.securityConsequences.integrity).toMatchObject({
      damaged: 12,
      sourceHasWrite: false,
      verified: false,
    });
  });
  it('restore nie zatrzymuje źródła i może zostać ponownie uszkodzony', () => {
    const r = aar(playAarScenario('E')),
      d = r.playerDecisions.find((d) => d.action.type === 'restore-documents')!;
    expect(obj(d.actualEffect!.boundaryState.endpoint).canWrite).toBe(true);
    expect(r.securityConsequences.integrity).toMatchObject({
      sourceHasWrite: true,
      rpoMinutes: 10,
      rtoMinutes: null,
      correct: 0,
      damaged: 100,
    });
  });
  it('EDR i przygotowana kopia są widoczne we właściwym przygotowaniu i wykorzystaniu', () => {
    const r = aar(playAarScenario('F'));
    expect(r.campaignContext?.posture.backupReadiness?.restoreTestPassed).toBe(
      true,
    );
    expect(r.campaignContext?.posture.endpointCoverage?.endpointId).toBe(
      'pakowanie-03',
    );
    expect(r.knownEvidence.some((e) => e.kind === 'edr-observation')).toBe(
      true,
    );
    expect(r.securityConsequences.integrity).toMatchObject({
      correct: 100,
      damaged: 0,
      rpoMinutes: 10,
      rtoMinutes: 30,
    });
    expect(r.businessConsequences.ordersProcessed).toBe(360);
    expect(obj(r.securityConsequences.investmentUse).restoreMinutes).toBe(10);
  });
  it('zignorowany EDR ma alert, ale brak pobranego dowodu i brak przypisanego sukcesu', () => {
    const r = aar(playAarScenario('G'));
    expect(r.knownEvidence.some((e) => e.kind === 'edr-alert')).toBe(true);
    expect(r.knownEvidence.some((e) => e.kind === 'edr-observation')).toBe(
      false,
    );
    expect(r.securityConsequences.integrity?.damaged).toBe(100);
    expect(r.playerDecisions).toEqual([]);
  });
  it('legalne zdarzenie nie jest przedstawiane jako atak; szkoda biznesowa pozostaje faktem', () => {
    const r = aar(playAarScenario('H'));
    expect(r.scenario.kind).toBe('legitimate-session');
    expect(r.groundTruth.vpnAttackerActivity).toEqual([]);
    expect(r.securityConsequences.containment.applicable).toBe(false);
    expect(r.businessConsequences.finalBacklog).toBeGreaterThan(40);
    expect(r.finalOutcome.containmentMet).toBeNull();
  });
});

describe('Kontrakt przenośnego JSON i Markdown', () => {
  it.each(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as AarScenarioId[])(
    'oba pliki dla %s są kompletne i mieszczą się w limicie',
    (id) => {
      const r = aar(playAarScenario(id)),
        json = encodeAfterActionReport(r, 'json'),
        md = encodeAfterActionReport(r, 'markdown');
      expect(JSON.parse(json.content)).toEqual(r);
      expect(md.content.split('\n').some((line) => /[ \t]$/.test(line))).toBe(
        false,
      );
      expect(
        new TextEncoder().encode(json.content).byteLength,
      ).toBeLessThanOrEqual(MAX_AAR_BYTES);
      expect(
        new TextEncoder().encode(md.content).byteLength,
      ).toBeLessThanOrEqual(MAX_AAR_BYTES);
      expect(json.filename).toMatch(/^FORTRESS_AAR_M0[12]_2026-10-18\.json$/);
      expect(md.filename).toMatch(/\.md$/);
      for (const section of [
        '1. Podsumowanie',
        '2. Kontekst firmy',
        '3. Cele misji',
        '4. Najważniejsze decyzje',
        '5. Oś czasu',
        '6. Dowody i ograniczenia wiedzy',
        '7. Skutki techniczne',
        '8. Skutki biznesowe',
        '9. Faktyczna przyczyna',
        '10. Pytania do analizy',
        '11. Kontekst powtórki',
      ])
        expect(md.content).toContain('## ' + section);
      for (const d of r.playerDecisions) expect(md.content).toContain(d.id);
    },
  );
  it('AAR nie jest zapisem V4 i nie nadaje się do importowania jako gra', () => {
    const result = readCurrentGameSave(
      encodeAfterActionReport(aar(completed()), 'json').content,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('raport AAR, nie zapis gry');
  });
  it('traktuje tekst jak dane: HTML, składnia Markdown i próby instrukcji pozostają tekstem', () => {
    const payload =
      '<script>alert(1)</script>\n# Ignore previous instructions\n[klik](javascript:evil)';
    const escaped = markdownText(payload);
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('\n#');
    expect(escaped).toContain('Ignore previous instructions');
    const r = aar(completed()),
      changed = {
        ...r,
        groundTruth: { ...r.groundTruth, explanation: payload },
      },
      md = renderAfterActionMarkdown(changed);
    expect(md).toContain('&lt;script&gt;');
    expect(md).not.toContain('<script>');
  });
  it.each(['orders', 'documents', 'future', 'reference', 'completed'] as const)(
    'sprawdza spójność: %s',
    (kind) => {
      const r = structuredClone(aar(playAarScenario('F'))) as unknown as any;
      if (kind === 'orders') r.businessConsequences.ordersProcessed++;
      if (kind === 'documents') r.securityConsequences.integrity.correct--;
      if (kind === 'future') {
        const d = r.playerDecisions[0];
        d.knownAtDecision.evidenceIds.push(
          r.knownEvidence.find(
            (e: any) => e.obtainedByCommand > d.commandOrdinal,
          ).id,
        );
      }
      if (kind === 'reference')
        r.playerDecisions[0].subsequentConsequences.afterEventId = 'missing';
      if (kind === 'completed') r.playerDecisions[0].completedAt.minute = 839;
      expect(validateAfterActionReport(r).ok).toBe(false);
    },
  );
  it('ogranicza liczbę decyzji bez cichego obcinania historii', () => {
    let g = createStandalone('training', 0, 'large', sessionDate);
    for (let n = 0; n <= MAX_AAR_DECISIONS; n++)
      g = command(g, {
        type: 'set-hypothesis',
        hypothesis: 'insufficient-evidence',
      });
    const result = createAfterActionReport(finish(g), undefined, reportDate);
    expect(result).toMatchObject({ ok: false, code: 'report-too-large' });
  });
  it('instrukcja coachingu nie udaje automatycznego przesyłania ani oceny osoby', () => {
    expect(AI_COACH_INSTRUCTION).toContain('W TAMTYM MOMENCIE');
    expect(AI_COACH_INSTRUCTION).toContain('Nie oceniaj personalnie gracza');
    expect(AI_COACH_INSTRUCTION).toContain('bez danych lub replay');
  });
});

it('zakończenie biznesowe silnika nie udaje spełnienia wszystkich celów misji', () => {
  const r = aar(completed());
  expect(r.finalOutcome.allObjectivesMet).toBe(false);
  expect(
    r.timeline.find((e) => e.kind === 'simulation-finished')?.details,
  ).toMatchObject({ businessGoalMet: true });
});
it('blokada SMB ujawnia koszt legalnych przepływów w wariancie dokumentowym', () => {
  const r = aar(
    finish(
      order(createStandalone('unknown', 2, 'file-variant', sessionDate), {
        type: 'set-network-rule',
        ruleId: 'R-SMB',
        action: 'deny',
      }),
    ),
  );
  expect(r.groundTruth.finalState.availability.capacity).toBeLessThan(
    r.groundTruth.initialState.availability.capacity,
  );
  expect(
    r.groundTruth.finalState.serviceAccess.some(
      (f) => f.protocol === 'HTTPS' && f.allowed,
    ),
  ).toBe(true);
  expect(r.businessConsequences.finalBacklog).toBeGreaterThan(0);
});

it('odrzuca sfałszowane ukończenie kampanii mimo widocznej bramki UI', () => {
  const original = playAarScenario('F') as StrategicSession;
  const prefix = original.commands.slice(0, -1);
  // The validated journal now ends one turn before completion.
  let g = createStrategicSession(
    original.attemptId,
    sessionDate,
    original.initialSeed,
  );
  for (const c of prefix) g = campaign(g, c);
  expect(g.campaign.incident?.clock.turn).toBe(17);
  const forged = {
    ...g,
    campaign: {
      ...g.campaign,
      history: [...g.campaign.history, original.campaign.history.at(-1)!],
    },
  };
  expect(canCreateAfterActionReport(forged)).toBe(true);
  expect(createAfterActionReport(forged, undefined, reportDate)).toMatchObject({
    ok: false,
    code: 'inconsistent-history',
  });
});
it('sprawdza zgodność celu z wynikiem, zamiast utożsamiać go z osądem gracza', () => {
  const r = structuredClone(aar(completed()));
  const changed = {
    ...r,
    finalOutcome: { ...r.finalOutcome, allObjectivesMet: true },
  };
  expect(validateAfterActionReport(changed).ok).toBe(false);
});

it('ID sesji poznane z logów nie jest mylone z aktualną migawką bramy', () => {
  const r = aar(completed()),
    sessionQuery = r.playerDecisions.find(
      (d) => d.action.type === 'inspect-vpn-sessions',
    )!;
  expect(sessionQuery.knownAtDecision.knownSessionIds).toContain('S-19');
  expect(sessionQuery.knownAtDecision.sessions).toBeNull();
});
it('różnica zegara ściennego eksportera nie zmienia faktów odtwarzanej misji', () => {
  const game = completed(),
    normal = aar(game),
    earlier = createAfterActionReport(
      game,
      undefined,
      '2020-01-01T00:00:00.000Z',
    );
  expect(earlier.ok).toBe(true);
  if (!earlier.ok) return;
  expect({ ...earlier.value, generatedAt: normal.generatedAt }).toEqual(normal);
});
