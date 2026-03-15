BEGIN;

CREATE TABLE IF NOT EXISTS atlas.organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES atlas.users(id) ON DELETE SET NULL,
    UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_organizations_active
    ON atlas.organizations(is_active)
    WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON atlas.organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON atlas.organizations
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

CREATE TABLE IF NOT EXISTS atlas.subscription_plans (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    price_cents     INTEGER NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    billing_period  TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','one_time')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    limits          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
    ON atlas.subscription_plans(is_active)
    WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON atlas.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON atlas.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

CREATE TABLE IF NOT EXISTS atlas.organization_subscriptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES atlas.organizations(id) ON DELETE CASCADE,
    plan_id          TEXT NOT NULL REFERENCES atlas.subscription_plans(id) ON DELETE RESTRICT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing','active','past_due','canceled','paused')),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at          TIMESTAMPTZ,
    canceled_at      TIMESTAMPTZ,
    external_ref     TEXT,
    meta             JSONB,
    UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan
    ON atlas.organization_subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
    ON atlas.organization_subscriptions(status);

INSERT INTO atlas.subscription_plans (id, name, description, price_cents, currency, billing_period, is_active, limits)
VALUES
    (
        'free',
        'Free',
        'Plan gratuit',
        0,
        'EUR',
        'monthly',
        TRUE,
        jsonb_build_object(
            'max_users', 5,
            'max_projects', 1,
            'max_storage_mb', 512
        )
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;
