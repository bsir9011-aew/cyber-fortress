import type { EndpointCoverage } from '../domain/resilience';
export const pilotEndpointCoverage: EndpointCoverage = {
  endpointId: 'pakowanie-03',
  sensorId: 'edr-pakowanie-03',
  agentAvailable: true,
  collectorId: 'nexus-endpoint-collector',
  collectorAvailable: true,
  operations: ['read', 'modify'],
  retentionMinutes: 120,
  delayMinutes: 5,
  detection: {
    id: 'endpoint-modify-burst',
    name: 'Nietypowa seria modyfikacji dokumentów z endpointu',
    operation: 'modify',
    threshold: 10,
    windowMinutes: 10,
  },
};
