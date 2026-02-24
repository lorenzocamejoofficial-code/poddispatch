-- Add is_sandbox flag to companies
ALTER TABLE companies ADD COLUMN is_sandbox boolean NOT NULL DEFAULT false;

-- Add simulation tracking columns to key operational tables
ALTER TABLE patients ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN simulation_run_id uuid;

ALTER TABLE trucks ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE trucks ADD COLUMN simulation_run_id uuid;

ALTER TABLE facilities ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE facilities ADD COLUMN simulation_run_id uuid;

ALTER TABLE profiles ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN simulation_run_id uuid;

ALTER TABLE crews ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE crews ADD COLUMN simulation_run_id uuid;

ALTER TABLE scheduling_legs ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE scheduling_legs ADD COLUMN simulation_run_id uuid;

ALTER TABLE truck_run_slots ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE truck_run_slots ADD COLUMN simulation_run_id uuid;

ALTER TABLE trip_records ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE trip_records ADD COLUMN simulation_run_id uuid;

ALTER TABLE claim_records ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE claim_records ADD COLUMN simulation_run_id uuid;

-- Simulation runs tracking table
CREATE TABLE simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  config jsonb DEFAULT '{}'
);

ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System creator manages simulation_runs" ON simulation_runs FOR ALL USING (is_system_creator()) WITH CHECK (is_system_creator());

-- Simulation snapshots table
CREATE TABLE simulation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  snapshot_data jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE simulation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System creator manages simulation_snapshots" ON simulation_snapshots FOR ALL USING (is_system_creator()) WITH CHECK (is_system_creator());