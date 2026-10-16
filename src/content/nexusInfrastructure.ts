import type { WorldState } from '../domain/world';
import { nexusLogistics } from './organization';

/** Jawne dane fikcyjnego scenariusza, bez ukrytego stanu bezpieczeństwa. */
export const nexusInfrastructure: WorldState = {
  organizationId: nexusLogistics.id,
  zones: [
    {
      id: 'external',
      name: 'Internet',
      description: 'Sieć zewnętrzna poza kontrolą organizacji.',
    },
    {
      id: 'perimeter',
      name: 'Perymetr',
      description: 'Brama sieci i punkt dostępu zdalnego.',
    },
    {
      id: 'dmz',
      name: 'DMZ',
      description: 'Wydzielona strefa usług publicznych.',
    },
    {
      id: 'internal',
      name: 'Sieć wewnętrzna',
      description: 'Tożsamość, systemy operacyjne i dane firmy.',
    },
    {
      id: 'cloud',
      name: 'Chmura',
      description: 'Usługi współpracy dostarczane spoza sieci lokalnej.',
    },
  ],
  teams: [
    { id: 'external', name: 'Operatorzy zewnętrzni' },
    { id: 'it', name: 'Zespół IT' },
    { id: 'operations', name: 'Dział operacyjny' },
    { id: 'customer-service', name: 'Obsługa klienta' },
  ],
  assets: [
    {
      id: 'internet',
      name: 'Internet',
      kind: 'external-network',
      zoneId: 'external',
      ownerTeamId: 'external',
      status: 'online',
      protocols: ['IP'],
      description:
        'Otoczenie sieciowe firmy. Nie jest zarządzanym urządzeniem NEXUS Logistics.',
      businessRole:
        'Łączność z klientami, pracownikami zdalnymi i usługami chmurowymi.',
    },
    {
      id: 'firewall',
      name: 'Firewall',
      kind: 'network-device',
      zoneId: 'perimeter',
      ownerTeamId: 'it',
      status: 'online',
      protocols: ['IP', 'TCP', 'UDP'],
      description:
        'Brama między Internetem, usługami publicznymi i siecią organizacji.',
      businessRole: 'Punkt kontroli ruchu na granicy firmy.',
    },
    {
      id: 'vpn',
      name: 'VPN Gateway',
      kind: 'network-device',
      zoneId: 'perimeter',
      ownerTeamId: 'it',
      status: 'online',
      protocols: ['VPN'],
      description:
        'Brama zdalnego dostępu pracowników, powiązana z firmową usługą tożsamości.',
      businessRole: 'Praca zdalnych dyspozytorów z systemami wewnętrznymi.',
    },
    {
      id: 'ad',
      name: 'Active Directory',
      kind: 'server',
      zoneId: 'internal',
      ownerTeamId: 'it',
      status: 'online',
      protocols: ['Kerberos', 'LDAP'],
      description:
        'Centralna usługa kont, grup i uwierzytelniania pracowników.',
      businessRole: 'Wspólna tożsamość przy logowaniu do usług firmowych.',
    },
    {
      id: 'web',
      name: 'Portal WWW',
      kind: 'server',
      zoneId: 'dmz',
      ownerTeamId: 'customer-service',
      status: 'online',
      protocols: ['HTTPS'],
      description: 'Publiczny portal klientów w wydzielonej strefie DMZ.',
      businessRole: 'Kontakt z klientami i przyjmowanie zleceń logistycznych.',
    },
    {
      id: 'erp',
      name: 'ERP Server',
      kind: 'server',
      zoneId: 'internal',
      ownerTeamId: 'operations',
      status: 'online',
      protocols: ['HTTPS'],
      description: 'System obsługi operacji, fakturowania i rozliczeń firmy.',
      businessRole: 'Obsługa zleceń logistycznych oraz rozliczeń.',
    },
    {
      id: 'workstations',
      name: 'Workstations',
      kind: 'workstation',
      zoneId: 'internal',
      ownerTeamId: 'it',
      status: 'online',
      protocols: ['HTTPS', 'SMB', 'Kerberos'],
      description:
        'Grupa 94 komputerów wykorzystywanych przez pracowników firmy.',
      businessRole: 'Codzienna praca działów operacyjnych i biurowych.',
    },
    {
      id: 'm365',
      name: 'Microsoft 365',
      kind: 'cloud-service',
      zoneId: 'cloud',
      ownerTeamId: 'it',
      status: 'online',
      protocols: ['HTTPS'],
      description: 'Środowisko poczty, dokumentów i współpracy zespołowej.',
      businessRole:
        'Komunikacja i współdzielenie dokumentacji między zespołami.',
    },
    {
      id: 'fs-01',
      name: 'File Server FS-01',
      kind: 'server',
      zoneId: 'internal',
      ownerTeamId: 'operations',
      status: 'online',
      protocols: ['SMB'],
      description:
        'Wewnętrzny serwer plików udostępniający dokumenty operacyjne.',
      businessRole: 'Dostęp do dokumentów potrzebnych przy realizacji wysyłek.',
    },
  ],
  connections: [
    {
      id: 'internet-firewall',
      sourceAssetId: 'internet',
      targetAssetId: 'firewall',
      kind: 'network',
      label: 'Ruch zewnętrzny',
      protocol: 'IP',
      description: 'Ruch z Internetu dociera do bramy sieciowej organizacji.',
    },
    {
      id: 'firewall-web',
      sourceAssetId: 'firewall',
      targetAssetId: 'web',
      kind: 'network',
      label: 'Portal klientów',
      protocol: 'HTTPS',
      description: 'Ścieżka sieciowa do publicznego portalu w DMZ.',
    },
    {
      id: 'firewall-vpn',
      sourceAssetId: 'firewall',
      targetAssetId: 'vpn',
      kind: 'network',
      label: 'Dostęp zdalny',
      protocol: 'VPN',
      description:
        'Ścieżka do bramy zestawiającej tunele pracowników zdalnych.',
    },
    {
      id: 'vpn-erp',
      sourceAssetId: 'vpn',
      targetAssetId: 'erp',
      kind: 'network',
      label: 'Praca w ERP',
      protocol: 'HTTPS',
      description:
        'Przykładowy przepływ z bramy VPN do usługi ERP przez HTTPS. Samo połączenie nie określa uprawnień użytkownika.',
    },
    {
      id: 'vpn-files',
      sourceAssetId: 'vpn',
      targetAssetId: 'fs-01',
      kind: 'network',
      label: 'Dokumenty wysyłkowe',
      protocol: 'SMB',
      description:
        'Odrębny przepływ z bramy VPN do udziału plikowego FS-01 przez SMB. Nie jest regułą autoryzacji.',
    },
    {
      id: 'workstations-erp',
      sourceAssetId: 'workstations',
      targetAssetId: 'erp',
      kind: 'network',
      label: 'Obsługa zleceń',
      protocol: 'HTTPS',
      description:
        'Komputery pracowników komunikują się z usługą ERP przez HTTPS.',
    },
    {
      id: 'vpn-ad',
      sourceAssetId: 'vpn',
      targetAssetId: 'ad',
      kind: 'authentication',
      label: 'Tożsamość VPN',
      description:
        'Brama VPN korzysta z firmowej tożsamości w Active Directory. Szczegóły integracji i zakres uprawnień nie są tu określone.',
    },
    {
      id: 'workstations-ad',
      sourceAssetId: 'workstations',
      targetAssetId: 'ad',
      kind: 'authentication',
      label: 'Logowanie domenowe',
      protocol: 'Kerberos',
      description:
        'Stacje pracowników korzystają z domenowej usługi uwierzytelniania. Uwierzytelnienie nie oznacza dostępu do każdego zasobu.',
    },
    {
      id: 'operations-erp',
      sourceAssetId: 'workstations',
      targetAssetId: 'erp',
      kind: 'business-dependency',
      label: 'Zlecenia i rozliczenia',
      description:
        'Praca zespołu operacyjnego na stacjach zależy od dostępności ERP do obsługi zleceń i rozliczeń.',
    },
    {
      id: 'operations-files',
      sourceAssetId: 'workstations',
      targetAssetId: 'fs-01',
      kind: 'business-dependency',
      label: 'Dokumentacja wysyłek',
      description:
        'Pracownicy potrzebują dokumentów z FS-01 przy przygotowywaniu wysyłek.',
    },
    {
      id: 'operations-m365',
      sourceAssetId: 'workstations',
      targetAssetId: 'm365',
      kind: 'business-dependency',
      label: 'Komunikacja zespołu',
      description:
        'Praca biurowa korzysta z poczty i dokumentacji współdzielonej w Microsoft 365.',
    },
  ],
};
