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
  guest_limit_per_month INTEGER DEFAULT 10,
  role VARCHAR(50) DEFAULT 'resident',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, email)
);

-- Gate Staff
CREATE TABLE gate_staff (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  shift_start TIME,
  shift_end TIME,
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

-- Indexes for faster queries
CREATE INDEX idx_residents_community ON residents(community_id);
CREATE INDEX idx_guests_community ON guests(community_id);
CREATE INDEX idx_guests_resident ON guests(resident_id);
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_audit_community ON audit_logs(community_id);
CREATE INDEX idx_subscriptions_community ON subscriptions(community_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
