import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
  });

  it('returns the API health status', () => {
    const health = service.getHealth();

    expect(health).toMatchObject({
      status: 'ok',
      service: 'coreerp-api',
    });
    expect(new Date(health.timestamp).toString()).not.toBe('Invalid Date');
  });
});
