const express = require('express');
const cors = require('cors');
require('dotenv').config({ quiet: true });

const authRoutes = require('./routes/auth');
const staffAuthRoutes = require('./routes/staffAuth');
const platformAuthRoutes = require('./routes/platformAuth');
const residentRoutes = require('./routes/residents');
const communityRoutes = require('./routes/communities');
const guestRoutes = require('./routes/guests');
const adminRoutes = require('./routes/admin');
const staffRoutes = require('./routes/staff');
const platformRoutes = require('./routes/platform');

const app = express();

// DigitalOcean App Platform's ingress is a single reverse-proxy hop in
// front of this service. Without this, Express (and by extension
// express-rate-limit, which keys its limiters by X-Forwarded-For) doesn't
// trust that header at all, logging a ValidationError on every request in
// production and potentially mis-keying the rate limiters added for
// /register, /verify-email, /resend-code, and the login endpoints.
app.set('trust proxy', 1);

// Middleware
// The frontend and backend are the same DO app/domain in production
// (palisade.argusbahamas.com), so a real browser client never needs
// cross-origin access there — this exists for local dev (Vite's fixed
// port, see frontend/vite.config.js) and as defense-in-depth generally.
// The landing site (argusbahamas.com) never calls this API, so it's
// deliberately not in this list.
const allowedOrigins = ['https://palisade.argusbahamas.com'];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
// express.json() leaves req.body as undefined when the request has no body
// or an unrecognized Content-Type — every validator assumes an object.
app.use((req, res, next) => {
  if (!req.body) req.body = {};
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Palisade API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', staffAuthRoutes);
app.use('/api/auth', platformAuthRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/platform', platformRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
