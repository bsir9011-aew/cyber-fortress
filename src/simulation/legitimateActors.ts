import type { SimulationState } from '../domain/simulation';
import { isSessionActive, issueVpnSession } from './access';
import { currentMinute } from './clock';
import { recordAuthentication } from './telemetry';

/** Te same usługi i poświadczenia co dla napastnika; brak przywracania starych tuneli. */
export function resumeLegitimateWork(state: SimulationState): SimulationState {
  const minute = currentMinute(state.clock);
  let next: SimulationState = {
    ...state,
    access: {
      ...state.access,
      sessions: state.access.sessions.map((session) =>
        session.status === 'active' && session.expiresAtMinute <= minute
          ? { ...session, status: 'expired' as const }
          : session,
      ),
    },
  };
  for (const behavior of state.hidden.scenario.legitimateBehaviors) {
    const actor = next.hidden.legitimateActors.find(
      (item) => item.id === behavior.id,
    )!;
    const account = next.access.accounts.find(
      (item) => item.id === behavior.accountId,
    );
    if (!account) continue;
    const active = next.access.sessions.some(
      (session) =>
        session.accountId === account.id &&
        isSessionActive(session, minute) &&
        (account.id !== next.access.vendorAuthorization?.accountId ||
          next.hidden.sessionOrigins[session.id] === 'legitimate'),
    );
    let dueTurn = actor.nextAuthenticationTurn;
    if (active) dueTurn = null;
    else dueTurn ??= state.clock.turn + behavior.reconnectDelayTurns;
    if (!active && dueTurn !== null && dueTurn <= state.clock.turn) {
      let sessionId = `${behavior.sessionIdPrefix}-${String(state.clock.turn).padStart(2, '0')}`;
      while (next.access.sessions.some((session) => session.id === sessionId))
        sessionId += '-';
      const result = issueVpnSession(
        next.world,
        next.access,
        {
          sessionId,
          ...(behavior.secondFactorVersion === undefined
            ? {}
            : { secondFactorVersion: behavior.secondFactorVersion }),
          accountId: account.id,
          credentialVersion:
            behavior.credentialPolicy === 'managed-current'
              ? account.credentialVersion
              : behavior.credentialVersion,
        },
        minute,
      );
      next = recordAuthentication(next, account.id, result);
      if (result.ok) {
        next = {
          ...next,
          access: result.access,
          hidden: {
            ...next.hidden,
            sessionOrigins: {
              ...next.hidden.sessionOrigins,
              [result.session.id]: 'legitimate',
            },
          },
        };
        dueTurn = null;
      } else
        dueTurn = state.clock.turn + Math.max(1, behavior.reconnectDelayTurns);
    }
    next = {
      ...next,
      hidden: {
        ...next.hidden,
        legitimateActors: next.hidden.legitimateActors.map((item) =>
          item.id === actor.id
            ? { ...item, nextAuthenticationTurn: dueTurn }
            : item,
        ),
      },
    };
  }
  return next;
}
