

## Problem

Diego has two separate accounts:

| Account | Email | Role | Technician record | Prestador |
|---|---|---|---|---|
| Old (active) | diego14borges@gmail.com | tecnico_campo | Yes (871da72f) | No |
| New (broken) | servicosdiego6@gmail.com | **none** | No | Yes (777d1943) |

The old account (`diego14borges`) has actual work orders assigned (OS000003, OS000005) and a working technician setup. The new account (`servicosdiego6`) was created later but is incomplete — no role, no technician record.

The user wants **servicosdiego6@gmail.com** to be the active account going forward.

## Plan

### 1. Fix the new account (servicosdiego6)

Via database inserts:

- **Insert `user_roles`**: Add `role = 'tecnico_campo'` for user `a840c3ff-669d-4b0a-864f-fba112f11b58`
- **Insert `tecnicos`**: Create technician record linked to profile `b2145eb8-f5f9-4225-af5f-21fddc3e6ca3`

### 2. Migrate work orders to the new technician

After creating the new technician record, update `ordens_servico` rows currently pointing to the old technician ID (`871da72f`) to point to the new one.

### 3. Deactivate the old account (diego14borges)

- Update the old profile (`3a05967f`) to `ativo = false` so it no longer appears active
- Optionally remove the old `user_roles` entry to prevent login confusion

### 4. No code changes needed

The application logic is correct — this is purely a data correction.

---

### Technical Details

**Step 1** — Insert role and technician for servicosdiego6:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('a840c3ff-669d-4b0a-864f-fba112f11b58', 'tecnico_campo')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO tecnicos (profile_id, especialidades, regiao_atuacao)
VALUES ('b2145eb8-f5f9-4225-af5f-21fddc3e6ca3', '{}', '');
```

**Step 2** — Reassign work orders (after getting new tecnico ID):
```sql
UPDATE ordens_servico SET tecnico_id = '<new_tecnico_id>'
WHERE tecnico_id = '871da72f-37d0-41d4-810c-e15daf2e030d';
```

**Step 3** — Deactivate old account:
```sql
UPDATE profiles SET ativo = false WHERE id = '3a05967f-66ee-4acb-8cd2-76861f52eb56';
```

