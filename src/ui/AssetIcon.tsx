import type { AssetKind } from '../domain/infrastructure';

const paths: Record<AssetKind, string> = {
  'external-network':
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M2 12h20 M12 2c-5 5-5 15 0 20 M12 2c5 5 5 15 0 20',
  'network-device': 'M3 3h18v14H3z M7 7h10 M7 11h4 M12 17v4 M6 21h12',
  server: 'M4 2h16v8H4z M4 14h16v8H4z M7 6h1 M7 18h1 M12 6h5 M12 18h5',
  workstation: 'M2 3h20v13H2z M12 16v5 M7 21h10',
  'cloud-service': 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11H6',
};

export function AssetIcon({ kind }: { kind: AssetKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
