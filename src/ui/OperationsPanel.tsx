import { BranchOperations } from './BranchPanel';
import { RecoveryOperations } from './RecoveryPanel';
import { useState } from 'react';
import type { PlayerView } from '../application/selectPlayerView';
import type {
  SimulationCommand,
  TaskAction,
  WorkerId,
} from '../domain/simulation';
import { taskSpecs } from '../simulation/tasks';
import { actionLabel } from './simulationPresentation';
import { VendorOperations } from './VendorPanel';
import { IntegrityOperations } from './IntegrityPanel';

export function OperationsPanel({
  view,
  onCommand,
}: {
  view: PlayerView;
  onCommand: (command: SimulationCommand) => void;
}) {
  const [ruleId, setRuleId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [accountId, setAccountId] = useState('');
  const rule = view.rules.find((item) => item.id === ruleId) ?? view.rules[0];
  const knownSessions = [
    ...new Map([
      ...(view.vendor?.observations ?? []).flatMap((o) =>
        o.records.map(
          (r) =>
            [r.sessionId, { id: r.sessionId, accountId: r.accountId }] as const,
        ),
      ),
      ...(view.sessionObservation?.sessions ?? []).map(
        (session) =>
          [
            session.id,
            { id: session.id, accountId: session.accountId },
          ] as const,
      ),
      ...view.fileObservations.flatMap((o) =>
        o.records.flatMap((r) =>
          r.sessionId
            ? [
                [
                  r.sessionId,
                  { id: r.sessionId, accountId: r.accountId },
                ] as const,
              ]
            : [],
        ),
      ),
      ...view.authObservations.flatMap((observation) =>
        observation.records.flatMap((record) =>
          record.sessionId
            ? [
                [
                  record.sessionId,
                  { id: record.sessionId, accountId: record.accountId },
                ] as const,
              ]
            : [],
        ),
      ),
    ]).values(),
  ];
  const session =
    knownSessions.find((item) => item.id === sessionId) ?? knownSessions[0];
  const account = view.knownAccountIds.includes(accountId)
    ? accountId
    : view.knownAccountIds[0];
  const busy = (workerId: WorkerId) =>
    view.tasks.find(
      (task) => task.workerId === workerId && task.status === 'running',
    );
  const disabled = (type: TaskAction['type']) =>
    view.finished ||
    Boolean(busy(taskSpecs[type].workerId)) ||
    view.clock.turn + taskSpecs[type].turns > view.clock.turnLimit;
  const schedule = (action: TaskAction) =>
    onCommand({
      type: 'schedule-task',
      workerId: taskSpecs[action.type].workerId,
      action,
    });

  return (
    <section
      id="team-actions"
      tabIndex={-1}
      className="operations-panel"
      aria-label="Zespół operacyjny"
    >
      <p className="eyebrow">Twoje zasoby</p>
      <h2>
        {view.integrity
          ? 'Rozpoznaj. Ogranicz. Odtwórz.'
          : 'Zbadać czy ograniczyć?'}
      </h2>
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
                {workerId === 'analyst' ? 'Analityk' : 'Bartek · administrator'}
              </strong>
              <p>
                {task
                  ? `${actionLabel(task.action)} · pozostało ${(task.dueTurn - view.clock.turn) * view.clock.turnMinutes} min`
                  : view.finished
                    ? 'Misja zakończona'
                    : 'Gotowy do pracy'}
              </p>
            </div>
            <span className={task ? 'worker-busy' : 'worker-ready'}>
              {task ? 'Zajęty' : 'Wolny'}
            </span>
          </div>
        );
      })}
      {view.integrity && view.fileSensor && (
        <button
          disabled={disabled('inspect-file-access')}
          onClick={() => schedule({ type: 'inspect-file-access' })}
        >
          Pobierz audyt FS-01 · 5 min
        </button>
      )}
      {view.branch && (
        <BranchOperations view={view.branch} onCommand={onCommand} />
      )}
      {view.recovery && (
        <RecoveryOperations view={view.recovery} onCommand={onCommand} />
      )}
      {view.vendor && (
        <VendorOperations view={view.vendor} onCommand={onCommand} />
      )}
      {view.integrity && (
        <IntegrityOperations view={view.integrity} onCommand={onCommand} />
      )}
      <details
        className="legacy-operations"
        open={!view.integrity && !view.vendor && !view.recovery && !view.branch}
      >
        <summary
          hidden={
            !view.integrity && !view.vendor && !view.recovery && !view.branch
          }
        >
          Narzędzia dostępu VPN i reguły sieciowe
        </summary>
        <h3 className="action-group-title">
          Pozyskaj dowód <span>analityk</span>
        </h3>
        <div className="operation-actions">
          <button
            disabled={
              disabled('inspect-auth-logs') ||
              !view.vpnOnline ||
              !view.sensors.authentication.enabled
            }
            onClick={() => schedule({ type: 'inspect-auth-logs' })}
          >
            Zbadaj logi uwierzytelnienia · 5 min
          </button>
          <button
            disabled={
              disabled('inspect-vpn-sessions') ||
              !view.vpnOnline ||
              !view.sensors.sessions.enabled
            }
            onClick={() => schedule({ type: 'inspect-vpn-sessions' })}
          >
            Sprawdź sesje VPN · 5 min
          </button>
          <button
            disabled={
              disabled('contact-account-owner') ||
              !view.knownAccountIds.includes('magazyn-07')
            }
            onClick={() =>
              schedule({
                type: 'contact-account-owner',
                accountId: 'magazyn-07',
              })
            }
          >
            Porozmawiaj z Martą · 5 min
          </button>
        </div>
        {view.fileSensor && !view.integrity && (
          <button
            className="file-research-button"
            disabled={
              disabled('inspect-file-access') || !view.fileSensor.enabled
            }
            onClick={() => schedule({ type: 'inspect-file-access' })}
          >
            Pobierz audyt FS-01 · 5 min
          </button>
        )}
        <p className="source-note">
          Wynik po zakończeniu zadania. Czytanie dowodów nie zajmuje czasu.
        </p>
        {!view.vpnOnline && (
          <p className="decision-warning">
            VPN jest wyłączony: odczyt lokalnych sensorów bramy jest
            niedostępny. Pozyskane wcześniej dowody pozostają w sprawie.
          </p>
        )}
        <h3 className="action-group-title">
          Zmień dostęp <span>administrator</span>
        </h3>
        <details className="policy-controls">
          <summary>Polityka komunikacji · 10 min</summary>
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
                Obecnie: <strong>{rule.action.toUpperCase()}</strong>. Reguła
                obejmuje także istniejący ruch tego protokołu. Inne przepływy
                mają osobne reguły.
              </p>
              {rule.accountIds && (
                <p className="source-note">
                  Zakres kont:{' '}
                  {rule.accountIds.length
                    ? rule.accountIds.join(', ')
                    : 'pusta grupa — reguła nie dopasuje żadnego konta'}
                  .
                </p>
              )}
              {view.rules.some((r) => r.accountIds) && (
                <p className="source-note">
                  Reguły zależą od konta sesji. Zmiana szerokiej reguły R-SMB
                  może nie zmienić pierwszeństwa reguł SEG. Domyślna odmowa
                  działa po dopasowaniu zakresu.
                </p>
              )}
              {view.businessDependencies.additionalWork
                .filter((work) =>
                  work.services.some(
                    (service) =>
                      service.targetAssetId === rule.targetAssetId &&
                      service.protocol === rule.protocol,
                  ),
                )
                .map((work) => (
                  <p className="decision-warning" key={work.id}>
                    Ten przepływ jest wymagany przez legalne konto{' '}
                    {work.accountId} dla {work.capacity} zamówień na turę:{' '}
                    {work.name}.
                  </p>
                ))}
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
        <details className="session-controls">
          <summary>Zakończenie tunelu · 5 min</summary>
          {session ? (
            <>
              <label htmlFor="observed-session">
                Sesja znana z pozyskanych dowodów
              </label>
              <select
                id="observed-session"
                value={session.id}
                onChange={(event) => setSessionId(event.target.value)}
              >
                {knownSessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.accountId}
                  </option>
                ))}
              </select>
              <p className="source-note">
                Historyczny log nie potwierdza, że tunel nadal działa.
                Zakończenie sesji nie blokuje nowych logowań.
              </p>
              <button
                disabled={disabled('terminate-session')}
                onClick={() =>
                  schedule({ type: 'terminate-session', sessionId: session.id })
                }
              >
                Zakończ sesję · 5 min
              </button>
            </>
          ) : (
            <p className="source-note">
              Najpierw zbadaj logi lub aktywne sesje, aby wskazać tunel.
            </p>
          )}
        </details>
        <details className="account-controls">
          <summary>Konto i poświadczenie</summary>
          {account ? (
            <>
              <label htmlFor="known-account">Konto znane ze sprawy</label>
              <select
                id="known-account"
                value={account}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {view.knownAccountIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <p className="source-note">
                Zmiany dotyczą nowych uwierzytelnień. Nie kończą wcześniej
                wydanych sesji.
              </p>
              <div className="operation-actions">
                <button
                  disabled={disabled('block-account')}
                  onClick={() =>
                    schedule({ type: 'block-account', accountId: account })
                  }
                >
                  Zablokuj nowe logowania · 5 min
                </button>
                <button
                  disabled={
                    disabled('unblock-account') ||
                    !view.blockedKnownAccountIds.includes(account)
                  }
                  onClick={() =>
                    schedule({ type: 'unblock-account', accountId: account })
                  }
                >
                  Przywróć nowe logowania · 5 min
                </button>
                <button
                  disabled={disabled('reset-credential')}
                  onClick={() =>
                    schedule({ type: 'reset-credential', accountId: account })
                  }
                >
                  Resetuj poświadczenie · 10 min
                </button>
              </div>
              <p className="decision-warning">
                Przywrócenie konta nie odtwarza zakończonych tuneli ani nie
                zmienia hasła i MFA. Nadal ważne przejęte poświadczenie może
                ponownie umożliwić dostęp. Legalna praca wymaga nowego
                poprawnego logowania i dostępu do wymaganych usług.
              </p>
            </>
          ) : (
            <p className="source-note">
              Brak kont wskazanych przez dostępne obserwacje.
            </p>
          )}
        </details>
        <details className="vpn-controls">
          <summary>Szerokie odcięcie VPN · 5 min</summary>
          <p className="decision-warning">
            Wyłączenie bramy kończy wszystkie tunele i odbiera zdalnym
            dyspozytorom dostęp do ERP. Obsługa lokalna pozostaje dostępna.
          </p>
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
        </details>
      </details>
      <p className="source-note">
        Zlecenie rezerwuje pracownika. Zmiana zaczyna działać dopiero po jej
        ukończeniu.
      </p>
    </section>
  );
}
