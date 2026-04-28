# Documentação — Integração Delphi com API de Entregas

---

## 1. Estrutura de dados no Firestore

O sistema Delphi é responsável por manter dois cadastros no Firebase Firestore antes de enviar qualquer notificação.

### 1.1 Cadastro do Restaurante

Coleção: `restaurantes/{idProvider}`

| Campo | Tipo | Exemplo |
|---|---|---|
| `nome` | string | `"Pizzaria Central"` |
| `ativo` | boolean | `true` |

> `idProvider` é o identificador único do restaurante — o mesmo valor já usado na coleção `providers` da API.

---

### 1.2 Cadastro de Entregadores

Coleção: `restaurantes/{idProvider}/entregadores/{entregador_code}`

| Campo | Tipo | Exemplo |
|---|---|---|
| `nome` | string | `"João Silva"` |
| `fone` | string | `"5565992285056"` |
| `ativo` | boolean | `true` |

> O `entregador_code` é o código interno do entregador no sistema Delphi (ex: `"100"`). **Não precisa ser único globalmente** — só dentro do restaurante.

---

### 1.3 Cadastro de Pedidos (para entrega)

Coleção: `restaurantes/{idProvider}/pedidos/{pedidoId}`

| Campo | Tipo | Valores possíveis |
|---|---|---|
| `numero` | string | `"0042"` |
| `entregador_code` | string | `"100"` |
| `cliente_nome` | string | `"Maria Souza"` |
| `cliente_fone` | string | `"5565991112222"` |
| `endereco` | string | `"Rua das Flores, 123"` |
| `bairro` | string | `"Centro"` |
| `distancia_km` | number | `3.5` |
| `status` | string | `"pendente"` / `"em_rota"` / `"entregue"` |
| `hora_saida` | string | `"19:30"` |
| `criado_em` | Timestamp | gerado pelo Firestore |
| `atualizado_em` | Timestamp | gerado pelo Firestore |

> O `pedidoId` pode ser gerado pelo Delphi (UUID) ou pelo Firestore. O Delphi precisa gravar este ID para rastrear o pedido depois.

---

## 2. Chamadas HTTP — O que o Delphi faz

O Delphi tem **uma única chamada HTTP** a fazer: enviar o link WhatsApp ao entregador quando um pedido é despachado.

```
POST http://<ip-servidor>:3000/entregas/enviar-link
```

As demais chamadas (`GET /entregas` e `PATCH /pedidos/:id/status`) são feitas pelo **app React** do entregador — o Delphi não precisa se preocupar com elas.

---

## 3. Implementação em Delphi com componentes TRest

### Componentes necessários no Form/DataModule

```
TRESTClient       → RESTClient1
TRESTRequest      → RESTRequest1
TRESTResponse     → RESTResponse1
```

### 3.1 Configuração dos componentes (Object Inspector)

**RESTClient1:**
```
BaseURL = http://192.168.18.103:3000
```

**RESTRequest1:**
```
Client   = RESTClient1
Response = RESTResponse1
Method   = rmPOST
Resource = entregas/enviar-link
```

**RESTResponse1:**
```
(sem configuração adicional)
```

---

### 3.2 Código Pascal — Enviar link ao entregador

```pascal
procedure TFormPedidos.EnviarLinkEntregador(
  const AIdProvider: string;
  const ACode: string;
  const ANome: string;
  const AFone: string);
var
  Body: TJSONObject;
  Sucesso: Boolean;
  Link: string;
begin
  Body := TJSONObject.Create;
  try
    Body.AddPair('idProvider',       AIdProvider);
    Body.AddPair('entregador_code',  ACode);
    Body.AddPair('entregador_name',  ANome);
    Body.AddPair('entregador_fone',  AFone);

    RESTRequest1.ClearBody;
    RESTRequest1.AddBody(Body.ToString, TRESTContentType.ctAPPLICATION_JSON);

    RESTRequest1.Execute;

    if RESTResponse1.StatusCode = 200 then
    begin
      Sucesso := RESTResponse1.JSONValue.GetValue<Boolean>('sucesso');
      Link    := RESTResponse1.JSONValue.GetValue<string>('link');

      if Sucesso then
        ShowMessage('Link enviado com sucesso!' + sLineBreak + Link)
      else
        ShowMessage('Falha ao enviar link.');
    end
    else
    begin
      ShowMessage('Erro HTTP ' + IntToStr(RESTResponse1.StatusCode) + ': ' +
        RESTResponse1.JSONValue.GetValue<string>('erro'));
    end;

  finally
    Body.Free;
  end;
end;
```

**Exemplo de chamada:**
```pascal
EnviarLinkEntregador(
  'abc123',          // idProvider do restaurante
  '100',             // código do entregador no Delphi
  'João Silva',      // nome completo
  '5565992285056'    // fone sem + e sem espaços
);
```

---

### 3.3 Resposta esperada da API

**Sucesso (HTTP 200):**
```json
{
  "sucesso": true,
  "link": "http://localhost:3001/entregas?token=eyJhbGciOiJIUzI1NiJ9..."
}
```

**Erro (HTTP 500):**
```json
{
  "sucesso": false,
  "erro": "mensagem do erro"
}
```

---

## 4. Fluxo completo

```
Delphi                          API Node.js                    Entregador
  │                                  │                              │
  │── POST /entregas/enviar-link ───►│                              │
  │   { idProvider, code, nome,      │                              │
  │     fone }                       │                              │
  │                                  │── gera JWT (8h) ────────────│
  │                                  │── envia WhatsApp ──────────►│
  │◄── { sucesso: true, link } ──────│                              │
  │                                  │         │                    │
  │                                  │         │◄── abre link ──────│
  │                                  │◄── GET /entregas?token=... ──│
  │                                  │── retorna pedidos ──────────►│
  │                                  │                              │
  │                                  │◄── PATCH /pedidos/:id/status─│
  │                                  │    { status: "em_rota" }     │
```

---

## 5. Observações importantes

| Ponto | Detalhe |
|---|---|
| **Fone sem formatação** | Passar `entregador_fone` somente com dígitos, incluindo o DDI: `5565992285056` |
| **Sandbox Twilio** | Em ambiente de teste, o entregador deve primeiro enviar uma mensagem para o número do sandbox para fazer opt-in |
| **Token expira em 8h** | Se o entregador abrir o link depois de 8h, receberá erro 401 — o Delphi deve reenviar o link |
| **Pedidos no Firestore** | O Delphi precisa gravar os pedidos na subcoleção `restaurantes/{idProvider}/pedidos` **antes** de chamar `/enviar-link` |
