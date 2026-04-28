# Arquitetura do Sistema de Entregas

## Visão geral dos componentes

O sistema é composto por quatro peças que se comunicam de formas distintas:

```
┌─────────────────┐        HTTP POST         ┌─────────────────────┐
│                 │ ──────────────────────── ►│                     │
│  Delphi (PDV)   │                           │   API Node.js       │
│  (restaurante)  │◄────────────────────────  │   porta 3000        │
│                 │    { sucesso, link }       │                     │
└─────────────────┘                           └──────────┬──────────┘
                                                         │
                                              grava JWT  │  lê/grava
                                              no link    │  Firestore
                                                         ▼
                                              ┌─────────────────────┐
                                              │                     │
                    ┌────────────────────────►│  Firebase Firestore  │
                    │   lê/grava direto       │  (Google Cloud)     │
                    │                         │                     │
                    │                         └─────────────────────┘
         ┌──────────┴──────────┐
         │                     │
         │   App React         │
         │   (entregador)      │
         │                     │
         └─────────────────────┘
```

> O Delphi e o React **nunca se comunicam diretamente entre si**.
> O React **nunca chama a API Node.js**.
> O Delphi **nunca chama o Firestore diretamente**.

---

## O processo passo a passo

### Fase 1 — Cadastro prévio (Delphi → Firestore via API)

Antes de qualquer entrega acontecer, o sistema Delphi deve ter gravado
no Firestore as seguintes informações via API Node.js:

- O documento do restaurante em `restaurantes/{idProvider}`
- O pedido que será entregue em `restaurantes/{idProvider}/pedidos/{pedidoId}`
  com `status: "pendente"` e o `entregador_code` do responsável pela entrega

---

### Fase 2 — Despacho da entrega (Delphi → API → Twilio → Entregador)

Quando o operador do restaurante no Delphi despacha um pedido para entrega:

**Passo 1** — Delphi faz uma chamada HTTP para a API:
```
POST http://192.168.18.103:3000/entregas/enviar-link
Content-Type: application/json

{
  "idProvider":       "abc123",
  "entregador_code":  "100",
  "entregador_name":  "João Silva",
  "entregador_fone":  "5565992285056"
}
```

**Passo 2** — A API Node.js gera um token JWT assinado com validade de 8 horas:
```
payload: { idProvider, entregador_code, entregador_name }
assinado com: config.jwtSecret
expira em: 8 horas
```

**Passo 3** — A API monta o link do app React com o token embutido:
```
http://<FRONTEND_URL>/entregas?token=eyJhbGciOiJIUzI1NiJ9...
```

**Passo 4** — A API chama o serviço Twilio que envia o link por WhatsApp
para o celular do entregador:
```
De:   whatsapp:+14155238886  (número Twilio)
Para: whatsapp:+5565992285056
Msg:  "Olá! Acesse seus pedidos de entrega pelo link: http://..."
```

**Passo 5** — A API retorna confirmação para o Delphi:
```json
{ "sucesso": true, "link": "http://..." }
```

---

### Fase 3 — Entregador acessa o app (React → Firestore)

**Passo 6** — O entregador toca no link recebido pelo WhatsApp.
O navegador abre o app React na URL:
```
http://<FRONTEND_URL>/entregas?token=eyJhbGciOiJIUzI1NiJ9...
```

**Passo 7** — O app React lê o token da URL e decodifica o payload
(sem precisar verificar a assinatura — isso é feito pela biblioteca
`jwt-decode`). Extrai:
```
idProvider:       "abc123"
entregador_code:  "100"
entregador_name:  "João Silva"
exp:              <timestamp de expiração em 8h>
```

Se o token estiver expirado, exibe mensagem de sessão encerrada.

**Passo 8** — O app React abre uma escuta em tempo real (`onSnapshot`)
diretamente no Firestore:
```
coleção:  restaurantes/abc123/pedidos
filtros:  entregador_code == "100"
          status != "entregue"
ordem:    criado_em ASC
```

O Firestore retorna imediatamente os pedidos ativos e continua
notificando o app em tempo real sempre que houver alteração.

**Passo 9** — O app exibe os cartões de pedido na tela do entregador
com nome do cliente, endereço, bairro, distância e hora de saída.

---

### Fase 4 — Entregador atualiza o status (React → Firestore)

**Passo 10** — Quando o entregador toca em "Saí para entrega":

O app React grava diretamente no Firestore:
```
documento: restaurantes/abc123/pedidos/{pedidoId}
atualiza:  status = "em_rota"
           atualizado_em = serverTimestamp()
```

O badge do pedido muda de amarelo (pendente) para azul (em_rota)
**instantaneamente** para o entregador, pois o `onSnapshot` detecta
a própria alteração.

**Passo 11** — Quando o entregador toca em "Confirmar entrega":

O app React grava no Firestore:
```
documento: restaurantes/abc123/pedidos/{pedidoId}
atualiza:  status = "entregue"
           atualizado_em = serverTimestamp()
```

O `onSnapshot` detecta que o pedido agora tem `status == "entregue"`,
que está fora do filtro da consulta, e **remove o cartão da lista
automaticamente** — sem nenhuma ação adicional do app.

---

## Resumo das responsabilidades

| Componente | O que faz | Com quem fala |
|---|---|---|
| **Delphi** | Cadastra pedidos, despacha entregas, chama o envio do link | API Node.js |
| **API Node.js** | Gera o JWT, envia o WhatsApp via Twilio | Twilio, Firestore |
| **Firebase Firestore** | Armazena restaurantes, pedidos e entregadores | API Node.js, React |
| **App React** | Exibe pedidos ao entregador, atualiza status | Firestore direto |
| **Twilio** | Entrega a mensagem WhatsApp ao celular do entregador | — |

---

## Por que o React não passa pela API?

O Firebase Firestore permite que aplicações web se conectem diretamente
à base de dados usando o SDK JavaScript, sem precisar de um servidor
intermediário. Isso traz duas vantagens práticas neste sistema:

1. **Tempo real nativo** — O `onSnapshot` do Firestore notifica o app
   React no instante em que qualquer dado muda. Se o Delphi adicionar
   um novo pedido para o entregador, o cartão aparece na tela dele
   sem que ele precise recarregar a página.

2. **Menos infraestrutura** — A API Node.js só precisa existir para
   operações que o Delphi (desktop) precisa fazer via HTTP. O fluxo
   de leitura do entregador vai direto à fonte.

---

## Ciclo de vida do token JWT

```
Delphi chama /enviar-link
       │
       ▼
API gera JWT  ──────────────────────────────────────────► expira em 8h
       │                                                        │
       ▼                                                        │
Link enviado ao entregador por WhatsApp                         │
       │                                                        │
       ▼                                                        │
Entregador abre o link (token válido) ──► acessa pedidos       │
       │                                                        │
       │                              se abrir após 8h ────────┘
       │                              token expirado
       │                              app exibe: "Sessão encerrada.
       │                              Solicite um novo link."
       ▼
Delphi deve chamar /enviar-link novamente para novo turno
```
