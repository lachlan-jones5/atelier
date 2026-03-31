import { describe, it, expect } from '@jest/globals';

describe('Users API', () => {
  it('should return empty array for GET /api/users', () => {
    // TODO: set up supertest and test the endpoint
    expect(true).toBe(true);
  });

  it('should return 401 without auth token', () => {
    // TODO: test auth middleware rejection
    expect(true).toBe(true);
  });

  it('should create a user via POST /api/users', () => {
    // TODO: test user creation
    expect(true).toBe(true);
  });
});
