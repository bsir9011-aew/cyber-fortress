import type { BackupPoint, IntegrityDefinition } from '../domain/integrity';
import type { BackupReadiness } from '../domain/resilience';
import type { WorldState } from '../domain/world';
import { isAssetOnline } from './access';

/** Content identity in this finite model, not a cryptographic signature. */
export const backupSignature = (backup: BackupPoint) =>
  JSON.stringify({
    id: backup.id,
    minute: backup.minute,
    documents: [...backup.documentIds].sort(),
    damaged: [...backup.damagedIds].sort(),
  });
export function testBackupProcedure(
  definition: IntegrityDefinition,
  world: WorldState,
  erpAssetId: string,
  window: number,
  hour: number,
): BackupReadiness {
  const backup = definition.backups.find((b) => b.id === 'FS-1350');
  const accessible =
    !!backup?.available &&
    isAssetOnline(world, definition.datasetAssetId) &&
    isAssetOnline(world, erpAssetId);
  const checked = accessible ? backup!.documentIds : [];
  // Rehearsal materializes only the snapshot's own scope, then checks every item.
  const restored = checked.map((id) => ({
    id,
    correct: !backup!.damagedIds.includes(id),
  }));
  const clean =
    accessible && restored.length > 0 && restored.every((d) => d.correct);
  return {
    backupId: 'FS-1350',
    testedAt: { window, hour },
    snapshotSignature: backup ? backupSignature(backup) : '',
    checkedDocumentIds: [...checked],
    integrity: !accessible ? 'unavailable' : clean ? 'clean' : 'damaged',
    restoreTestPassed: clean && restored.length === backup!.documentIds.length,
    testedRestoreTurns: clean ? 2 : (backup?.restoreTurns ?? 3),
  };
}
export function matchingBackupTest(
  backup: BackupPoint,
  readiness: BackupReadiness | undefined,
): boolean {
  return (
    !!readiness &&
    readiness.backupId === backup.id &&
    readiness.snapshotSignature === backupSignature(backup) &&
    readiness.checkedDocumentIds.length === backup.documentIds.length &&
    backup.documentIds.every((id) =>
      readiness.checkedDocumentIds.includes(id),
    ) &&
    readiness.integrity !== 'unavailable'
  );
}
export function preparedRestoreTurns(
  backup: BackupPoint,
  readiness: BackupReadiness | undefined,
) {
  return matchingBackupTest(backup, readiness) &&
    readiness!.restoreTestPassed &&
    readiness!.integrity === 'clean' &&
    backup.available &&
    !backup.damagedIds.length
    ? readiness!.testedRestoreTurns
    : backup.restoreTurns;
}
