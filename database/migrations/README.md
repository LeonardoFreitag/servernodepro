# Scripts de banco (Firebird)

Os scripts de schema do Mettre são da equipe Delphi e numerados (`Script21`, `Script23`, …). Cada um registra sua aplicação em `VERSAO_SCRIPTS`, que a API lê em `GET /health`.

| Script | Conteúdo | Situação |
|---|---|---|
| `Script23_Pagamentos_Maquineta.sql` | Script21 completo + `AUTH_CODE`/`CIELO_CODE` 40, `REFERENCIA`, `MANUAL`, `ESTORNADO_EM`, `UK_CIELO_PAG_ORDER_EXPR`, backfill, `VERSAO_SCRIPTS` | **Aplicado no banco de dev em 19/10/2026. Arquivo ainda não entregue pela equipe Delphi — colocar aqui quando chegar.** |

Regras:
- A API exige `MAX(NUMERO) >= 23` (`SCRIPT_MINIMO` em `src/shared/database/dbVersion.ts`) para gravar pagamentos.
- Não criar scripts paralelos aqui: necessidade nova de schema vira bloco no Script23 ou Script24+ com `INSERT` em `VERSAO_SCRIPTS`, acordado com a equipe Delphi.
- Como rodar e checklist: `docs/migracao-pagamentos.md`.
