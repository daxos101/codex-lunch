CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  distance_meters integer NOT NULL CHECK (distance_meters BETWEEN 0 AND 2000),
  website_url text NOT NULL,
  menu_source_url text NOT NULL,
  menu_source_type text NOT NULL CHECK (
    menu_source_type IN ('api', 'structured_data', 'html', 'pdf', 'official_channel', 'manual')
  ),
  adapter text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_retrieval_attempt timestamptz,
  last_successful_retrieval timestamptz,
  current_menu_status text NOT NULL DEFAULT 'not_published' CHECK (
    current_menu_status IN (
      'confirmed_today',
      'possibly_stale',
      'not_published',
      'closed',
      'extraction_failed',
      'manual_review'
    )
  ),
  status_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id uuid PRIMARY KEY,
  target_date date NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  requested_restaurant_slug text,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'partial_failure', 'failed')),
  attempted_count integer NOT NULL DEFAULT 0,
  successful_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS collection_attempts (
  id uuid PRIMARY KEY,
  run_id uuid REFERENCES collection_runs(id) ON DELETE SET NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  target_date date NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'confirmed_today',
      'possibly_stale',
      'not_published',
      'closed',
      'extraction_failed',
      'manual_review'
    )
  ),
  error_category text,
  status_detail text,
  source_url text NOT NULL,
  source_hash text,
  raw_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_snapshots (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_date date NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'confirmed_today',
      'possibly_stale',
      'not_published',
      'closed',
      'extraction_failed',
      'manual_review'
    )
  ),
  status_detail text,
  dishes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_hash text,
  raw_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, menu_date)
);

CREATE INDEX IF NOT EXISTS idx_menu_snapshots_date
  ON menu_snapshots (menu_date, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_restaurant_created
  ON collection_attempts (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_failures
  ON collection_attempts (created_at DESC)
  WHERE status IN ('extraction_failed', 'manual_review');
