-- Add new enum values to app_role and user_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'engenharia';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'supervisao';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'engenharia';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supervisao';