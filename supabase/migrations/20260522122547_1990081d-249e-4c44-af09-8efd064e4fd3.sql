-- 1) Novas roles: líder (elétrica) e líder eletromecânico
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider_eletromecanico';