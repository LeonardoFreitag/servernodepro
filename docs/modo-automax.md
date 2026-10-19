# servernodepro em loja AutoMax (`MODO=AUTOMAX`)

Data: 19/10/2026. A mesma API que atende o Mettre passa a atender uma loja AutoMax: a maquineta Cielo roda o ReactMettre em **Modo Terminal**, o FrenteDeCaixa enfileira em `COBRANCAS_TERMINAL` e a API faz o que já faz no Mettre. Nenhuma rota nova — só o que muda com `MODO`.

## O que `MODO=AUTOMAX` muda

| Ponto | Mettre (padrão) | AutoMax |
|---|---|---|
| Rotas montadas | todas | só `/`, `/health`, `/config`, `/func`, `/cielo`, `/pagamentos`, `/cobrancas` (`src/app.ts`) |
| Jobs na subida | módulo digital (`providers`, `requests` a cada 15 s, watchdog) + expiração de cobranças | **só** expiração de cobranças (`src/bin/server.ts`) |
| `ORIGEM` aceita | `M` mesa, `B` balcão, `E` entrega | `V` venda, `S` ordem de serviço, `A` (`PDV_RECEB_PAGTOS.ORIGEM`) — `pagamentos.mapping.ts` |
| `GET /config` | lê tabela `CONFIG` | responde do `.env` (credenciais Cielo), sem banco |
| `GET /func` | view `V_FUNC` (FUNCIONARIOS) | view `V_FUNC` criada pelo script sobre `VENDEDOR` (código, nome, senha; só ativos) |
| `/health` e `requireDbVersion` | `VERSAO_SCRIPTS` ≥ 23 (Script23) | idem — `Script_AutoMax_Maquininha_v1.sql` grava `NUMERO = 23` |

Contrato de `CIELO_PAGAMENTOS`/`COBRANCAS_TERMINAL`: idêntico (`docs/rotas-pagamentos-cobrancas.md`, `prompt-api-script23-contrato-firebird.md`). `COD_MESA`/`COD_VENDA` recebem `PDV_RECEB_PAGTOS.COD_ORIGEM`.

## `.env` da loja AutoMax

```ini
MODO=AUTOMAX
PORT=3000
FIREBIRD_HOST=127.0.0.1
FIREBIRD_PORT=3050            # no dev do Leonardo o FB5 escuta em 3051
CONNECTION_STRING=C:\AutoMax\Dados\AUTOMAX50.FDB
FIREBIRD_USER=API_MAQ         # usuário Legacy (ver abaixo) — ou SYSDBA
FIREBIRD_PASSWORD=...
API_KEY=...                   # mesmo valor configurado no app (X-Api-Key)
CIELO_CLIENT_ID=...
CIELO_ACCESS_TOKEN=...
```
As chaves do módulo digital (Twilio, Firebase, VENON_BOT, FRONTEND_URL) podem ficar vazias — nada as lê em `MODO=AUTOMAX`.

## Firebird 5 × node-firebird 0.9.9 (o ponto crítico)

O driver `node-firebird@0.9.9` fala **só o protocolo legado** (sem Srp, sem wire encryption). No Firebird 5 padrão (`AuthServer = Srp256`, `WireCrypt = Required`) a conexão é recusada com *"Incompatible wire encryption levels"* ou *"Your user name and password are not defined"*. No `firebird.conf` do servidor da loja:

```ini
AuthServer = Srp256, Srp, Legacy_Auth
AuthClient = Srp256, Srp, Legacy_Auth
UserManager = Srp, Legacy_UserManager
WireCrypt = Enabled
```
Reiniciar o serviço Firebird e criar um usuário legado só para a API:
```sql
CREATE USER API_MAQ PASSWORD 'senha_forte' USING PLUGIN Legacy_UserManager;
GRANT SELECT, INSERT, UPDATE ON CIELO_PAGAMENTOS TO API_MAQ;
GRANT SELECT, INSERT, UPDATE ON CIELO_PAGAMENTOS_ITENS TO API_MAQ;
GRANT SELECT, INSERT, UPDATE ON COBRANCAS_TERMINAL TO API_MAQ;
GRANT SELECT ON VERSAO_SCRIPTS TO API_MAQ;
GRANT SELECT ON V_FUNC TO API_MAQ;
GRANT EXECUTE ON PROCEDURE P_COBRANCAS_EXPIRAR TO API_MAQ;
GRANT USAGE ON SEQUENCE G_CIELO_PAGAMENTOS TO API_MAQ;
GRANT USAGE ON SEQUENCE G_CIELO_PAGAMENTOS_ITENS TO API_MAQ;
```
(`SYSDBA` com senha legada também funciona, mas o usuário dedicado limita o estrago de uma chave vazada.) Senha legada: máximo 8 caracteres significativos.

Alternativa sem mexer no `firebird.conf`: migrar o driver para `node-firebird-driver-native` (usa `fbclient.dll`, suporta Srp e WireCrypt). Fica para depois — exige trocar `src/shared/database/fb.ts`.

## Instalação na loja (ordem)

1. Backup do `.FDB` → `Script_AutoMax_Maquininha_v1.sql` (isql/IBExpert como SYSDBA) → conferir as consultas do fim do script.
2. `firebird.conf` + usuário legado (acima) → reiniciar o Firebird.
3. Copiar a pasta da API (`dist/`, `node_modules/`, `start_node.bat`, `.env`), ajustar o `.env`, subir com `start_node.bat` (ou como serviço com `nssm`).
4. **Teste 1 — banco**: `GET http://<ip>:3000/health` → `{"status":"ok","db":{"scriptAtual":23,"ok":true}}`. Se `scriptAtual` for `null`, o problema é autenticação/driver (passo 2); se for `0`, o script não rodou.
5. **Teste 2 — login**: `GET /func` lista os vendedores ativos com senha.
6. **Teste 3 — fila sem o PDV**: no banco,
   ```sql
   INSERT INTO COBRANCAS_TERMINAL (ORIGEM, COD_VENDA, COD_CAIXA, VALOR, TIPO_PRE, MODO, TERMINAL_ID, EXTERNAL_REF, EXPIRA_EM)
   VALUES ('V', 0, 0, 1.00, 'DEBIT', 'A', 'CAIXA01', 'TESTE-FASE0', DATEADD(7 MINUTE TO CURRENT_TIMESTAMP));
   ```
   O app (Modo Terminal, `terminalId = CAIXA01`, apontado para `<ip>:3000`, mesma `X-Api-Key`) deve pegar a cobrança, cobrar R$ 1,00 na maquineta e, ao aprovar, aparecer uma linha em `CIELO_PAGAMENTOS` com `COBRANCA_ID` preenchido, `PROVIDER='CIELO'`, `ORIGEM='V'`, `STATUS_CODE` 0/1. Estornar depois no app/portal.
7. Só então o FrenteDeCaixa (Fase 1) entra.

## Configuração do app na maquineta

Empresa: IP/porta da API da loja. Configurações → provedor `CIELO`, credenciais Cielo (vêm do `/config`), `terminalId` igual ao `[MAQUININHA] TerminalId` do `tef.ini` da estação, `X-Api-Key`, **Modo Terminal ativo**. Após o login o app vai direto para a tela de espera; não há comandas/mesas numa loja AutoMax.
