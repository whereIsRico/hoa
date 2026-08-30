// Shared across CommunitiesPage, CommunityDetailPage, and DirectoryPage so
// tier/billing labels and tones stay in exactly one place.

export const TIER_LABELS = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' }

// subscriptions.status is nullable — a community with no subscriptions row
// yet (e.g. one onboarded before this table was populated) reads as null,
// shown as "Not set" rather than a crash or a made-up default.
export const BILLING_STATUS_LABELS = { active: 'Paying', trial: 'Trial', overdue: 'Overdue' }

export const BILLING_STATUS_TONES = { active: 'success', trial: 'warning', overdue: 'danger' }
