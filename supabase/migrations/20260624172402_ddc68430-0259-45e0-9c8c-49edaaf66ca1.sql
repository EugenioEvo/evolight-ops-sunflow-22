
CREATE TABLE public.obra_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_obra_share_tokens_obra ON public.obra_share_tokens(obra_id);
CREATE UNIQUE INDEX idx_obra_share_tokens_active ON public.obra_share_tokens(obra_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_share_tokens TO authenticated;
GRANT ALL ON public.obra_share_tokens TO service_role;

ALTER TABLE public.obra_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage obra share tokens"
  ON public.obra_share_tokens
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
    OR public.has_role(auth.uid(), 'supervisao'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
    OR public.has_role(auth.uid(), 'supervisao'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'sup_eletromecanico'::app_role)
    OR public.has_role(auth.uid(), 'lider_eletromecanico'::app_role)
  );
