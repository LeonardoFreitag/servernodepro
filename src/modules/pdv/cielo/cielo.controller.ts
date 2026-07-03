import { Request, Response } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

function getNextId(): Promise<number> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);
      db.query(
        'SELECT GEN_ID(G_CIELO_PAGAMENTOS, 1) AS ID FROM RDB$DATABASE',
        (err, result) => {
          if (err) { db.detach(); return reject(err); }
          resolve(result[0].ID);
          db.detach();
        }
      );
    });
  });
}

function insertPagamento(params: {
  id: number;
  codMesa: number;
  cieloOrderId: string;
  meioPagamento: string;
  bandeira: string;
  valorTotal: number;
  valorPago: number;
  parcelas: number;
  authCode: string;
  cieloCode: string;
  nsu: string;
  terminal: string;
  codEc: string;
  maskCartao: string;
  produtoPrimario: string;
  produtoSecundario: string;
  statusCode: string;
  payloadJson: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);
      db.query(
        `INSERT INTO CIELO_PAGAMENTOS (
          ID, COD_MESA, CIELO_ORDER_ID, MEIO_PAGAMENTO, BANDEIRA,
          VALOR_TOTAL, VALOR_PAGO, PARCELAS,
          AUTH_CODE, CIELO_CODE, NSU, TERMINAL, COD_EC, MASK_CARTAO,
          PRODUTO_PRIMARIO, PROD_SECUNDARIO, STATUS_CODE, PAYLOAD_JSON
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )`,
        [
          params.id,
          params.codMesa,
          params.cieloOrderId,
          params.meioPagamento,
          params.bandeira,
          params.valorTotal,
          params.valorPago,
          params.parcelas,
          params.authCode,
          params.cieloCode,
          params.nsu,
          params.terminal,
          params.codEc,
          params.maskCartao,
          params.produtoPrimario,
          params.produtoSecundario,
          params.statusCode,
          params.payloadJson,
        ],
        (err) => {
          if (err) { db.detach(); return reject(err); }
          resolve();
          db.detach();
        }
      );
    });
  });
}

/**
 * POST /cielo/pagamento
 *
 * Body esperado:
 * {
 *   codMesa:      number,   -- código da mesa/comanda (MESAS_ABERTAS.CODIGO)
 *   paymentCode:  string,   -- ex: "CREDITO_AVISTA"
 *   cieloResponse: object   -- JSON completo retornado pela Cielo Smart
 * }
 */
export async function registrarPagamento(req: Request, res: Response): Promise<void> {
  const { codMesa, paymentCode, cieloResponse } = req.body;

  if (!codMesa || !paymentCode || !cieloResponse) {
    res.status(400).send({ error: 'codMesa, paymentCode e cieloResponse são obrigatórios.' });
    return;
  }

  // Extrai campos do primeiro pagamento (a Cielo retorna array de payments)
  const payment = cieloResponse.payments?.[0] ?? {};
  const fields  = payment.paymentFields ?? {};

  try {
    const id = await getNextId();

    await insertPagamento({
      id,
      codMesa:          Number(codMesa),
      cieloOrderId:     cieloResponse.id          ?? '',
      meioPagamento:    paymentCode,
      bandeira:         payment.brand             ?? '',
      valorTotal:       (cieloResponse.price      ?? 0) / 100,
      valorPago:        (payment.amount ?? cieloResponse.paidAmount ?? 0) / 100,
      parcelas:         Number(payment.installments ?? 0),
      authCode:         payment.authCode          ?? '',
      cieloCode:        payment.cieloCode         ?? '',
      nsu:              fields.paymentTransactionId ?? payment.externalId ?? '',
      terminal:         payment.terminal          ?? '',
      codEc:            payment.merchantCode      ?? '',
      maskCartao:       payment.mask              ?? fields.pan ?? '',
      produtoPrimario:  fields.primaryProductName ?? '',
      produtoSecundario: fields.secondaryProductName ?? '',
      statusCode:       fields.statusCode         ?? '1',
      payloadJson:      JSON.stringify(cieloResponse),
    });

    res.status(201).send({ id, codMesa });
  } catch (error) {
    console.error('[cielo] Erro ao registrar pagamento:', error);
    res.status(500).send({ error: 'Erro ao salvar pagamento no banco de dados.' });
  }
}
