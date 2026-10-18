import type { CampaignCommand, CampaignState } from '../domain/campaign';
import { preparationPreview } from '../application/gameplay/campaignExperience';
export function PreparationPreview({
  campaign,
  command,
}: {
  campaign: CampaignState;
  command: CampaignCommand;
}) {
  const p = preparationPreview(campaign, command);
  return (
    <div className="work-preview">
      <strong>Przed zleceniem</strong>
      <p>
        {p.worker
          ? `${p.worker === 'administrator' ? 'Administrator' : 'Analityk'} · ${p.hours} h · ${p.inWindow ? 'ta część pracy mieści się w oknie' : 'pozostała praca przejdzie na kolejne okno'}.`
          : 'Decyzja przygotowawcza.'}{' '}
        {p.payment
          ? `Płatność teraz: ${p.payment.toLocaleString('pl-PL')} zł.`
          : 'Bez nowej płatności teraz.'}{' '}
        {p.reservation > 0 &&
          `Rezerwacja: ${p.reservation.toLocaleString('pl-PL')} zł.`}
      </p>
      {p.reason && <p className="action-reason">{p.reason}</p>}
      <small>
        Efekt projektu wymaga ukończenia pracy wszystkich wymaganych osób; nie
        gwarantuje wyniku incydentu.
      </small>
    </div>
  );
}
