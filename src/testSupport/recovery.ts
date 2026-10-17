import { createStrategicSession } from '../application/gameSession';
import type { StrategicSession } from '../application/gameSession';
import { campaign, prepare, finish, startM02, sessionDate } from './aar';
export function recoveryHeadquarters(seed = 0): StrategicSession {
  let g = createStrategicSession('recovery-campaign', sessionDate, seed);
  g = campaign(
    finish(
      campaign(prepare(g), { type: 'start-incident' }),
    ) as StrategicSession,
    { type: 'return-headquarters' },
  );
  g = campaign(finish(startM02(g)) as StrategicSession, {
    type: 'return-headquarters',
  });
  return campaign(
    finish(
      campaign(prepare(g), {
        type: 'start-vendor-incident',
        familyId: 'nexus-vendor-access-v1',
      }),
    ) as StrategicSession,
    { type: 'return-headquarters' },
  );
}
export const startRecovery = (s = recoveryHeadquarters()) =>
  campaign(prepare(s), {
    type: 'start-recovery-incident',
    familyId: 'nexus-erp-recovery-v1',
  });
