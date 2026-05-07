-- Pass 4A Checkpoint 1, file 1 of 2: add 'manager' to membership_role enum.
-- Must commit before any function/policy can reference the new value.
ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'manager';