const request = require('supertest');
const app = require('../src/app');

// GET / is the plain health-check route — no DB, no auth — so it's a clean
// place to probe CORS behavior without a query hitting the stubbed (bogus)
// DB_HOST from tests/setup.js and hanging the test.
describe('CORS origin restriction', () => {
  test('reflects the production frontend origin', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'https://palisade.argusbahamas.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://palisade.argusbahamas.com');
  });

  test('reflects the local dev origin (NODE_ENV is not production under Jest)', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('does not allow an arbitrary unknown origin', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'https://evil-example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  // allowedOrigins is computed once at module load (app.js), so exercising
  // the production branch means re-requiring a fresh app instance with
  // NODE_ENV already set to 'production' at require time — the two other
  // tests above rely on Jest's own default (non-production) NODE_ENV and
  // can't otherwise prove this branch is guarded correctly.
  test('does not allow the local dev origin when NODE_ENV is production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let prodApp;
    jest.isolateModules(() => {
      prodApp = require('../src/app');
    });
    process.env.NODE_ENV = originalNodeEnv;

    const res = await request(prodApp)
      .get('/')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
