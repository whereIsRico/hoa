// Dummy values so modules that construct third-party clients at require-time
// (Resend) or need a secret to exist (jsonwebtoken) don't throw during
// `require('../src/app')` in tests. Never real credentials — no test in this
// suite should reach code that actually calls out to Resend or a live DB.
// dotenv (loaded by app.js) never overrides an already-set env var, so these
// win over whatever's in a developer's local backend/.env — including DB_*,
// which per CLAUDE.md has at times pointed at real infrastructure during
// debugging. Stubbing all of them, not just the ones today's tests happen to
// reach, so a future test that exercises a DB-touching path fails loudly
// against a bogus host instead of silently hitting real infrastructure.
process.env.RESEND_API_KEY = 'test_dummy_key';
process.env.EMAIL_FROM = 'test@example.com';
process.env.JWT_SECRET = 'test_dummy_secret';
process.env.DB_HOST = 'test_dummy_host_do_not_use';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_dummy_db';
process.env.DB_USER = 'test_dummy_user';
process.env.DB_PASSWORD = 'test_dummy_password';
