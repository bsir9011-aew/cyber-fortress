import type { FortressAfterActionReportV1 } from '../domain/afterActionReport';
import { MAX_AAR_BYTES } from '../domain/afterActionReport';
import { validateAfterActionReport } from './validateAfterActionReport';
import { renderAfterActionMarkdown } from './afterActionMarkdown';
export function encodeAfterActionReport(
  report: FortressAfterActionReportV1,
  format: 'json' | 'markdown',
) {
  if (!validateAfterActionReport(report).ok)
    throw new Error('Niespójny raport AAR.');
  const content =
    format === 'json'
      ? JSON.stringify(report, null, 2) + '\n'
      : renderAfterActionMarkdown(report);
  if (new TextEncoder().encode(content).byteLength > MAX_AAR_BYTES)
    throw new Error(
      'Raport przekracza limit 2 MiB. Nie pobrano częściowego pliku.',
    );
  return {
    content,
    mimeType:
      format === 'json'
        ? 'application/json;charset=utf-8'
        : 'text/markdown;charset=utf-8',
    filename: `FORTRESS_AAR_${report.scenario.family}_${report.generatedAt.slice(0, 10)}.${format === 'json' ? 'json' : 'md'}`,
  };
}
export const AI_COACH_INSTRUCTION = `Przeanalizuj załączony raport FORTRESS LAB jako instruktor cyberbezpieczeństwa i Security Architect.

Nie oceniaj wyłącznie wyniku końcowego.

1. Zrekonstruuj sytuację i cele.
2. Oceń każdą ważną decyzję na podstawie informacji dostępnych graczowi W TAMTYM MOMENCIE.
3. Wskaż decyzje poprawne, częściowo poprawne oraz błędne.
4. Wyjaśnij mechanizmy techniczne i konsekwencje biznesowe.
5. Oddziel błędy w rozumowaniu od błędów w wykonaniu i ograniczeń dostępnej wiedzy.
6. Wskaż możliwe alternatywy, ale nie przedstawiaj hipotetycznych rezultatów jako potwierdzonych bez danych lub replay.
7. Wybierz trzy najważniejsze lekcje.
8. Przygotuj pięć krótkich pytań sprawdzających zrozumienie incydentu, najlepiej po angielsku, w stylu Security+/Security Engineering.
9. Jeżeli raport zawiera niejasność, brak dowodu lub sprzeczność, wskaż to zamiast zgadywać.

Nie oceniaj personalnie gracza. Oceniaj decyzje, hipotezy, dowody i mechanizmy.`;
