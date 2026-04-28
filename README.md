# Mettre API

API REST para gerenciamento de restaurantes. Integra um banco de dados Firebird local (PDV) com o Firebase Firestore (aplicativo mobile de delivery/smart).

**Versão:** 0.0.2  
**Porta padrão:** 3000

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Linguagem | TypeScript (transpilado com Babel) |
| Banco local | Firebird (via `node-firebird`) |
| Banco cloud | Firebase Firestore / Auth |

---

## Configuração

Edite [src/config.ts](src/config.ts) com as informações do seu ambiente:

```ts
{
  host: '192.168.18.103',        // IP do servidor Firebird
  connectionString: 'C:/Projetos/Mettre/Dados/DADOS.FDB',  // caminho do banco
  port: '3000',                  // porta da API
  venonBot: false,
}
```

---

## Scripts

```bash
pnpm dev          # inicia em desenvolvimento com hot-reload (babel-node)
pnpm build        # compila para dist/ via Babel
pnpm dev:server   # inicia a partir dos arquivos compilados em dist/
pnpm typecheck    # verifica tipos sem compilar
```

---

## Fontes de dados

- **Firebird** — dados operacionais do PDV: produtos, mesas, itens, funcionários, configurações.
- **Firebase** — dados sincronizados com o app mobile: pedidos, providers, bairros, formas de pagamento, produtos do cardápio digital.

---

## Endpoints

### `GET /`
Informações da API.

**Resposta**
```json
{ "title": "Mettre API", "version": "0.0.2" }
```

---

## PDV — Rotas do ponto de venda

Todas as rotas desta seção lêem e gravam diretamente no **banco Firebird local**. São consumidas pelo aplicativo de mesa/comanda (modo offline-first).

### Estoque — `GET /products`

Retorna todos os produtos do estoque (view `v_estoque`).

**Resposta**
```json
[
  {
    "codigo": "001",
    "nome": "X-Burguer",
    "unidade": "UN",
    "preco": 25.90,
    "grupo": "LANCHES",
    "subgrupo": "BURGERS",
    "fracionado": "N",
    "impressao": "COZINHA"
  }
]
```

---

### Grupos — `GET /grupos`

Retorna todos os grupos de produtos (view `V_ANDROID_GRUPOS`). O campo `combinado` indica se o grupo suporta itens meio a meio; `sabores` define o número máximo de sabores.

**Resposta**
```json
[
  {
    "codigo": "01",
    "nome": "PIZZAS",
    "combinado": "S",
    "sabores": 4
  }
]
```

---

### Subgrupos — `GET /subgrupos`

Retorna todos os subgrupos de produtos (view `V_ANDROID_SUBGRUPOS`).

**Resposta**
```json
[{ "nome": "TRADICIONAIS" }, { "nome": "ESPECIAIS" }]
```

---

### Observações — `GET /obs`

Retorna as pré-observações cadastradas para itens de pedido (view `v_obs`). Usadas pelo app como atalhos de obs rápidas ("sem cebola", "bem passado", etc.).

**Resposta**
```json
[
  {
    "codigo": "01",
    "observacao": "SEM CEBOLA",
    "grupo": "LANCHES"
  }
]
```

---

### Funcionários — `GET /func`

Retorna os funcionários cadastrados (view `v_func`). Usado para login/identificação do atendente no app de mesa.

**Resposta**
```json
[
  {
    "codigo": "01",
    "nome": "João Silva",
    "senha": "1234"
  }
]
```

---

### Configurações — `GET /config`

Retorna parâmetros operacionais do sistema a partir da tabela `config` no Firebird (ex: limite de pedaços para itens combinados).

**Resposta**
```json
[{ "V_LIMITE_PEDACOS": 8 }]
```

---

### Mesas e Comandas — `/mesas`

#### `GET /mesas`
Lista todas as mesas/comandas abertas (view `v_mesas`).

**Resposta**
```json
[
  {
    "codigo": "001",
    "comanda": "Mesa 01",
    "subtotal": 45.00,
    "total": 45.00,
    "status": "A",
    "ordem": 1
  }
]
```

#### `PUT /mesas`
Abre uma nova comanda via stored procedure `POCKET_INSERT_MESA`.

**Body**
```json
{
  "mesa": "5",
  "mesaDestino": "5",
  "codAtendente": "01"
}
```

**Resposta** `200`
```json
[{ "oretorno": "001" }]
```

#### `POST /mesas/fechaConta`
Fecha a conta de uma mesa e gera registro de impressão para o caixa. Quando `destino` é `"F"`, o status da mesa também é atualizado para fechado.

**Body**
```json
{
  "codigo": "001",
  "destino": "F"
}
```

**Resposta** `200`
```json
{ "fechouConta": true }
```

---

### Itens de Mesa — `/itens`

#### `GET /itens/:codigo`
Retorna todos os itens de uma mesa pelo código da comanda (view `v_itens`). Itens combinados (ex: pizza meia a meia) são agrupados automaticamente com a lista de sabores no campo `flavors`.

**Parâmetro:** `:codigo` — código da mesa/comanda

**Resposta**
```json
[
  {
    "codigo": "1",
    "comandaCodigo": "001",
    "funcionarioCodigo": "01",
    "produtoCodigo": "042",
    "descricao": "Pizza Meia a Meia",
    "unidade": "UN",
    "quantidade": 1,
    "unitario": 45.00,
    "total": 45.00,
    "hora": "19:30",
    "grupo": "PIZZAS",
    "subgrupo": "TRADICIONAIS",
    "impresso": "S",
    "obs": "",
    "enviado": "S",
    "combinado": true,
    "codCombinado": 1234,
    "flavors": [
      { "descricao": "Mussarela", "quantidade": 0.5, "..." : "..." },
      { "descricao": "Calabresa", "quantidade": 0.5, "..." : "..." }
    ]
  },
  {
    "codigo": "2",
    "descricao": "X-Burguer",
    "combinado": false,
    "flavors": [],
    "..." : "..."
  }
]
```

#### `PUT /itens`
Insere um ou mais itens em uma mesa. Suporta itens simples (`POCKET_INSERT_PRODUTO`) e combinados (`POCKET_INSERT_PRODUTO_COMBINE`). Gera registro de impressão ao final do lote.

**Body** — array de itens:
```json
[
  {
    "mobileId": "uuid-gerado-no-app",
    "codMesa": "001",
    "codProduto": "042",
    "qtde": 1,
    "obs": "SEM CEBOLA",
    "codAtendente": "01",
    "destino": "COZINHA",
    "combinado": false,
    "flavors": []
  },
  {
    "mobileId": "uuid-gerado-no-app",
    "codMesa": "001",
    "combinado": true,
    "flavors": [
      { "codProduto": "010", "qtde": 0.5, "..." : "..." },
      { "codProduto": "015", "qtde": 0.5, "..." : "..." }
    ]
  }
]
```

**Resposta** `200` — sem body, sinaliza sucesso após o registro de impressão.

---

## Canal Digital — Rotas de delivery e cardápio online

Todas as rotas desta seção lêem e gravam no **Firebase Firestore** e utilizam o **Firebase Auth** para autenticação. São consumidas pelo app mobile de delivery e pelo painel de gestão online (MettreSmart).

> **Autenticação:** a maioria das rotas de escrita exige `email` e `password` no body. Se já houver uma sessão ativa no Firebase, o login é dispensado automaticamente.

---

### Estabelecimento — `/providers`

Gerencia o cadastro do restaurante no Firebase.

#### `GET /providers`
Autentica e retorna o UID do provider.

**Body**
```json
{ "email": "email@exemplo.com", "password": "senha" }
```

**Resposta** `200`
```json
{ "id": "firebase-uid" }
```

#### `POST /providers`
Cadastra ou atualiza um provider. Se `id` for `"0"` ou nulo, cria um novo usuário no Firebase Auth; caso contrário, faz login com as credenciais e sobrescreve o documento existente.

**Body**
```json
{
  "id": "0",
  "email": "email@exemplo.com",
  "password": "senha",
  "name": "Restaurante Exemplo",
  "fantasy": "Exemplo",
  "cnpj": "00.000.000/0001-00",
  "phone": "(11) 1234-5678",
  "cellphone": "(11) 91234-5678",
  "logo": "base64...",
  "feeDelivery": 5.00,
  "ray": 10,
  "feeDeliveryMode": "fixed",
  "singleEdge": false
}
```

**Resposta** `200`
```json
{ "id": "firebase-uid" }
```

#### `PUT /providers`
Atualiza o status de abertura do estabelecimento (aberto/fechado para receber pedidos).

**Body**
```json
{
  "id": "firebase-uid",
  "email": "email@exemplo.com",
  "password": "senha",
  "open": true
}
```

**Resposta** `200`
```json
{ "id": "firebase-uid" }
```

---

### Cardápio Digital — `/products` (escrita) e `/productManager` (leitura)

O cardápio online é gerenciado separadamente do estoque PDV. O `GET /products` retorna dados do Firebird (estoque físico); as operações de escrita abaixo sincronizam o cardápio no Firebase.

#### `POST /products`
Publica ou atualiza um produto no cardápio digital. Suporta configuração de disponibilidade por dia da semana e horário.

**Body**
```json
{
  "id": "",
  "idProvider": "firebase-uid",
  "email": "email@exemplo.com",
  "password": "senha",
  "code": "001",
  "description": "X-Burguer",
  "unity": "UN",
  "group": "LANCHES",
  "subgroup": "BURGERS",
  "price": 25.90,
  "active": true,
  "fractioned": false,
  "fractions": 1,
  "edge": false,
  "additional": false,
  "portionSize": "",
  "web_img_64": "",
  "web_borda_subgrupo": "",
  "monday": true, "monday_start": "08:00", "monday_stop": "22:00",
  "tuesday": true, "tuesday_start": "08:00", "tuesday_stop": "22:00",
  "wednesday": true, "wednesday_start": "08:00", "wednesday_stop": "22:00",
  "thursday": true, "thursday_start": "08:00", "thursday_stop": "22:00",
  "friday": true, "friday_start": "08:00", "friday_stop": "22:00",
  "saturday": true, "saturday_start": "08:00", "saturday_stop": "22:00",
  "sunday": false, "sunday_start": "", "sunday_stop": ""
}
```

**Resposta** `201`
```json
{ "id": "doc-id-gerado" }
```

#### `POST /products/delete`
Remove um produto do cardápio digital.

**Body**
```json
{
  "id": "doc-id-produto",
  "email": "email@exemplo.com",
  "password": "senha"
}
```

**Resposta** `201`
```json
{ "resp": "ok" }
```

#### `POST /products/clearProducts`
Remove todo o cardápio de um provider (útil antes de uma re-sincronização completa com o estoque PDV).

**Body**
```json
{
  "idProvider": "firebase-uid",
  "email": "email@exemplo.com",
  "password": "senha"
}
```

**Resposta** `201`
```json
{ "resp": "ok" }
```

#### `GET /productManager`
Consulta o cardápio digital de um provider ordenado por descrição. Retorna apenas os campos relevantes para o app (sem imagem base64).

**Body**
```json
{ "idProvider": "firebase-uid" }
```

**Resposta** `200`
```json
[
  {
    "id": "doc-id",
    "idProvider": "firebase-uid",
    "code": "001",
    "description": "X-Burguer",
    "unity": "UN",
    "group": "LANCHES",
    "subgroup": "BURGERS",
    "price": 25.90,
    "active": true,
    "fractioned": false,
    "fractions": 1,
    "edge": false,
    "additional": false,
    "portionSize": ""
  }
]
```

---

### Bairros de Entrega — `/neighborhood`

#### `POST /neighborhood`
Cadastra ou atualiza um bairro/área de entrega com sua respectiva taxa.

**Body**
```json
{
  "id": "",
  "idProvider": "firebase-uid",
  "email": "email@exemplo.com",
  "password": "senha",
  "code": "01",
  "name": "Centro",
  "feeDelivery": 3.00,
  "city": "São Paulo",
  "uf": "SP",
  "ibge": "3550308",
  "active": true
}
```

**Resposta** `201`
```json
{ "id": "doc-id" }
```

---

### Formas de Pagamento — `/payment`

#### `POST /payment`
Cadastra uma nova forma de pagamento aceita pelo estabelecimento.

**Body**
```json
{
  "idProvider": "firebase-uid",
  "email": "email@exemplo.com",
  "password": "senha",
  "code": "01",
  "formPayment": "Dinheiro",
  "change": true
}
```

**Resposta** `201`
```json
{ "id": "doc-id" }
```

#### `PUT /payment`
Sincronização completa: remove todas as formas de pagamento do provider e as recria. Usar quando o cadastro do PDV foi alterado e precisa ser re-publicado no app.

**Body**
```json
{
  "idProvider": "firebase-uid",
  "email": "email@exemplo.com",
  "password": "senha"
}
```

**Resposta** `200`
```json
{ "status": "ok" }
```

---

### Pedidos de Delivery — `/request`

Gerencia o ciclo de vida dos pedidos recebidos do app mobile. A **gravação automática** dos pedidos no Firebird é feita pelo serviço de sincronização (ver seção abaixo); estas rotas cuidam do status e comprovantes.

#### `POST /request`
Associa um comprovante de pagamento (boleto, PIX, etc.) a um pedido existente.

**Body**
```json
{
  "id": "doc-id-do-pedido",
  "file": "base64-ou-url-do-comprovante"
}
```

**Resposta** `200` — retorna o body recebido.

#### `PUT /request`
Atualiza o status de um pedido (ex: `"CONFIRMADO"`, `"EM_ROTA"`, `"CANCELADO"`).

**Body**
```json
{
  "id": "doc-id-do-pedido",
  "status": "CONFIRMADO",
  "reason": ""
}
```

**Resposta** `200` — retorna o body recebido.

---

## Serviço de sincronização automática

A API roda um intervalo de **15 segundos** que busca novos pedidos e clientes no Firebase e os grava automaticamente no Firebird:

- `requestService.getNewRequests(idProvider)` — salva pedidos não lidos no Firebird via stored procedures `WEB_ENTREGA`, `WEB_ITEMS` e `WEB_ITEMS_COMBINED`, depois marca o pedido como `read: true` no Firebase.

O ID do provider é obtido do Firebird na inicialização (`SELECT web_key FROM config`) e reutilizado nos ciclos de sincronização.

---

## Estrutura do projeto

O projeto é organizado por módulos separados em dois domínios — **PDV** e **Digital** — com infraestrutura compartilhada em `shared/`.

```
src/
├── app.ts                          # configuração Express, registro de rotas
├── config.ts                       # variáveis de configuração (host, porta, etc.)
├── bin/
│   └── server.ts                   # ponto de entrada, HTTP server, sync loop
│
├── modules/
│   │
│   ├── pdv/                        # domínio do ponto de venda (Firebird)
│   │   ├── config/
│   │   │   ├── config.controller.ts
│   │   │   └── config.routes.ts
│   │   ├── func/
│   │   │   ├── func.controller.ts
│   │   │   └── func.routes.ts
│   │   ├── grupos/
│   │   │   ├── grupos.controller.ts
│   │   │   └── grupos.routes.ts
│   │   ├── subgrupos/
│   │   │   ├── subgrupos.controller.ts
│   │   │   └── subgrupos.routes.ts
│   │   ├── obs/
│   │   │   ├── obs.controller.ts
│   │   │   └── obs.routes.ts
│   │   ├── mesas/
│   │   │   ├── mesas.controller.ts
│   │   │   └── mesas.routes.ts
│   │   └── itens/
│   │       ├── itens.controller.ts
│   │       └── itens.routes.ts
│   │
│   └── digital/                    # domínio do canal digital (Firebase)
│       ├── cardapio/
│       │   ├── cardapio.controller.ts   # GET estoque (Firebird) + escrita Firebase
│       │   ├── cardapio.routes.ts       # rotas de /products
│       │   ├── productManager.routes.ts # rotas de /productManager
│       │   └── cardapio.service.ts      # leitura de produtos do Firebird
│       ├── providers/
│       │   ├── providers.controller.ts
│       │   ├── providers.routes.ts
│       │   └── providers.service.ts    # getProviderId (lê web_key no Firebird)
│       ├── neighborhood/
│       │   ├── neighborhood.controller.ts
│       │   └── neighborhood.routes.ts
│       ├── payment/
│       │   ├── payment.controller.ts
│       │   └── payment.routes.ts
│       ├── requests/
│       │   ├── requests.controller.ts
│       │   ├── requests.routes.ts
│       │   └── requests.service.ts     # sync Firebase → Firebird (loop 15s)
│       └── customers/
│           └── customers.service.ts    # sync de clientes Firebase → Firebird
│
├── shared/                         # infraestrutura compartilhada entre módulos
│   ├── database/
│   │   ├── firebird.ts             # opções de conexão Firebird (centralizado)
│   │   └── connection.ts           # conexão Knex/SQLite (migrations)
│   ├── firebase/
│   │   └── firebase.config.ts      # inicialização do Firebase
│   └── utils/
│       ├── removeEmoji.ts          # sanitização de strings para o Firebird
│       └── convert.ts              # utilitário Base64
│
├── models/
│   └── ItemModel.ts                # interface TypeScript de item de pedido
└── types/
    └── node-firebird.d.ts          # declarações de tipos para node-firebird
```
