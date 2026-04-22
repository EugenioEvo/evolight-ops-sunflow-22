---
name: Upload de fotos e vídeos (galeria, câmera, área de transferência)
description: Todos os componentes de upload de evidência aceitam imagens E vídeos. Inputs usam accept="image/*,video/*". Câmera (capture="environment") permite gravar no momento. Limites: 5MB foto, 50MB vídeo, máx 10 arquivos por tipo.
type: feature
---

O sistema de upload de mídia em formulários, no Wizard do RME e no anexador de tickets aceita três fontes de entrada:
1. **Câmera** — `<input type="file" accept="image/*,video/*" capture="environment">` abre o app nativo de câmera no mobile e permite tirar foto OU gravar vídeo.
2. **Galeria** — `<input type="file" accept="image/*,video/*" multiple>` lista fotos e vídeos do dispositivo.
3. **Colar** — `navigator.clipboard.read()` captura imagens da área de transferência (vídeo da clipboard não é suportado em browsers).

**Componentes envolvidos:**
- `src/components/rme-wizard/StepEvidence.tsx` (Wizard moderno do RME)
- `src/pages/RME.tsx` (formulário legado)
- `src/components/FileUpload.tsx` (anexos de tickets)
- `src/features/rme/hooks/useRMEActions.ts` (validação)

**Validação no cliente:**
- Imagens: JPG/PNG/WEBP até 5 MB
- Vídeos: qualquer MIME `video/*` até 50 MB
- Máx. 10 arquivos por tipo (antes / depois)

**Storage:** buckets `rme-fotos` e `ticket-anexos` não restringem MIME (`allowed_mime_types = NULL`); a validação fica no frontend. URLs assinadas com TTL de 1 ano são geradas para preview/download.

**Preview:** componentes detectam vídeo por extensão (`/\.(mp4|webm|mov|m4v|avi|mkv|3gp|quicktime)/i`) e renderizam `<video muted playsInline preload="metadata">` no lugar de `<img>`. PDF do RME continua exportando apenas miniaturas de imagens (vídeos ficam disponíveis pela URL assinada).
