import { Request, Response } from 'express';
import * as service from './cobrancas.service';
import { CobrancaError } from './cobrancas.service';
import { CobrancaDTO } from './cobrancas.dto';
import { isProvider, isTransactionType } from '../pagamentos/pagamentos.mapping';
import { logPagamento, resumoErro } from '../../../shared/utils/pagamentosLog';

function handleError(res: Response, tag: string, err: unknown): void {
  if (err instanceof CobrancaError) {
    res.status(err.httpStatus).send({ error: err.message, ...err.extra });
    return;
  }
  console.error(`[cobrancas] ${tag}:`, err);
  res.status(500).send({ error: 'Erro ao acessar o banco de dados.' });
}

const idParam = (req: Request): string => String(req.params.id ?? '').trim().slice(0, 36);

/**
 * Cards que cada entregador já recebeu. O ERP grava a cobrança direto no banco,
 * então a primeira vez que a API a enxerga é quando o app do entregador a busca.
 * O app consulta em loop: só loga o card que aparece pela primeira vez.
 * Em memória — depois de reiniciar a API, os cards abertos são logados de novo.
 */
const cardsVistos = new Map<number, Set<string>>();

export function logarCardsRecebidos(entregador: number, lista: CobrancaDTO[]): void {
  const vistos = cardsVistos.get(entregador) ?? new Set<string>();
  for (const c of lista) {
    if (vistos.has(c.id)) continue;
    console.log(
      `[cobrancas] ${new Date().toISOString()} card-recebido: entregador=${entregador} id=${c.id} ` +
      `origem=${c.origem} codVenda=${c.codVenda} valorCents=${c.valorCents} status=${c.status}`,
    );
  }
  // Guarda só os abertos: o conjunto não cresce e um card encerrado sai dele.
  cardsVistos.set(entregador, new Set(lista.map((c) => c.id)));
}

/** GET /cobrancas/pendentes?terminalId=X */
export async function pendentes(req: Request, res: Response): Promise<void> {
  const terminalId = String(req.query.terminalId ?? '').trim();
  if (!terminalId) {
    res.status(400).send({ error: 'terminalId é obrigatório.' });
    return;
  }
  try {
    res.status(200).send(await service.listarPendentes(terminalId));
  } catch (err) {
    handleError(res, 'pendentes', err);
  }
}

/** GET /cobrancas/cards?entregador=N | ?mesas=1 */
export async function cards(req: Request, res: Response): Promise<void> {
  const entregadorRaw = req.query.entregador;
  const mesas = ['1', 'true', 'S'].includes(String(req.query.mesas ?? ''));
  const entregador = entregadorRaw != null && String(entregadorRaw) !== '' ? Number(entregadorRaw) : undefined;
  if (entregador !== undefined && !Number.isInteger(entregador)) {
    res.status(400).send({ error: 'entregador inválido.' });
    return;
  }
  if (entregador === undefined && !mesas) {
    res.status(400).send({ error: 'Informe entregador=N ou mesas=1.' });
    return;
  }
  try {
    const lista = await service.listarCards({ entregador, mesas });
    if (entregador !== undefined) logarCardsRecebidos(entregador, lista);
    res.status(200).send(lista);
  } catch (err) {
    handleError(res, 'cards', err);
  }
}

/** GET /cobrancas/:id */
export async function obter(req: Request, res: Response): Promise<void> {
  try {
    const dto = await service.obter(idParam(req));
    if (!dto) {
      res.status(404).send({ error: 'Cobranca nao encontrada' });
      return;
    }
    res.status(200).send(dto);
  } catch (err) {
    handleError(res, 'obter', err);
  }
}

/** POST /cobrancas/:id/claim { terminalId, codEntregador? } */
export async function claim(req: Request, res: Response): Promise<void> {
  const terminalId = String(req.body?.terminalId ?? '').trim();
  if (!terminalId) {
    res.status(400).send({ error: 'terminalId é obrigatório.' });
    return;
  }

  // Opcional: quando vem, a API confere que o card é mesmo deste entregador.
  // Ausente = comportamento antigo (app instalado continua funcionando).
  const bruto = req.body?.codEntregador;
  let codEntregador: number | null = null;
  if (bruto != null && String(bruto).trim() !== '') {
    const n = Number(bruto);
    if (!Number.isInteger(n) || n <= 0) {
      res.status(422).send({ error: 'codEntregador deve ser inteiro > 0.' });
      return;
    }
    codEntregador = n;
  }

  try {
    res.status(200).send(await service.claim(idParam(req), terminalId, codEntregador));
  } catch (err) {
    handleError(res, 'claim', err);
  }
}

/** PATCH /cobrancas/:id { terminalId, provider, status, motivoErro?, pagamento? } */
export async function desfecho(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const terminalId = String(body.terminalId ?? '').trim();
  if (!terminalId) { res.status(400).send({ error: 'terminalId é obrigatório.' }); return; }
  if (!isProvider(body.provider)) { res.status(422).send({ error: 'provider é obrigatório: CIELO | STONE.' }); return; }
  const status = String(body.status ?? '');
  if (!['approved', 'declined', 'canceled', 'error'].includes(status)) {
    res.status(422).send({ error: 'status deve ser approved | declined | canceled | error.' });
    return;
  }

  let pagamento: service.DesfechoInput['pagamento'] = null;
  if (body.pagamento) {
    const p = body.pagamento;
    if (!isTransactionType(p.transactionType)) {
      res.status(422).send({ error: 'pagamento.transactionType inválido.' });
      return;
    }
    const amountCents = Number(p.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      res.status(422).send({ error: 'pagamento.amountCents deve ser inteiro em centavos > 0.' });
      return;
    }
    pagamento = {
      transactionType: p.transactionType,
      installments: Number(p.installments ?? 1) || 1,
      amountCents,
      providerData: p.providerData && typeof p.providerData === 'object' ? p.providerData : null,
      rawResponse: p.rawResponse ?? null,
    };
  }

  const id = idParam(req);
  try {
    const dto = await service.registrarDesfecho(id, {
      terminalId,
      provider: body.provider,
      status: status as service.DesfechoInput['status'],
      motivoErro: body.motivoErro ?? null,
      pagamento,
    });
    logPagamento('desfecho_ok', {
      cobrancaId: id, terminalId, provider: body.provider, status, resultado: dto.status,
      pagamentoId: dto.pagamentoId, amountCents: pagamento?.amountCents ?? null,
      reference: pagamento?.providerData?.reference ?? null,
    });
    res.status(200).send(dto);
  } catch (err) {
    const httpStatus = err instanceof CobrancaError ? err.httpStatus : 500;
    logPagamento('desfecho_erro', { cobrancaId: id, terminalId, provider: body.provider, status, httpStatus, ...resumoErro(err), body });
    handleError(res, 'desfecho', err);
  }
}

/** POST /cobrancas/:id/cancelar */
export async function cancelar(req: Request, res: Response): Promise<void> {
  try {
    const { httpStatus, cobranca } = await service.cancelar(idParam(req));
    res.status(httpStatus).send(cobranca);
  } catch (err) {
    handleError(res, 'cancelar', err);
  }
}
