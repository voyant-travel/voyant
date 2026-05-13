CREATE TABLE IF NOT EXISTS agent_runner_runs (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT,
  status TEXT NOT NULL,
  workspace TEXT,
  branch TEXT,
  pr_url TEXT,
  evidence_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_heartbeat_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_runner_runs_repository_updated_idx
  ON agent_runner_runs (repository, updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_runner_runs_repository_status_idx
  ON agent_runner_runs (repository, status);

CREATE TABLE IF NOT EXISTS agent_runner_leases (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  repository TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT,
  status TEXT NOT NULL,
  holder TEXT,
  leased_at TEXT NOT NULL,
  expires_at TEXT,
  finished_at TEXT,
  reason TEXT,
  intent_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_runner_leases_repository_leased_idx
  ON agent_runner_leases (repository, leased_at DESC);

CREATE INDEX IF NOT EXISTS agent_runner_leases_repository_status_idx
  ON agent_runner_leases (repository, status);

CREATE TABLE IF NOT EXISTS agent_runner_events (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  repository TEXT NOT NULL,
  issue_number INTEGER,
  action TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_runner_events_repository_created_idx
  ON agent_runner_events (repository, created_at DESC);
