
-- 1) Add end_user role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'end_user';
