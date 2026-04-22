-- Helper: case-insensitive index on prestadores.email for fast matching
CREATE INDEX IF NOT EXISTS idx_prestadores_email_lower ON public.prestadores(lower(email));

-- =====================================================================
-- 1) profiles -> prestadores (sync nome/email/telefone/ativo)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_profile_to_prestador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prestador_id uuid;
BEGIN
  -- Skip if nothing relevant changed
  IF TG_OP = 'UPDATE'
     AND OLD.nome IS NOT DISTINCT FROM NEW.nome
     AND OLD.email IS NOT DISTINCT FROM NEW.email
     AND OLD.telefone IS NOT DISTINCT FROM NEW.telefone
     AND OLD.ativo IS NOT DISTINCT FROM NEW.ativo THEN
    RETURN NEW;
  END IF;

  -- Find linked prestador: prefer FK via tecnicos, fallback to email match
  SELECT t.prestador_id INTO v_prestador_id
  FROM public.tecnicos t
  WHERE t.profile_id = NEW.id
    AND t.prestador_id IS NOT NULL
  LIMIT 1;

  IF v_prestador_id IS NULL THEN
    SELECT id INTO v_prestador_id
    FROM public.prestadores
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;

  -- No linked prestador? Silently skip (admins/engenharia don't have one).
  IF v_prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update only when something differs (avoids triggering the reverse sync needlessly)
  UPDATE public.prestadores
  SET nome = NEW.nome,
      email = NEW.email,
      telefone = NEW.telefone,
      ativo = NEW.ativo,
      updated_at = now()
  WHERE id = v_prestador_id
    AND (nome IS DISTINCT FROM NEW.nome
      OR lower(email) IS DISTINCT FROM lower(NEW.email)
      OR telefone IS DISTINCT FROM NEW.telefone
      OR ativo IS DISTINCT FROM NEW.ativo);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_prestador ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_prestador
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_prestador();

-- =====================================================================
-- 2) prestadores -> profiles (sync nome/email/telefone/ativo)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_prestador_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.nome IS NOT DISTINCT FROM NEW.nome
     AND OLD.email IS NOT DISTINCT FROM NEW.email
     AND OLD.telefone IS NOT DISTINCT FROM NEW.telefone
     AND OLD.ativo IS NOT DISTINCT FROM NEW.ativo THEN
    RETURN NEW;
  END IF;

  -- Locate the profile via tecnicos.prestador_id (FK), fallback to email
  SELECT t.profile_id INTO v_profile_id
  FROM public.tecnicos t
  WHERE t.prestador_id = NEW.id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id
    FROM public.profiles
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;

  -- No profile yet (prestador not approved)? Skip silently.
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET nome = NEW.nome,
      email = NEW.email,
      telefone = NEW.telefone,
      ativo = NEW.ativo,
      updated_at = now()
  WHERE id = v_profile_id
    AND (nome IS DISTINCT FROM NEW.nome
      OR lower(email) IS DISTINCT FROM lower(NEW.email)
      OR telefone IS DISTINCT FROM NEW.telefone
      OR ativo IS DISTINCT FROM NEW.ativo);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_prestador_to_profile ON public.prestadores;
CREATE TRIGGER trg_sync_prestador_to_profile
AFTER UPDATE ON public.prestadores
FOR EACH ROW
EXECUTE FUNCTION public.sync_prestador_to_profile();

-- =====================================================================
-- 3) prestadores -> tecnicos (sync especialidades + regiao_atuacao)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_prestador_to_tecnico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regiao text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.especialidades IS NOT DISTINCT FROM NEW.especialidades
     AND OLD.cidade IS NOT DISTINCT FROM NEW.cidade
     AND OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  v_regiao := CASE
    WHEN NEW.cidade IS NULL OR NEW.cidade = '' THEN NULL
    ELSE NEW.cidade || COALESCE('/' || NEW.estado, '')
  END;

  UPDATE public.tecnicos
  SET especialidades = COALESCE(NEW.especialidades, especialidades),
      regiao_atuacao = COALESCE(v_regiao, regiao_atuacao),
      updated_at = now()
  WHERE prestador_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_prestador_to_tecnico ON public.prestadores;
CREATE TRIGGER trg_sync_prestador_to_tecnico
AFTER UPDATE ON public.prestadores
FOR EACH ROW
EXECUTE FUNCTION public.sync_prestador_to_tecnico();