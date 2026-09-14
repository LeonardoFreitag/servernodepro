# GET /providers/status — estado das vendas on-line (consumo do PDV)

Endpoint **somente leitura** usado pela Frente de Caixa (Delphi) para alimentar o
indicador de vendas on-line na barra de título das telas de venda.

Antes dele o PDV só conhecia o estado real enquanto estava enviando heartbeat
(dentro do horário, com abertura automática ligada). Em regime manual, fora do
horário ou pausado, ficava sem informação e exibia "sem conexão". Esta rota
fecha essa lacuna sem mudar nenhum contrato existente.

## Requisição

```
GET /providers/status?id=<WEB_KEY do estabelecimento>
```

`id` é o mesmo identificador usado em `PUT /providers` e `POST /providers/heartbeat`.
Nenhum outro parâmetro, header ou corpo é necessário — a rota tem exatamente a
mesma exposição das demais rotas de `/providers` (hoje sem middleware de
autenticação próprio; se um for adicionado a `/providers`, esta rota o herda).

## Respostas

| Situação | Status | Corpo |
| --- | --- | --- |
| `id` ausente/vazio | `400` | `{ "erro": "id é obrigatório" }` |
| `id` desconhecido | `404` | `{ "erro": "provider não encontrado" }` |
| `id` conhecido | `200` | payload abaixo |
| falha ao consultar o Firestore | `500` | `{ "erro": "..." }` |

```json
{
  "open": true,
  "source": "heartbeat",
  "since": "2026-09-12T18:00:07-04:00",
  "serverTime": "2026-09-12T19:42:31-04:00"
}
```

- `open` (boolean, **sempre presente**): estado atual persistido do provider —
  o mesmo que `PUT /providers` grava e o watchdog altera (`open: 'S'` → `true`).
- `source` (string, opcional): quem definiu o estado atual — `manual`
  (PUT /providers), `heartbeat` (reaberto por heartbeat), `watchdog` (fechado
  por ausência de heartbeat), `panel` (painel web) ou outro valor livre. O PDV
  apenas exibe; não decide nada com base nele.
- `since` (ISO-8601 com offset local do servidor, opcional): quando o estado
  atual foi definido.
- `serverTime` (ISO-8601 com offset local, sempre presente): relógio do servidor
  no momento da resposta (nunca vem do cache).

`source` e `since` são omitidos em documentos legados que ainda só têm o campo
`open` — o PDV deve tratá-los como opcionais.

## Garantias

- **Sem efeito colateral.** É um `SELECT` puro: não abre, não fecha, não
  registra heartbeat, não renova `lastHeartbeatAt` e não interfere no watchdog.
  Consultar de 30 em 30 s não impede o fechamento por ausência de heartbeat
  (coberto por teste).
- **Idempotente** e sem log por requisição (apenas nível `debug`, namespace
  `providers:status`; habilite com `DEBUG=providers:status`).
- **Cache em memória de 5 s** por `id` (`STATUS_CACHE_TTL_MS`), incluindo o caso
  de `id` desconhecido. Escritas feitas por este processo (PUT /providers,
  reabertura por heartbeat, fechamento pelo watchdog) invalidam o cache na hora;
  mudanças feitas fora do processo (painel web) aparecem em no máximo 5 s —
  dentro do limite de ~10 s. Uma loja com 8 terminais gera ~16 req/min e no
  máximo ~12 leituras/min no Firestore.
- Responde com `Cache-Control: no-store`.

## Modelo de dados

O documento `providers/{id}` ganhou dois campos opcionais, gravados junto com
`open` a cada mudança de estado:

| Campo | Conteúdo |
| --- | --- |
| `openSource` | `manual` \| `heartbeat` \| `watchdog` \| `panel` \| livre |
| `openChangedAt` | ISO-8601 com offset local do servidor |

O contrato HTTP de `PUT /providers`, `POST /providers/heartbeat`,
`POST /restaurante/abrir` e `POST /restaurante/fechar` não mudou. Na leitura,
`openChangedAt` também aceita `Timestamp` do Firestore, `Date` ou epoch em ms,
caso o painel web passe a gravar em outro formato.

## POST /providers/heartbeat

O corpo de todo `200` continua sendo:

```json
{ "ok": true, "open": true }
```

`open` reflete o estado **após** o processamento do heartbeat: se o heartbeat
reabriu a loja, já vem `true`. O PDV pode usá-lo como fonte de estado; se o
corpo vier vazio, assumir aberto.

## Compatibilidade

Enquanto a rota não estiver publicada, o PDV recebe `404` e trata como "sem
informação", seguindo com as outras fontes. Publicar o endpoint depois do PDV
não quebra nada.

## Arquivos

- `src/modules/digital/providers/status.controller.ts` — validação do `id` e resposta HTTP
- `src/modules/digital/providers/status.service.ts` — leitura e normalização do estado
- `src/modules/digital/providers/status.cache.ts` — cache em memória e invalidação
- `src/shared/utils/datetime.ts` — ISO-8601 com offset local
- `src/modules/digital/providers/__tests__/status.test.ts` — testes
