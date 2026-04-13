

## Problem Analysis

There are **two disconnected signature systems** in the RME:

1. **Wizard (StepSignatures)**: Saves signatures as a JSON object in the `signatures` column — stores name + timestamp for three roles (responsável, gerente_manutenção, gerente_projeto). This IS working and data IS being saved correctly (confirmed in DB).

2. **RMEDetailDialog**: Only renders the **legacy** columns `assinatura_tecnico` and `assinatura_cliente` (expects image URLs). These columns are **always NULL** because the wizard never writes to them. The dialog completely **ignores** the `signatures` JSON field.

**Result**: Signatures entered in the wizard are saved but never displayed when viewing the RME detail.

---

## Plan

### 1. Fix RMEDetailDialog to display `signatures` JSON

Update `src/components/RMEDetailDialog.tsx` (lines 300-331) to render the `signatures` JSON data from the wizard. Show each role (Responsável Técnico, Gerente de Manutenção, Gerente de Projeto) with the signer name and timestamp. Keep the legacy `assinatura_tecnico`/`assinatura_cliente` image rendering as a fallback for any old records.

### 2. Fix GerenciarRME page (if applicable)

Check `src/pages/GerenciarRME.tsx` to ensure the signatures JSON is also displayed there if RME details are shown inline.

---

### Technical Details

**RMEDetailDialog changes** — Replace the Assinaturas card section:
- Render `rme.signatures` JSON (keys: `responsavel`, `gerente_manutencao`, `gerente_projeto`) showing name and formatted date
- Keep legacy image fields as secondary display
- Show "Nenhuma assinatura registrada" when both systems are empty

