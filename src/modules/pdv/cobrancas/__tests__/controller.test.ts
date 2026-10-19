import * as service from '../cobrancas.service';
import * as controller from '../cobrancas.controller';

jest.mock('../cobrancas.service', () => {
  const actual = jest.requireActual('../cobrancas.service');
  return {
    ...actual,
    listarPendentes: jest.fn(),
    listarCards: jest.fn(),
    obter: jest.fn(),
    claim: jest.fn(),
    registrarDesfecho: jest.fn(),
    cancelar: jest.fn(),
  };
});

const svc = service as jest.Mocked<typeof service>;

function res() {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.send = jest.fn().mockReturnValue(r);
  return r;
}
const dto: any = { id: 'x', status: 'pending' };

beforeEach(() => jest.clearAllMocks());

describe('GET /cobrancas/pendentes', () => {
  it('400 sem terminalId', async () => {
    const r = res();
    await controller.pendentes({ query: {} } as any, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
  it('200 com lista', async () => {
    svc.listarPendentes.mockResolvedValue([dto]);
    const r = res();
    await controller.pendentes({ query: { terminalId: 'T1' } } as any, r);
    expect(svc.listarPendentes).toHaveBeenCalledWith('T1');
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.send).toHaveBeenCalledWith([dto]);
  });
});

describe('GET /cobrancas/cards', () => {
  it('400 sem filtro', async () => {
    const r = res();
    await controller.cards({ query: {} } as any, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
  it('entregador=3', async () => {
    svc.listarCards.mockResolvedValue([]);
    await controller.cards({ query: { entregador: '3' } } as any, res());
    expect(svc.listarCards).toHaveBeenCalledWith({ entregador: 3, mesas: false });
  });
  it('mesas=1', async () => {
    svc.listarCards.mockResolvedValue([]);
    await controller.cards({ query: { mesas: '1' } } as any, res());
    expect(svc.listarCards).toHaveBeenCalledWith({ entregador: undefined, mesas: true });
  });

  it('loga só o card que o entregador recebe pela primeira vez', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const card = (id: string): any => ({ id, origem: 'E', codVenda: 10, valorCents: 5000, status: 'pending' });
    const linhas = () => log.mock.calls.map((c) => String(c[0]));

    svc.listarCards.mockResolvedValue([card('A')]);
    await controller.cards({ query: { entregador: '7' } } as any, res());
    await controller.cards({ query: { entregador: '7' } } as any, res());
    expect(linhas()).toHaveLength(1);
    expect(linhas()[0]).toContain('card-recebido: entregador=7 id=A origem=E codVenda=10 valorCents=5000');

    svc.listarCards.mockResolvedValue([card('A'), card('B')]);
    await controller.cards({ query: { entregador: '7' } } as any, res());
    expect(linhas()).toHaveLength(2);
    expect(linhas()[1]).toContain('id=B');

    log.mockRestore();
  });
});

describe('POST /cobrancas/:id/claim', () => {
  it('409 propaga CobrancaError com status', async () => {
    svc.claim.mockRejectedValue(new service.CobrancaError(409, 'Cobranca ja esta sendo atendida ou foi encerrada', { status: 'approved' }));
    const r = res();
    await controller.claim({ params: { id: 'x' }, body: { terminalId: 'T1' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.send).toHaveBeenCalledWith({ error: 'Cobranca ja esta sendo atendida ou foi encerrada', status: 'approved' });
  });
  it('repassa codEntregador ao service quando o app se identifica', async () => {
    svc.claim.mockResolvedValue(dto);
    await controller.claim({ params: { id: 'x' }, body: { terminalId: 'MOTO1', codEntregador: 3 } } as any, res());
    expect(svc.claim).toHaveBeenCalledWith('x', 'MOTO1', 3);
  });

  it('sem codEntregador passa null (comportamento antigo)', async () => {
    svc.claim.mockResolvedValue(dto);
    await controller.claim({ params: { id: 'x' }, body: { terminalId: 'MOTO1' } } as any, res());
    expect(svc.claim).toHaveBeenCalledWith('x', 'MOTO1', null);
  });

  it.each([['abc'], [0], [-1], [2.5]])('422 com codEntregador inválido (%s)', async (valor) => {
    const r = res();
    await controller.claim({ params: { id: 'x' }, body: { terminalId: 'MOTO1', codEntregador: valor } } as any, r);
    expect(r.status).toHaveBeenCalledWith(422);
    expect(svc.claim).not.toHaveBeenCalled();
  });

  it('500 em erro genérico', async () => {
    svc.claim.mockRejectedValue(new Error('boom'));
    const r = res();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await controller.claim({ params: { id: 'x' }, body: { terminalId: 'T1' } } as any, r);
    spy.mockRestore();
    expect(r.status).toHaveBeenCalledWith(500);
  });
});

describe('PATCH /cobrancas/:id', () => {
  const base = { terminalId: 'T1', provider: 'CIELO', status: 'approved' };
  it('422 provider inválido', async () => {
    const r = res();
    await controller.desfecho({ params: { id: 'x' }, body: { ...base, provider: 'X' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(422);
  });
  it('422 status inválido', async () => {
    const r = res();
    await controller.desfecho({ params: { id: 'x' }, body: { ...base, status: 'ok' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(422);
  });
  it('422 pagamento.amountCents inválido', async () => {
    const r = res();
    await controller.desfecho({ params: { id: 'x' }, body: { ...base, pagamento: { transactionType: 'CREDIT', amountCents: 0 } } } as any, r);
    expect(r.status).toHaveBeenCalledWith(422);
  });
  it('200 repassa pagamento normalizado', async () => {
    svc.registrarDesfecho.mockResolvedValue(dto);
    const r = res();
    await controller.desfecho({
      params: { id: 'x' },
      body: { ...base, pagamento: { transactionType: 'DEBIT', amountCents: 4500, providerData: { paymentCode: 'DEBITO_AVISTA' }, rawResponse: { a: 1 } } },
    } as any, r);
    expect(svc.registrarDesfecho).toHaveBeenCalledWith('x', {
      terminalId: 'T1', provider: 'CIELO', status: 'approved', motivoErro: null,
      pagamento: { transactionType: 'DEBIT', installments: 1, amountCents: 4500, providerData: { paymentCode: 'DEBITO_AVISTA' }, rawResponse: { a: 1 } },
    });
    expect(r.status).toHaveBeenCalledWith(200);
  });
});

describe('POST /cobrancas/:id/cancelar', () => {
  it('202 quando sent_to_terminal', async () => {
    svc.cancelar.mockResolvedValue({ httpStatus: 202, cobranca: dto });
    const r = res();
    await controller.cancelar({ params: { id: 'x' } } as any, r);
    expect(r.status).toHaveBeenCalledWith(202);
  });
});
