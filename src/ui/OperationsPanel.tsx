import { useState } from 'react';
import type { PlayerView } from '../application/selectPlayerView';
import type {
  SimulationCommand,
  TaskAction,
  WorkerId,
} from '../domain/simulation';
import { formatMinute } from '../simulation/clock';
import { taskSpecs } from '../simulation/tasks';
import { actionLabel } from './simulationPresentation';

export function OperationsPanel({
  view,
  onCommand,
}: {
  view: PlayerView;
  onCommand: (command: SimulationCommand) => void;
}) {
  const [ruleId, setRuleId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const rule = view.rules.find((item) => item.id === ruleId) ?? view.rules[0];
  const observation = view.sessionObservation;
  const session =
    observation?.sessions.find((item) => item.id === sessionId) ??
    observation?.sessions[0];
  const busy = (workerId: WorkerId) =>
    view.tasks.find(
      (task) => task.workerId === workerId && task.status === 'running',
    );
  const disabled = (actionType: TaskAction['type']) =>
    view.finished ||
    Boolean(busy(taskSpecs[actionType].workerId)) ||
    view.clock.turn + taskSpecs[actionType].turns > view.clock.turnLimit;
  const schedule = (action: TaskAction) =>
    onCommand({
      type: 'schedule-task',
      workerId: taskSpecs[action.type].workerId,
      action,
    });

  return (
    <section className="operations-panel" aria-label="Zespół operacyjny">
      <p className="eyebrow">Zespół operacyjny</p>
      <h2>Praca ma swój czas</h2>
      {(['analyst', 'administrator'] as const).map((workerId) => {
        const task = busy(workerId);
        return (
          <div
            className="worker-status"
            key={workerId}
            data-worker-id={workerId}
          >
            <span className="worker-icon" aria-hidden="true">
              {workerId === 'analyst' ? '◎' : '⌘'}
            </span>
            <div>
              <strong>
                {workerId === 'analyst' ? 'Analityk' : 'Administrator'}
              </strong>
              <p>
                {task
                  ? `${actionLabel(task.action)} · pozostało ${(task.dueTurn - view.clock.turn) * view.clock.turnMinutes} min`
                  : view.finished
                    ? 'Okno operacyjne zamknięte'
                    : 'Gotowy do pracy'}
              </p>
            </div>
            <span className={task ? 'worker-busy' : 'worker-ready'}>
              {task ? 'Zajęty' : '—'}
            </span>
          </div>
        );
      })}
      <div className="operation-actions">
        <button
          disabled={disabled('inspect-vpn-sessions') || !view.vpnOnline}
          onClick={() => schedule({ type: 'inspect-vpn-sessions' })}
        >
          Sprawdź sesje VPN · 5 min
        </button>
        <button
          className="vpn-action"
          disabled={disabled('set-vpn')}
          onClick={() =>
            schedule({
              type: 'set-vpn',
              assetId: view.vpnAssetId,
              enabled: !view.vpnOnline,
            })
          }
        >
          {view.vpnOnline ? 'Wyłącz VPN' : 'Włącz VPN'} · 5 min
        </button>
      </div>
      <p className="source-note">
        Logi uwierzytelnienia: brak dostępnego źródła.
      </p>
      <details className="policy-controls">
        <summary>Polityka komunikacji</summary>
        <label htmlFor="network-rule">Reguła sieciowa</label>
        <select
          id="network-rule"
          value={rule?.id ?? ''}
          onChange={(event) => setRuleId(event.target.value)}
        >
          {view.rules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} · {item.protocol} →{' '}
              {
                view.world.assets.find(
                  (asset) => asset.id === item.targetAssetId,
                )?.name
              }
            </option>
          ))}
        </select>
        {rule && (
          <>
            <p className="source-note">
              Decyzja: {rule.action === 'allow' ? 'dopuszczaj' : 'blokuj'}.
              Zmiana obejmuje również istniejący ruch.
            </p>
            <button
              disabled={disabled('set-network-rule')}
              onClick={() =>
                schedule({
                  type: 'set-network-rule',
                  ruleId: rule.id,
                  action: rule.action === 'allow' ? 'deny' : 'allow',
                })
              }
            >
              {rule.action === 'allow'
                ? 'Zablokuj przepływ'
                : 'Dopuść przepływ'}{' '}
              · 10 min
            </button>
          </>
        )}
      </details>
      <details className="session-controls" open={Boolean(observation)}>
        <summary>Badanie sesji VPN</summary>
        {observation ? (
          <>
            <p className="source-note">
              Odczyt bramy z {formatMinute(observation.observedAtMinute)}. To
              zapis chwili badania; ponów odczyt, aby odświeżyć listę.
            </p>
            <ul className="observed-sessions">
              {observation.sessions.map((item) => (
                <li key={item.id}>
                  <strong>{item.id}</strong>
                  <span>{item.accountId}</span>
                  <small>początek {formatMinute(item.startedAtMinute)}</small>
                </li>
              ))}
            </ul>
            {session ? (
              <>
                <label htmlFor="observed-session">Zaobserwowana sesja</label>
                <select
                  id="observed-session"
                  value={session.id}
                  onChange={(event) => setSessionId(event.target.value)}
                >
                  {observation.sessions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.accountId}
                    </option>
                  ))}
                </select>
                <div className="operation-actions">
                  <button
                    disabled={disabled('terminate-session')}
                    onClick={() =>
                      schedule({
                        type: 'terminate-session',
                        sessionId: session.id,
                      })
                    }
                  >
                    Zakończ sesję · 5 min
                  </button>
                  <button
                    disabled={disabled('block-account')}
                    onClick={() =>
                      schedule({
                        type: 'block-account',
                        accountId: session.accountId,
                      })
                    }
                  >
                    Zablokuj nowe logowania · 5 min
                  </button>
                  <button
                    disabled={disabled('reset-credential')}
                    onClick={() =>
                      schedule({
                        type: 'reset-credential',
                        accountId: session.accountId,
                      })
                    }
                  >
                    Resetuj poświadczenie · 10 min
                  </button>
                </div>
              </>
            ) : (
              <p className="source-note">
                W chwili odczytu nie było aktywnych sesji.
              </p>
            )}
          </>
        ) : (
          <p className="source-note">
            Nie przeprowadzono badania. Zleć analitykowi sprawdzenie aktywnych
            sesji.
          </p>
        )}
      </details>
    </section>
  );
}
