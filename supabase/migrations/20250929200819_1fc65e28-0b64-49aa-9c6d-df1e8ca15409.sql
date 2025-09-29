-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION public.atualizar_estoque()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.insumos 
    SET quantidade = quantidade + NEW.quantidade,
        updated_at = now()
    WHERE id = NEW.insumo_id;
  ELSIF NEW.tipo = 'saida' THEN
    UPDATE public.insumos 
    SET quantidade = quantidade - NEW.quantidade,
        updated_at = now()
    WHERE id = NEW.insumo_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;