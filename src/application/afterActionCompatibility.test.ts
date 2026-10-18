import { it, expect } from 'vitest';
import activeV1 from '../persistence/fixtures/sprint6-active-v1.json?raw';
import legalV1 from '../persistence/fixtures/sprint6-legal-v1.json?raw';
import blockedV2 from '../persistence/fixtures/sprint7-blocked-v2.json?raw';
import recoveryV2 from '../persistence/fixtures/sprint7-recovery-v2.json?raw';
import hqV3 from '../persistence/fixtures/sprint8-headquarters-v3.json?raw';
import pendingV3 from '../persistence/fixtures/sprint8-restore-pending-v3.json?raw';
import pendingV4 from '../persistence/fixtures/sprint9-restore-pending-v4.json?raw';
import {
  readCurrentGameSave,
  createCurrentGameSave,
} from '../persistence/gameSaveV9';
import { createAfterActionReport } from './createAfterActionReport';
import { currentOperation, applyCampaignSession } from './gameSession';
import { applyOperationCommand } from './operationSession';
import { reportDate } from '../testSupport/aar';
import type { GameSession } from './gameSession';
function finishImported(g: GameSession) {
  if (g.kind === 'campaign' && g.campaign.phase === 'preparation')
    g = applyCampaignSession(
      g,
      { type: 'start-integrity-incident' },
      reportDate,
    );
  while (currentOperation(g)!.simulation.clock.turn < 18)
    g =
      g.kind === 'incident'
        ? {
            ...g,
            operation: applyOperationCommand(
              g.operation,
              { type: 'advance-turn' },
              reportDate,
            ),
          }
        : applyCampaignSession(
            g,
            { type: 'incident-command', command: { type: 'advance-turn' } },
            reportDate,
          );
  return g;
}
it.each([
  ['V1 active', activeV1],
  ['V1 legal', legalV1],
  ['V2 blocked', blockedV2],
  ['V2 recovery', recoveryV2],
  ['V3 HQ', hqV3],
  ['V3 restore', pendingV3],
  ['V4 restore', pendingV4],
])(
  'AAR po rzeczywistym %s, z zachowaniem świata i historycznego AAR',
  (_name, text) => {
    const loaded = readCurrentGameSave(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const before = JSON.stringify(loaded.value.session);
    const completed = finishImported(loaded.value.session);
    const aar = createAfterActionReport(completed, undefined, reportDate);
    expect(aar.ok, aar.ok ? '' : aar.error).toBe(true);
    expect(JSON.stringify(loaded.value.session)).toBe(before);
    expect(
      readCurrentGameSave(
        JSON.stringify(createCurrentGameSave(completed, reportDate)),
      ).ok,
    ).toBe(true);
    if (!aar.ok) return;
    expect(aar.value.businessConsequences.ordersProcessed).toBe(
      currentOperation(completed)!.simulation.business.totalProcessed,
    );
    expect(aar.value.businessConsequences.finalBacklog).toBe(
      currentOperation(completed)!.simulation.business.backlog,
    );
    if (_name === 'V4 restore')
      expect(aar.value.campaignContext?.funding?.allocations).toHaveLength(1);
  },
);
