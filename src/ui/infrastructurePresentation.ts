import type { MapLayer } from '../application/infrastructureSelectors';
import type {
  AssetKind,
  AssetStatus,
  ConnectionKind,
} from '../domain/infrastructure';

export type MapSelection = { kind: 'asset' | 'connection'; id: string } | null;

export const layers: readonly {
  id: MapLayer;
  name: string;
  shortName: string;
  description: string;
  emptyMessage: string;
}[] = [
  {
    id: 'network',
    name: 'Infrastruktura i sieć',
    shortName: 'Sieć',
    description: 'Ścieżki komunikacji między usługami.',
    emptyMessage: 'Brak zdefiniowanych połączeń sieciowych.',
  },
  {
    id: 'identity',
    name: 'Tożsamość i dostęp',
    shortName: 'Tożsamość',
    description: 'Uwierzytelnianie i jawnie określone uprawnienia.',
    emptyMessage: 'Brak zdefiniowanych relacji tożsamości i dostępu.',
  },
  {
    id: 'business',
    name: 'Procesy biznesowe',
    shortName: 'Biznes',
    description: 'Usługi, od których zależy codzienna praca.',
    emptyMessage: 'Brak zdefiniowanych zależności biznesowych.',
  },
  {
    id: 'telemetry',
    name: 'Telemetria',
    shortName: 'Telemetria',
    description: 'Źródła obserwacji i ich pokrycie.',
    emptyMessage:
      'Brak osobnych relacji obserwacji na mapie. Lokalne sensory bramy VPN opisano powyżej; nie modelujemy sensora przepływów ani audytu plików.',
  },
];

export const connectionLabels: Record<ConnectionKind, string> = {
  network: 'Relacja sieciowa',
  authentication: 'Uwierzytelnianie',
  authorization: 'Autoryzacja',
  'business-dependency': 'Zależność biznesowa',
  observation: 'Obserwacja sensora',
};

export const assetLabels: Record<AssetKind, string> = {
  'external-network': 'Sieć zewnętrzna',
  'network-device': 'Urządzenie sieciowe',
  server: 'Serwer / usługa',
  workstation: 'Stacje robocze',
  'cloud-service': 'Usługa chmurowa',
};

export const statusLabels: Record<AssetStatus, string> = {
  unknown: 'Nie zbadano',
  online: 'Działa',
  offline: 'Niedostępny',
};
