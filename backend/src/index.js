const express = require('express');
const cors = require('cors');
require('dotenv').config({ quiet: true });

const authRoutes = require('./routes/auth');
const staffAuthRoutes = require('./routes/staffAuth');
const residentRoutes = require('./routes/residents');
const communityRoutes = require('./routes/communities');
const guestRoutes = require('./routes/guests');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Passage API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', staffAuthRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/guests', guestRoutes);

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
