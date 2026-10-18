import { useEffect, useState } from 'react';
import type { PlayerView } from '../application/selectPlayerView';
import type { SimulationCommand } from '../domain/simulation';
import { actionGroups } from '../application/gameplay/actionExperience';
import type {
  ActionGroup,
  DecisionAction,
} from '../application/gameplay/actionExperience';
import { Terms } from './GameplayHelp';
export function OperationsPanel({
  view,
  actions,
  onCommand,
  focusAssetId,
}: {
  view: PlayerView;
  actions: readonly DecisionAction[];
  onCommand: (c: SimulationCommand) => void;
  focusAssetId?: string | undefined;
}) {
  const [group, setGroup] = useState<ActionGroup>('investigate'),
    [target, setTarget] = useState('all'),
    [choice, setChoice] = useState<Record<string, string>>({}),
    [justification, setJustification] = useState(
      'Awaryjne przewozy w oknie kryzysowym M06.',
    );
  useEffect(() => {
    if (focusAssetId) {
      setTarget(focusAssetId);
      setGroup('investigate');
    }
  }, [focusAssetId]);
  const ids = [...new Set(actions.flatMap((a) => a.assets))];
  const grouped = actions.filter(
    (a) => a.group === group && (target === 'all' || a.assets.includes(target)),
  );
  const families = new Map<string, DecisionAction[]>();
  for (const a of grouped) {
    const list = families.get(a.action.type) ?? [];
    families.set(a.action.type, [...list, a]);
  }
  const send = (a: DecisionAction) =>
    onCommand({
      type: 'schedule-task',
      workerId: a.workerId,
      action:
        a.action.type === 'approve-emergency-vendor-access'
          ? { ...a.action, justification }
          : a.action,
    });
  return (
    <section
      id="team-actions"
      className="operations-panel decision-actions"
      tabIndex={-1}
      aria-label="Decyzje i działania"
    >
      <p className="eyebrow">CO MOŻESZ ZROBIĆ?</p>
      <h2>Następna decyzja</h2>
      <nav className="action-group-tabs" aria-label="Grupy działań">
        {Object.entries(actionGroups).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={group === id}
            onClick={() => setGroup(id as ActionGroup)}
          >
            {label}
            <small>{actions.filter((a) => a.group === id).length} opcji</small>
          </button>
        ))}
      </nav>
      <label htmlFor="action-resource">Zakres zasobu</label>
      <select
        id="action-resource"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="all">Wszystkie obsługiwane zasoby</option>
        {ids.map((id) => (
          <option key={id} value={id}>
            {view.world.assets.find((a) => a.id === id)?.name ?? id}
          </option>
        ))}
      </select>
      {[...families].map(([type, entries]) => {
        const selected =
          entries.find((a) => a.id === choice[type]) ?? entries[0]!;
        const invalid =
          type === 'approve-emergency-vendor-access' &&
          justification.trim().length < 10;
        return (
          <article className="action-card" key={type} id={`decision-${type}`}>
            <h3>
              {entries.length === 1
                ? selected.label
                : selected.label.split(' · ')[0]}
            </h3>
            {entries.length > 1 && (
              <label>
                Wskaż zakres
                <select
                  value={selected.id}
                  onChange={(e) =>
                    setChoice((c) => ({ ...c, [type]: e.target.value }))
                  }
                >
                  {entries.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.label}
                      {a.action.type === 'approve-emergency-vendor-access'
                        ? ` · ${a.action.scope} do ${Math.floor(a.action.expiresAtMinute / 60)}:${String(a.action.expiresAtMinute % 60).padStart(2, '0')}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="action-cost">
              <strong>
                {selected.workerId === 'administrator'
                  ? 'Administrator'
                  : 'Analityk'}
              </strong>{' '}
              · {selected.turns * view.clock.turnMinutes} min
            </p>
            <details>
              <summary>Zakres i warunki techniczne</summary>
              <p>{selected.scope}</p>
              <p>{selected.requirement}</p>
              <code>{selected.action.type}</code>
            </details>
            {type === 'approve-emergency-vendor-access' && (
              <label>
                Uzasadnienie dostępu
                <input
                  value={justification}
                  maxLength={200}
                  onChange={(e) => setJustification(e.target.value)}
                />
              </label>
            )}
            <button
              disabled={!!selected.rejection || invalid}
              onClick={() => send(selected)}
            >
              Zleć: {selected.label} · {selected.turns * view.clock.turnMinutes}{' '}
              min
            </button>
            <p className="action-reason" aria-live="polite">
              {invalid
                ? 'Uzasadnienie musi zawierać 10–200 znaków.'
                : (selected.reason ??
                  'Wykonawca i czas dostępne. Efekt po ukończeniu zadania.')}
            </p>
          </article>
        );
      })}
      {!families.size && (
        <p>
          Ta grupa nie ma operacji dla wybranego zasobu. Zmień filtr; pozostałe
          działania są dostępne w innych grupach.
        </p>
      )}
      <Terms
        terms={[
          'MFA',
          'ACL',
          ...(view.integrity
            ? ['EDR', 'False Positive', 'False Negative', 'Backup']
            : []),
          ...(view.recovery ? ['RTO', 'RPO', 'Standby', 'Reconciliation'] : []),
          ...(view.branch ? ['Site-to-site VPN', 'Least Privilege'] : []),
        ]}
      />
    </section>
  );
}
