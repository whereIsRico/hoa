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
// /register, /verify-email, and /resend-code.
app.set('trust proxy', 1);

// Middleware
app.use(cors());
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
