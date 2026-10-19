# Migração do banco para a versão nova de pagamentos de maquineta (Script23)

Atualizado em 19/10/2026.

## O que é

A API nova (`/pagamentos`, `/cobrancas`, `/health`) e o app 1.11.0 exigem que o banco Firebird do cliente tenha o **Script23_Pagamentos_Maquineta.sql** da equipe Delphi aplicado. Ele é idempotente (`EXECUTE BLOCK` + `IF NOT EXISTS … EXECUTE STATEMENT`), roda em Firebird 2.5 e 5, pode ser executado várias vezes e contém:

- Script21 completo: colunas de `CIELO_PAGAMENTOS` (`PROVIDER`, `ORIGEM`, `TRANSACTION_TYPE`, `ATK`, `COBRANCA_ID`, `ESTORNADO_POR`, `CONSUMIDO`, `CONSUMIDO_EM`, `COD_RECEB_CARTOES`), tabelas `CIELO_PAGAMENTOS_ITENS` e `COBRANCAS_TERMINAL`, triggers `BI0`/`BU0`, `P_COBRANCAS_EXPIRAR`, `RECEB_CARTOES.PARCELAS`;
- `AUTH_CODE` e `CIELO_CODE` → `VARCHAR(40)` (Pix = E2E ID de 32 chars; era 20 e truncava → HTTP 500 → Pix nunca gravado);
- `REFERENCIA VARCHAR(60)`, `MANUAL CHAR(1) DEFAULT 'N'`, `ESTORNADO_EM TIMESTAMP`;
- índice único por expressão `UK_CIELO_PAG_ORDER_EXPR`;
- backfill das linhas legadas (`PROVIDER='CIELO'`, `ORIGEM='M'`, `CONSUMIDO='N'`, `STATUS_CODE` 0/1);
- tabela `VERSAO_SCRIPTS (NUMERO, NOME, APLICADO_EM)` com 21 e 23 — é o que `GET /health` lê.

**Onde está o arquivo:** a equipe Delphi mantém o Script23 junto do fonte do Frente. Quando for entregue, versioná-lo em `database/migrations/Script23_Pagamentos_Maquineta.sql` neste repositório (ver `database/migrations/README.md`). Esta API **não** tem um script próprio: qualquer necessidade nova de schema entra como bloco no Script23 ou como Script24+ com `INSERT` em `VERSAO_SCRIPTS`.

> O arquivo `src/modules/pdv/__tests__/fixtures/schema_teste.sql` é só para o teste de integração contra um banco descartável. É o DDL real extraído do banco de dev, mas **não** é idempotente nem faz backfill — não usar em cliente.

## Por que a ordem importa

A Cielo Store atualiza o app nas maquinetas sozinha. Um app novo contra uma API velha, ou uma API nova contra um banco velho, perde pagamento. Por isso:

1. **Backup do `.FDB`** (`gbak -b` ou cópia com o serviço parado).
2. **Script23** no banco do cliente (isql ou IBExpert, como SYSDBA).
3. **Conferir** as consultas do fim do script (colunas de `CIELO_PAGAMENTOS`, tabelas, procedure, `SELECT * FROM VERSAO_SCRIPTS` → 21 e 23).
4. **API nova** (`npm run build` → `dist/`, deploy pelo `start_node.bat`). Na subida ela loga `[db] VERSAO_SCRIPTS = 23 (mínimo 23) — ok`; `GET /health` tem de responder `db.ok: true`.
5. **Frente novo** (Fase 8, equipe Delphi).
6. **Uma venda de teste com Pix e uma com cartão**: aparecem em `GET /pagamentos/M/:mesa` com `AUTH_CODE` inteiro e no botão "usar pagamentos da maquininha" do caixa.
7. **Só depois de todos os clientes**, publicar o app na Cielo Store.

## Como rodar o Script23

**isql (Firebird 2.5, Windows):**
```bat
"C:\Program Files\Firebird\Firebird_2_5\bin\isql.exe" -u SYSDBA -p <senha> -i Script23_Pagamentos_Maquineta.sql -o script23.log "localhost:C:\Projetos\Mettre\Dados\DADOS.FDB"
```
Ler `script23.log` até o fim: não pode haver `Statement failed`.

**IBExpert:** Tools → Script Executor → abrir o arquivo → marcar "Use current connection" → F9. Conferir a aba de mensagens.

Rodar de novo é seguro: cada bloco verifica `RDB$RELATION_FIELDS`/`RDB$RELATIONS`/`RDB$INDICES` antes de criar.

## Checklist pós-migração

- [ ] `SELECT NUMERO, NOME, APLICADO_EM FROM VERSAO_SCRIPTS` → linhas 21 e 23.
- [ ] `AUTH_CODE` e `CIELO_CODE` com 40: `SELECT F.RDB$CHARACTER_LENGTH FROM RDB$RELATION_FIELDS RF JOIN RDB$FIELDS F ON F.RDB$FIELD_NAME = RF.RDB$FIELD_SOURCE WHERE RF.RDB$RELATION_NAME = 'CIELO_PAGAMENTOS' AND RF.RDB$FIELD_NAME IN ('AUTH_CODE','CIELO_CODE')`.
- [ ] Índice: `SELECT RDB$INDEX_NAME FROM RDB$INDICES WHERE RDB$RELATION_NAME = 'CIELO_PAGAMENTOS'` inclui `UK_CIELO_PAG_ORDER_EXPR`.
- [ ] Nenhum `STATUS_CODE` nulo: `SELECT COUNT(*) FROM CIELO_PAGAMENTOS WHERE STATUS_CODE IS NULL` → 0 (linha nula é invisível para o caixa).
- [ ] `GET /health` → `db.ok: true`. Se `false`, a API responde 503 `BANCO_DESATUALIZADO` em `/pagamentos`, `/cobrancas` e `/cielo` até o script ser aplicado.
- [ ] `POST /pagamentos` de teste duas vezes com o mesmo `rawResponse.id` → `201 duplicado:false` e depois `200 duplicado:true`, uma linha só.
- [ ] `logs/pagamentos.jsonl` recebendo `ok`.

## O que o time Delphi precisa saber da API

- `AUTH_CODE`/`CIELO_CODE` chegam com até 40 chars (Pix = E2E completo).
- `STATUS_CODE`: `'0'` Pix, `'1'` cartão — nunca nulo. `TRANSACTION_TYPE` nunca nulo.
- `CIELO_ORDER_ID` nunca nulo quando há algo (Stone: `orderId`, senão `ATK`, senão a referência; manual: a referência).
- `REFERENCIA` = `<origem>:<codVenda>:<idLocal>` do app; uso interno da API (idempotência).
- `MANUAL='S'` + `PAYLOAD_JSON { "manual": true, "motivo": … }` = operador confirmou à mão; conferir o comprovante antes de conciliar.
- Estorno manual (Pix devolvido no portal): `ESTORNADO_POR='MANUAL'`, `ESTORNADO_EM`, `PAYLOAD_JSON.estornoManual { usuario, motivo, em }`.
- A API só lê `CANAL='L'` em `COBRANCAS_TERMINAL`; `CANAL='A'` é do automax-api.
- `impressoes_caixa` existe e é onde `POST /mesas/fechaConta` grava (generator `g_print_group_caixa`), ao lado de `IMPRESSOES`. Não foi alterado.
