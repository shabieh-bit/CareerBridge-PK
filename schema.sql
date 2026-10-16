-- Apply with psql "$DATABASE_URL" -f schema.sql (or your provider's SQL editor).
CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 is_admin BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS profiles (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 degree TEXT NOT NULL,
 semester TEXT NOT NULL,
 city TEXT NOT NULL,
 interest TEXT NOT NULL,
 skills TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS matches (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 job JSONB NOT NULL,
 match JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS matches_user_id_idx ON matches(user_id,id DESC);
CREATE TABLE IF NOT EXISTS saved_jobs (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 job_link TEXT NOT NULL,
 job JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,job_link)
);
CREATE TABLE IF NOT EXISTS applications (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 job_link TEXT NOT NULL,
 job JSONB NOT NULL,
 status TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,job_link)
);

-- Each student may upload one private CV, independent of their saved profile.
CREATE TABLE IF NOT EXISTS cv_files (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 file_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 3145728),
 file_data BYTEA NOT NULL,
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CV parsing results contain extracted skills and education only, never the full CV text.
CREATE TABLE IF NOT EXISTS cv_analysis (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 cv_uploaded_at TIMESTAMPTZ NOT NULL,
 result JSONB NOT NULL,
 analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS action_plans (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 job JSONB NOT NULL,
 required_skills JSONB NOT NULL,
 completed_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS action_plans_by_user ON action_plans(user_id,id DESC);
