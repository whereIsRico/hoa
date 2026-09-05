-- Communities (HOAs)
CREATE TABLE communities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  subscription_tier VARCHAR(50) DEFAULT 'starter',
  monthly_fee DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Residents
CREATE TABLE residents (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(20),
  unit_number VARCHAR(50),
  is_approved BOOLEAN DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  guest_limit_per_month INTEGER DEFAULT 10,
  role VARCHAR(50) DEFAULT 'resident',
  -- Bumped to invalidate every outstanding JWT for this account at once
  -- (password change, deactivation, "log out everywhere") without a full
  -- token blacklist table. Checked against the JWT's own embedded
  -- token_version claim on every authenticated request — see
  -- backend/src/middleware/auth.js.
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, email)
);

-- Email verification codes for new resident registrations. A separate
-- table (not columns on residents) so "resend" is just a new row — no
-- in-place overwrite juggling, matching the manual_contacts precedent
-- of purpose-built tables over overloading an existing one.
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gate Staff
CREATE TABLE gate_staff (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  shift_start TIME,
  shift_end TIME,
  -- See residents.token_version above — same purpose, per-actor-table.
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, email)
);

-- Manual contacts: people the HOA has a phone number for who never created a
-- Palisade account (residents table requires email + password). The admin
-- maintains this roster by hand — it's how Gate Staff/Admin Directory search
-- still finds someone who isn't "on Palisade".
CREATE TABLE manual_contacts (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  unit_number VARCHAR(50),
  phone VARCHAR(20),
  notes TEXT,
  created_by INTEGER REFERENCES residents(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guests
CREATE TABLE guests (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id),
  community_id INTEGER NOT NULL REFERENCES communities(id),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  license_plate VARCHAR(20),
  purpose VARCHAR(255),
  status VARCHAR(50) DEFAULT 'invited',
  scheduled_arrival TIMESTAMP,
  scheduled_departure TIMESTAMP,
  actual_arrival TIMESTAMP,
  actual_departure TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policies
CREATE TABLE policies (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL UNIQUE REFERENCES communities(id),
  max_guests_per_resident_per_month INTEGER DEFAULT 10,
  blacklisted_visitors TEXT,
  require_id_verification BOOLEAN DEFAULT false,
  guest_checkout_required BOOLEAN DEFAULT true,
  auto_approval_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  action VARCHAR(255) NOT NULL,
  actor_id INTEGER,
  actor_type VARCHAR(50),
  resource_id VARCHAR(255),
  resource_type VARCHAR(50),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions (for billing tracking)
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL UNIQUE REFERENCES communities(id),
  tier VARCHAR(50) DEFAULT 'starter',
  monthly_fee DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'active',
  billing_email VARCHAR(255),
  billing_cycle_day INTEGER DEFAULT 1,
  next_billing_date DATE,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens: shared across all three actor types (resident,
-- gate_staff, platform_admin) via actor_type/actor_id, mirroring how
-- audit_logs already does polymorphic actor references. token_hash is a
-- SHA-256 digest (deterministic, indexable) rather than bcrypt — a reset
-- link only gives the backend the raw token itself, so the row has to be
-- found BY the token, which bcrypt's salting makes impossible.
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  actor_type VARCHAR(50) NOT NULL,
  actor_id INTEGER NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform admins (Threshold staff — not scoped to any single community,
-- unlike HOA admins. Can onboard new communities and their first admin.)
CREATE TABLE platform_admins (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- See residents.token_version above — same purpose, per-actor-table.
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX idx_residents_community ON residents(community_id);
CREATE INDEX idx_guests_community ON guests(community_id);
CREATE INDEX idx_guests_resident ON guests(resident_id);
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_audit_community ON audit_logs(community_id);
CREATE INDEX idx_subscriptions_community ON subscriptions(community_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_manual_contacts_community ON manual_contacts(community_id);
CREATE INDEX idx_email_verifications_resident ON email_verifications(resident_id);
CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_actor ON password_reset_tokens(actor_type, actor_id);
