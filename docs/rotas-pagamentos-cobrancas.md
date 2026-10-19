# Pagamentos de maquineta e fila de cobranças (`/pagamentos`, `/cobrancas`)

Implementado em 15/09/2026 (Etapa A — Cielo; mapeamento Stone já presente para a Etapa B).
Revisado em 19/10/2026 conforme o contrato da equipe Delphi ("contrato definitivo com o Firebird do Mettre e pacote Script23"): Pix íntegro, idempotência, `REFERENCIA`/`MANUAL`, estorno manual, `GET /health` e guarda de versão do banco. Pré-requisito no banco: **Script23** (ver `docs/migracao-pagamentos.md`).

## Contrato com o banco (resumo do que importa para a API)

- `CIELO_PAGAMENTOS` tem **dois escritores**: a API e o próprio `Frente.exe` (canal automax-api, Stone). Por isso o `ID` vem sempre de `GEN_ID(G_CIELO_PAGAMENTOS, 1)` na mesma transação do INSERT, e linhas que a API não criou são normais.
- A API **nunca** apaga linhas (há FK de `RECEB_CARTOES`, `COBRANCAS_TERMINAL` e `CIELO_PAGAMENTOS_ITENS`), nunca escreve em `CONSUMIDO`, `CONSUMIDO_EM` e `COD_RECEB_CARTOES` (são do PDV) e nunca grava `PROVIDER`, `ORIGEM`, `TRANSACTION_TYPE` ou `STATUS_CODE` nulos.
- `STATUS_CODE`: `'0'` Pix aprovado, `'1'` cartão aprovado (`'2'` cancelado/negado — a API não grava; o app só envia aprovados). Derivado do tipo; o `statusCode` cru do provedor fica em `PAYLOAD_JSON`.
- `TRANSACTION_TYPE` (`CREDIT | DEBIT | VOUCHER | INSTANT_PAYMENT`) é o que o PDV usa para o `tPag`; na Cielo prevalece o que a maquineta fez (`paymentCode`), o pedido do app é fallback. Pix é detectado também por `paymentFields.primaryProductName` contendo `PIX` (FAQ Cielo Smart). `MEIO_PAGAMENTO` fica com o valor bruto (voucher Cielo mantém `ALIMENTACAO`/`REFEICAO`, que o PDV usa para decidir 10 ou 11).
- `AUTH_CODE` e `CIELO_CODE` são `VARCHAR(40)` após o Script23: o E2E ID do Pix (32 chars) é gravado inteiro. Truncar em 20 foi a causa do Pix perdido em produção (17/10).
- `CIELO_ORDER_ID` nunca fica nulo quando há algo: Cielo usa o order id; Stone usa o `orderId`/`order_id` ecoado, senão o `ATK`, senão a referência; pagamento manual usa a referência. É a chave do índice único por expressão `UK_CIELO_PAG_ORDER_EXPR` (`COALESCE(PROVIDER,'CIELO') || '|' || CIELO_ORDER_ID`, nulo quando não há order id).
- `REFERENCIA VARCHAR(60)` = `providerData.reference` do app (`<origem>:<codVenda>:<idLocal>`); chave secundária de idempotência. O Delphi ignora.
- `MANUAL CHAR(1)` = `'S'` quando `providerData.manual === true` (operador confirmou à mão, resposta da maquineta perdida). O PDV filtra por aqui, não pelo JSON.
- `ESTORNADO_POR` (id da cobrança de estorno ou `'MANUAL'`) + `ESTORNADO_EM`: preenchidos pela API. O PDV exclui `ESTORNADO_POR IS NOT NULL` de todas as somas.

## Módulos

- `src/modules/pdv/pagamentos` — generalização do antigo `pdv/cielo`. Tabela `CIELO_PAGAMENTOS` (nome mantido) agora guarda pagamentos de **qualquer** maquineta (`PROVIDER`, `ORIGEM`, `TRANSACTION_TYPE`, `ATK`, `COBRANCA_ID`, `ESTORNADO_POR`).
  - `pagamentos.mapping.ts` — funções puras: `providerData/rawResponse → colunas` (Cielo e Stone), validação do corpo, conversão do corpo legado. Testadas em `__tests__/mapping.test.ts`.
  - `pagamentos.service.ts` — `inserirPagamento(executor, input)` (participa de transação), `listarPagamentos(origem, codVenda)`.
- `src/modules/pdv/cobrancas` — fila `COBRANCAS_TERMINAL` (attended/detached, pagamento/estorno).
- `src/modules/pdv/cielo` — **alias legado**: `POST /cielo/pagamento` e `GET /cielo/pagamentos/:codMesa` continuam respondendo como antes (sem `X-Api-Key`).
- `src/shared/database/fb.ts` — `withDb`, `fbQuery`, `withTransaction` (READ COMMITTED) sobre node-firebird.
- `src/shared/middlewares/apiKey.ts` — exige `X-Api-Key` = `API_KEY` do `.env`; vazio = não exige.
- `src/bin/server.ts` — `setInterval(30 s)` → `EXECUTE PROCEDURE P_COBRANCAS_EXPIRAR`.

## Configuração

`.env`: `API_KEY=<chave>` (opcional). O app envia o mesmo valor em `X-Api-Key`.

## Versão do banco: `GET /health` e 503 `BANCO_DESATUALIZADO`

`src/shared/database/dbVersion.ts`. Na subida e em `GET /health` a API lê `SELECT MAX(NUMERO) FROM VERSAO_SCRIPTS` (tabela ausente = 0; cache de 60 s, `?force=1` ignora o cache):

```json
{ "status": "ok", "uptimeSeconds": 120, "db": { "scriptAtual": 23, "scriptMinimo": 23, "ok": true, "verificadoEm": "2026-10-19T12:00:00.000Z" } }
```

`/health` responde **sempre 200** — o corpo diz se está ok (`status: "degraded"` quando não). Assim o app distingue "banco desatualizado" de "API fora do ar" e bloqueia "Pagar na maquininha" com mensagem clara.

Com `scriptAtual < 23`, **todas** as rotas de `/pagamentos`, `/cobrancas` e `/cielo` (legado) respondem `503 { "erro": "BANCO_DESATUALIZADO", "scriptAtual": 21, "scriptMinimo": 23 }`. Se o banco nunca pôde ser lido desde a subida: `503 { "erro": "BANCO_INDISPONIVEL", "detalhe" }`. Se o banco cair depois de uma leitura boa, o último valor é mantido (não bloqueia quem já estava ok).

Não existe `POST /cobrancas`: o Frente insere a cobrança direto na tabela.

## Rotas

| Rota | Auth | Descrição |
|---|---|---|
| `GET /health` | — | versão do banco (acima) |
| `POST /pagamentos` | X-Api-Key | `{ provider, origem, codVenda, cobrancaId?, transactionType, installments, amountCents, totalCents, providerData, rawResponse, itens? }` → `201 { id, codVenda, duplicado:false }` na primeira vez; **`200 { id, codVenda, duplicado:true }`** quando já existia (mesmo `(PROVIDER, CIELO_ORDER_ID)` ou, sem order id, mesma `(PROVIDER, REFERENCIA)`) — nada é inserido; `422 { error }`; `500 { error, detalhe }`. `providerData.reference` → `REFERENCIA`; `providerData.manual: true` → `MANUAL='S'`. `itens?: [{ codItem, codConjuga?, qtde, valor }]` = itens da comanda cobertos pelo pagamento (`codItem` = `MESAS_ITENS.CODIGO`, `valor` em R$ com serviço rateado); gravados em `CIELO_PAGAMENTOS_ITENS` na mesma transação. |
| `GET /pagamentos/:origem/:codVenda` | — | `{ codVenda, totalPago, pagamentos[], itensPagos[] }` com o **mesmo filtro do PDV** (`sqlCieloPendentes`): `COALESCE(ORIGEM,'M') = :origem AND STATUS_CODE IN ('0','1') AND ESTORNADO_POR IS NULL` — assim `pago >= total` no app e "pendentes para importar" no caixa são o mesmo conjunto. Cada pagamento traz `consumido` (o caixa já lançou) e `manual`. `itensPagos` = `[{ codItem, codConjuga, qtde, valor }]` somado por item, com os mesmos filtros — estornar um pagamento libera os itens. |
| `PATCH /pagamentos/:id/estorno-manual` | X-Api-Key | `{ motivo, usuario? }` → `200 { id, estornadoPor:'MANUAL', estornadoEm }`. Para Pix devolvido no portal/app da Cielo, fora da maquineta. Em transação com `WITH LOCK`: pré-condição `ESTORNADO_POR IS NULL` (senão `409 { error, estornadoPor }`); grava `ESTORNADO_POR='MANUAL'`, `ESTORNADO_EM` e mescla `{ estornoManual: { usuario, motivo, em } }` no `PAYLOAD_JSON` sem perder a resposta bruta. `REFERENCIA` não é tocada. `404` se não existe, `422` sem motivo. |
| `POST /cielo/pagamento` | — | legado: `{ codMesa, paymentCode, cieloResponse }` → grava `PROVIDER='CIELO'`, `ORIGEM='M'`; `201`/`200 { id, codMesa, duplicado }` |
| `GET /cielo/pagamentos/:codMesa` | — | legado = `GET /pagamentos/M/:codMesa` (resposta inclui `codMesa`) |
| `GET /cobrancas/pendentes?terminalId=X` | X-Api-Key | attended: no máximo 1 `pending` de `MODO='A'` do terminal (expira antes). Só `CANAL='L'` (nulo conta como `'L'`); `CANAL='A'` é do canal automax-api, que o Frente mesmo executa. |
| `GET /cobrancas/cards?entregador=N` / `?mesas=1` | X-Api-Key | detached: `pending` + `sent_to_terminal`, só `CANAL='L'` |
| `GET /cobrancas/:id` | X-Api-Key | DTO |
| `POST /cobrancas/:id/claim { terminalId, codEntregador? }` | X-Api-Key | `pending`→`sent_to_terminal`; mesmo terminal repetido → 200; senão 409 `{ error, status }`. Ver a guarda de entregador abaixo. |
| `PATCH /cobrancas/:id` | X-Api-Key | desfecho idempotente (ver abaixo) |
| `POST /cobrancas/:id/cancelar` | X-Api-Key | `pending`→`canceled` (200); `sent_to_terminal`→`CANCEL_REQUESTED='S'` (202); final → 409 |

### `PATCH /cobrancas/:id`

`{ terminalId, provider, status: approved|declined|canceled|error, motivoErro?, pagamento? }`

Numa única transação, com `SELECT ... WITH LOCK`:
1. status já final → `200` com o DTO atual, **sem alterar nada** (a fila offline do app reenvia). Exceção: `approved` atrasado sobre `canceled`/`expired` ainda grava o pagamento (seção abaixo).
2. `MODO='A'` e `terminalId` ≠ `TERMINAL_ID` → `409`.
3. `approved` + `OPERACAO='P'` → insere em `CIELO_PAGAMENTOS` (`COBRANCA_ID=id`, idempotente como no POST) e grava `PAGAMENTO_ID`. Sem `pagamento` → `422`. `pagamento.providerData.reference` vai para `REFERENCIA`.
4. `approved` + `OPERACAO='C'` → `CIELO_PAGAMENTOS.ESTORNADO_POR = id`, `ESTORNADO_EM = CURRENT_TIMESTAMP`. O Frente cria o estorno (`OPERACAO='C'`, `ALVO_PAGAMENTO_ID`); a API resolve do alvo `ATK` (Stone) ou `CIELO_ORDER_ID`/`AUTH_CODE`/`CIELO_CODE` (Cielo) e entrega ao app no DTO (`alvo`).
5. `declined|canceled|error` → `STATUS`, `PROVIDER`, `MOTIVO_ERRO` (≤200).

O trigger `BU0` do banco **não lança exceção** quando um status final tentaria regredir: ele mantém `OLD.STATUS` em silêncio. A API nem chega a tentar (regra 1), mas se chegasse não seria erro.

### Guarda de entregador no `claim`

`codEntregador` é opcional no corpo. Quando o aparelho manda o código do funcionário logado **e** o card tem `COD_ENTREGADOR` preenchido, um valor diferente devolve `409 { error: "Esta cobranca e de outro entregador", status }` sem alterar nada — inclusive para um card já `sent_to_terminal`. Sem o campo, o claim se comporta exatamente como antes, o que mantém o app já instalado funcionando; num card sem dono (mesa, attended) o campo é ignorado. Um valor presente mas inválido (não inteiro, ≤ 0) devolve `422`.

A checagem acontece dentro da mesma transação e do mesmo `SELECT ... WITH LOCK` do claim — fora dali não valeria sob concorrência. É a segunda barreira: a primeira é o PDV, que ao trocar o entregador de um pedido cancela o card antigo e cria outro, matando o que estava no cache do aparelho anterior.

### DTO de cobrança

Ver `cobrancas.dto.ts` (`rowToDTO`). `alvo` só vem em `OPERACAO='C'`: `{ pagamentoId, provider, atk, cieloOrderId, authCode, cieloCode, merchantCode, valorCents, transactionType, installments }`. `merchantCode` = `CIELO_PAGAMENTOS.COD_EC` (Cielo: `merchantCode` do pagamento; Stone: `null`) — o deep link `lio://payment-reversal` exige `merchantCode` e `value` (= `valorCents`) além de `cieloCode`/`authCode`, senão a maquineta responde "Parâmetros inválidos: Json inválido".

## Convenções Stone (Etapa B)

`CIELO_CODE` recebe o `itk`; `NSU` = `authorizationCode`; `TERMINAL` = `terminalId` do app; `STATUS_CODE` `'0'` para Pix, `'1'` demais.

## Log em arquivo

`src/shared/utils/pagamentosLog.ts` → `logs/pagamentos.jsonl` (JSON por linha, fora de `dist/`, nunca lança). Eventos: `ok`, `duplicado`, `rejeitado` (422/400, com o corpo), `erro` (500, com corpo + mensagem e `gdscode` do Firebird), `estorno_manual`, `desfecho_ok`/`desfecho_erro` (`PATCH /cobrancas/:id`). É o primeiro lugar a olhar quando o caixa diz que "o pagamento não apareceu".

## Testes

`npm test` roda os unitários, sem banco: `pagamentos/__tests__/mapping.test.ts` (inclui Pix com E2E de 32 chars, `REFERENCIA`, `MANUAL`, fallbacks de `CIELO_ORDER_ID`), `service.test.ts` (idempotência, corrida no índice único, filtro do PDV, estorno manual), `controller.test.ts` (201/200/422/500, estorno manual), `cobrancas/__tests__/*`, `shared/database/__tests__/dbVersion.test.ts` (`/health` e 503 com banco em 21 e 23).

`__tests__/integracao.firebird.test.ts` exercita o SQL real (transações, `WITH LOCK`, `EXECUTE PROCEDURE`, `SELECT FIRST`, `RETURNING` em DML, triggers `BI0`/`BU0`, índice `UK_CIELO_PAG_ORDER_EXPR`, estorno manual, `VERSAO_SCRIPTS`, filtro `CANAL`). Fica **pulado** por padrão; para rodar, crie um banco descartável com `__tests__/fixtures/schema_teste.sql` (DDL real do Script21 + Script23, extraído do banco de dev em 19/10/2026), aponte o `.env` para ele e use `FB_INTEGRATION=1 npm test -- integracao`.

Dois achados do teste de integração (16/09/2026), rodado contra um Firebird 3.0 descartável:

1. **`EXECUTE PROCEDURE P_COBRANCAS_EXPIRAR` é a forma correta.** Funciona tanto se a procedure for selecionável (com `SUSPEND`) quanto executável (sem). Já o `SELECT * FROM P_COBRANCAS_EXPIRAR` — que a especificação original sugeria — falha com *"Procedure P_COBRANCAS_EXPIRAR is not selectable"* quando a procedure não tem `SUSPEND`. Como o Script21 já está aplicado e não dá para ver a procedure daqui, a API usa a forma que serve aos dois casos.
2. **node-firebird 0.9.9 só fala `Legacy_Auth`.** Contra o Firebird 2.5 de produção isso é indiferente (2.5 é legacy por natureza), mas um Firebird 3 de testes precisa de `AuthServer = Srp, Legacy_Auth`, `UserManager = Srp, Legacy_UserManager` e `WireCrypt = Disabled` no `firebird.conf`, além de um usuário criado com `USING PLUGIN Legacy_UserManager`. Sem isso o erro é *"Incompatible wire encryption levels"* ou *"No matching plugins on server"*.

Achado do smoke de 19/10/2026 (contra o banco de dev, Firebird 2.5.9):

3. **node-firebird 0.9.9 não lê BLOB em `query()`.** A coluna vem como uma função de leitura preguiçosa que abre transação própria e falha com *"invalid BLOB ID"* — dentro de `WITH LOCK` e também depois do auto-commit. Para ler `PAYLOAD_JSON` a API usa `CAST(PAYLOAD_JSON AS VARCHAR(32000))` (o maior payload Cielo observado tem ~3 KB). Se o CAST estourar, o estorno manual é gravado assim mesmo, sem anotar no payload (o motivo fica em `logs/pagamentos.jsonl`).

Achado do teste contra o Firebird 5 (AutoMax, 19/10/2026):

4. **`SUM` sobre NUMERIC no Firebird 4+ devolve INT128**, tipo que o node-firebird 0.9.9 não conhece: o driver lança `Error: Unexpected` de dentro do callback do socket e **derruba o processo**. No 2.5 o mesmo `SUM` é BIGINT e funciona. Regra: toda agregação numérica em SQL leva `CAST(SUM(...) AS NUMERIC(p,s))`. `COUNT(*)` e `GEN_ID` não têm o problema. Como rede de segurança, `server.ts` registra `process.on('uncaughtException')` que loga `[fatal-evitado]` e mantém a API de pé.
