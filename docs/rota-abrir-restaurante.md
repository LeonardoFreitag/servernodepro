# Rota POST /abrir-restaurante

## Visão geral

Ativa o restaurante para o app de pedido online. Ao ser chamada, a rota lê as configurações de identificação do restaurante direto do banco Firebird e grava um documento no Firestore que serve como estado ativo para outros processos do sistema.

---

## Localização no projeto

| Caminho | Responsabilidade |
|---|---|
| `src/modules/digital/restaurante/restaurante.routes.ts` | Definição da rota |
| `src/modules/digital/restaurante/restaurante.controller.ts` | Lógica de negócio |
| `src/shared/firebase/firebase-admin.config.ts` | Inicialização do firebase-admin e Firestore |
| `src/shared/database/firebird.ts` | Configuração de conexão com o Firebird |
| `src/app.ts` | Registro da rota (`app.use('/abrir-restaurante', ...)`) |

---

## Dependências

- `firebase-admin` — instalado via `pnpm add firebase-admin`
- `serviceAccountKey.json` — arquivo de credenciais do Google, deve ser colocado na **raiz do projeto** (`/serviceAccountKey.json`). Não é versionado no git.

---

## Endpoint

```
POST /abrir-restaurante
```

Não exige autenticação. Não espera body.

---

## Fluxo de execução

```
POST /abrir-restaurante
        │
        ▼
Abre conexão com Firebird (node-firebird)
        │
        ▼
SELECT web_key, web_url_whats FROM config ROWS 1
        │
        ▼
Grava no Firestore
  coleção: "restaurante"
  documento: "ativo"
        │
        ▼
Retorna { sucesso: true, restaurante: "ServerNode" }
```

---

## Documento gravado no Firestore

**Coleção:** `restaurante`  
**Documento:** `ativo`

```json
{
  "restaurante": "ServerNode",
  "idProvider": "<valor de web_key>",
  "link": "<valor de web_url_whats>",
  "atualizadoEm": "<Timestamp do servidor Firestore>"
}
```

| Campo | Origem |
|---|---|
| `restaurante` | Fixo: `"ServerNode"` |
| `idProvider` | Campo `web_key` da tabela `config` no Firebird |
| `link` | Campo `web_url_whats` da tabela `config` no Firebird |
| `atualizadoEm` | `admin.firestore.FieldValue.serverTimestamp()` |

---

## Respostas HTTP

**Sucesso — 200**
```json
{ "sucesso": true, "restaurante": "ServerNode" }
```

**Erro — 500**
```json
{ "sucesso": false, "erro": "<mensagem do erro>" }
```

Cenários que retornam 500:
- Falha ao conectar no Firebird
- Erro na execução da query
- Nenhum registro encontrado na tabela `config`
- Falha ao gravar no Firestore

---

## Observações

- O campo retornado pelo `node-firebird` pode vir em maiúsculas (`WEB_KEY`) dependendo da opção `lowercase_keys` da conexão. O controller trata ambos os casos.
- O `firebase-admin` é inicializado com `if (!admin.apps.length)` para evitar reinicialização em reloads de desenvolvimento.
- O arquivo `serviceAccountKey.json` deve ser obtido no Console do Firebase: **Configurações do projeto → Contas de serviço → Gerar nova chave privada**.
