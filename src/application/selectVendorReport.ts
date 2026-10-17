import type { SimulationState } from '../domain/simulation';
import { canUseService, isSessionActive } from '../simulation/access';
import { currentMinute, isFinished } from '../simulation/clock';
import { isBusinessGoalMet } from '../simulation/business';
import { assessThreatAccess } from '../simulation/threatAssessment';
/** Reveals private origin/requirements only at mission end. Same engine, no counterfactuals. */
export function selectVendorReport(state: SimulationState) {
  const v = state.vendor,
    d = state.hidden.scenario.vendor,
    authorization = state.access.vendorAuthorization;
  if (!v || !d || !authorization || !isFinished(state.clock)) return null;
  const approved =
    state.hidden.scenario.access.vendorAuthorization?.exception ?? null;
  const minute = currentMinute(state.clock);
  const sessions = state.access.sessions
    .filter((s) => s.accountId === authorization.accountId)
    .map((s) => ({
      ...s,
      origin: state.hidden.sessionOrigins[s.id] ?? 'unclassified',
      active: isSessionActive(s, minute),
      apiAllowed: canUseService(
        state.world,
        state.access,
        s.id,
        'carrier-api',
        'HTTPS',
        minute,
      ),
      smbAllowed: canUseService(
        state.world,
        state.access,
        s.id,
        'fs-01',
        'SMB',
        minute,
      ),
    }));
  const exposedRecords = state.hidden.attacker?.transfer.exposedRecords ?? 0;
  const summary = {
    approvalId: approved?.approvalId ?? null,
    approvedScope: approved?.scope ?? null,
    expiresAtMinute: approved?.expiresAtMinute ?? null,
    finalException: authorization.exception,
    completedBatches: v.completedBatches,
    requiredBatches: d.requiredBatches,
    requiresFiles: d.requiresFiles,
    exposedRecords,
    unauthorizedAuthenticationAttempts:
      state.hidden.attacker?.authenticationAttempts ?? 0,
    expired: v.accessChanges.some((c) => c.kind === 'expired'),
    activeSessionCount: sessions.filter((s) => s.active).length,
    accessAfterDeadline: sessions.some((s) => s.apiAllowed || s.smbAllowed),
  };
  return {
    summary,
    approved,
    changes: v.accessChanges,
    authorizationIntervals: v.accessChanges.flatMap((c, index) =>
      c.exception.status === 'active'
        ? [
            {
              scope: c.exception.scope,
              startMinute: c.minute,
              endMinute: Math.min(
                c.exception.expiresAtMinute,
                v.accessChanges[index + 1]?.minute ?? minute,
              ),
            },
          ]
        : [],
    ),
    operations: v.operations,
    evidence: v.observations,
    sessions,
    threatAccess: assessThreatAccess(state),
    business: state.business,
    explanation: state.hidden.scenario.explanation,
    goalMet:
      v.completedBatches === d.requiredBatches &&
      isBusinessGoalMet(state) &&
      exposedRecords === 0 &&
      (!state.hidden.attacker || assessThreatAccess(state).targetAccessCutOff),
  };
}
export type VendorReport = NonNullable<ReturnType<typeof selectVendorReport>>;
