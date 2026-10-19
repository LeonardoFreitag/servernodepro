import * as service from '../pagamentos.service';
import * as controller from '../pagamentos.controller';
import { logPagamento } from '../../../../shared/utils/pagamentosLog';

jest.mock('../pagamentos.service', () => {
  const actual = jest.requireActual('../pagamentos.service');
  return { ...actual, registrarPagamento: jest.fn(), listarPagamentos: jest.fn(), estornarManual: jest.fn() };
});
jest.mock('../../../../shared/utils/pagamentosLog', () => ({
  logPagamento: jest.fn(),
  resumoErro: (err: any) => ({ mensagem: err?.message ?? String(err) }),
}));

const svc = service as jest.Mocked<typeof service>;
const log = logPagamento as jest.Mock;

function res() {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.send = jest.fn().mockReturnValue(r);
  return r;
}
const body = { provider: 'CIELO', origem: 'M', codVenda: 7, transactionType: 'CREDIT', amountCents: 5000, rawResponse: { id: 'ORDER-1' } };

beforeEach(() => jest.clearAllMocks());

describe('POST /pagamentos', () => {
  it('201 duplicado:false na primeira vez', async () => {
    svc.registrarPagamento.mockResolvedValue({ id: 10, duplicado: false });
    const r = res();
    await controller.registrar({ body } as any, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.send).toHaveBeenCalledWith({ id: 10, codVenda: 7, duplicado: false });
    expect(log).toHaveBeenCalledWith('ok', expect.objectContaining({ id: 10, orderId: 'ORDER-1', codVenda: 7 }));
  });
  it('200 duplicado:true na repetição (mesmo id)', async () => {
    svc.registrarPagamento.mockResolvedValue({ id: 10, duplicado: true });
    const r = res();
    await controller.registrar({ body } as any, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.send).toHaveBeenCalledWith({ id: 10, codVenda: 7, duplicado: true });
    expect(log).toHaveBeenCalledWith('duplicado', expect.objectContaining({ id: 10 }));
  });
  it('422 com log rejeitado (corpo incluso)', async () => {
    const r = res();
    await controller.registrar({ body: { ...body, provider: 'X' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(422);
    expect(log).toHaveBeenCalledWith('rejeitado', expect.objectContaining({ status: 422, body: expect.objectContaining({ provider: 'X' }) }));
    expect(svc.registrarPagamento).not.toHaveBeenCalled();
  });
  it('500 com log erro (mensagem do Firebird)', async () => {
    svc.registrarPagamento.mockRejectedValue(new Error('string truncation'));
    const r = res();
    await controller.registrar({ body } as any, r);
    expect(r.status).toHaveBeenCalledWith(500);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({ detalhe: 'string truncation' }));
    expect(log).toHaveBeenCalledWith('erro', expect.objectContaining({ mensagem: 'string truncation', body }));
  });
});

describe('POST /cielo/pagamento (legado)', () => {
  it('mantém codMesa na resposta e 200 quando duplicado', async () => {
    svc.registrarPagamento.mockResolvedValue({ id: 3, duplicado: true });
    const r = res();
    await controller.registrarLegadoCielo({ body: { codMesa: 7, paymentCode: 'DEBITO_AVISTA', cieloResponse: { id: 'O', payments: [{ amount: 100 }] } } } as any, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.send).toHaveBeenCalledWith({ id: 3, codMesa: 7, duplicado: true });
  });
});

describe('PATCH /pagamentos/:id/estorno-manual', () => {
  it('400 id inválido', async () => {
    const r = res();
    await controller.estornoManual({ params: { id: 'x' }, body: { motivo: 'm' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
  it('422 sem motivo', async () => {
    const r = res();
    await controller.estornoManual({ params: { id: '9' }, body: {} } as any, r);
    expect(r.status).toHaveBeenCalledWith(422);
    expect(svc.estornarManual).not.toHaveBeenCalled();
  });
  it('200 e log estorno_manual', async () => {
    svc.estornarManual.mockResolvedValue({ id: 9, estornadoPor: 'MANUAL', estornadoEm: '2026-10-19T12:00:00.000Z' });
    const r = res();
    await controller.estornoManual({ params: { id: '9' }, body: { motivo: ' Pix devolvido ', usuario: 'caixa1' } } as any, r);
    expect(svc.estornarManual).toHaveBeenCalledWith(9, { usuario: 'caixa1', motivo: 'Pix devolvido' });
    expect(r.status).toHaveBeenCalledWith(200);
    expect(log).toHaveBeenCalledWith('estorno_manual', expect.objectContaining({ id: 9 }));
  });
  it('404/409 vindos do serviço', async () => {
    svc.estornarManual.mockRejectedValue(new service.PagamentoError(409, 'Pagamento ja estornado', { estornadoPor: 'u' }));
    const r = res();
    await controller.estornoManual({ params: { id: '9' }, body: { motivo: 'm' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.send).toHaveBeenCalledWith({ error: 'Pagamento ja estornado', estornadoPor: 'u' });
  });
});
