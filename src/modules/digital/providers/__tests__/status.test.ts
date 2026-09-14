import * as providersService from '../providers.service';
import * as restauranteController from '../../restaurante/restaurante.controller';
import * as state from '../heartbeat.state';
import { handleHeartbeat, runWatchdogTick, HEARTBEAT_TIMEOUT_MS } from '../heartbeat.service';
import { getProviderStatus } from '../status.service';
import { status } from '../status.controller';
import { resetStatusCache, STATUS_CACHE_TTL_MS } from '../status.cache';

jest.mock('../providers.service');
jest.mock('../../restaurante/restaurante.controller');

// Mock do SDK client usado por PUT /providers (providers.controller).
const mockSignIn = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../../shared/firebase/firebase.config', () => ({
  firebase: {
    auth: () => ({
      signInWithEmailAndPassword: (...args: any[]) => mockSignIn(...args),
      currentUser: { uid: 'provider-123' },
    }),
    firestore: () => ({
      collection: () => ({
        doc: () => ({ update: (payload: any) => mockUpdate(payload) }),
      }),
    }),
  },
}));

// Importado depois do jest.mock acima (hoisted pelo babel-jest).
import { put } from '../providers.controller';

const providersServiceMock = providersService as jest.Mocked<typeof providersService>;
const restauranteControllerMock = restauranteController as jest.Mocked<typeof restauranteController>;

const PROVIDER_ID = 'provider-123';

/** Documento do provider como fica no Firestore após cada tipo de escrita. */
function mockSnapshot(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists,
    data: () => (exists ? data ?? {} : undefined),
  } as unknown as FirebaseFirestore.DocumentSnapshot;
}

function mockResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
}

/** Executa PUT /providers e devolve o payload gravado no documento. */
async function callPut(open: 'S' | 'N'): Promise<any> {
  mockSignIn.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);

  const req: any = { body: { email: 'a@b.c', password: '123', id: PROVIDER_ID, open } };
  const res = mockResponse();

  put(req, res, jest.fn());
  await new Promise((resolve) => setImmediate(resolve));

  return mockUpdate.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  state.resetState();
  resetStatusCache();
  providersServiceMock.setProviderOpenFlag.mockResolvedValue(undefined as any);
  providersServiceMock.getConfigRow.mockResolvedValue({ webKey: PROVIDER_ID, webUrlWhats: 'https://wa.me/xxx' });
  restauranteControllerMock.abrirRestauranteInterno.mockResolvedValue(undefined as any);
  restauranteControllerMock.fecharRestauranteInterno.mockResolvedValue(undefined as any);
});

describe('GET /providers/status', () => {
  it('retorna 404 para id desconhecido', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(false));

    const req: any = { query: { id: 'id-inexistente' } };
    const res = mockResponse();

    await status(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('retorna 400 quando o id não é informado', async () => {
    const req: any = { query: {} };
    const res = mockResponse();

    await status(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(providersServiceMock.getProviderSnapshot).not.toHaveBeenCalled();
  });

  it('responde 200 com open, source, since e serverTime', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(
      mockSnapshot(true, { open: 'S', openSource: 'heartbeat', openChangedAt: '2026-09-12T18:00:07-04:00' }),
    );

    const req: any = { query: { id: PROVIDER_ID } };
    const res = mockResponse();

    await status(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.open).toBe(true);
    expect(body.source).toBe('heartbeat');
    // Mesmo instante, re-renderizado no fuso do servidor (o PDV só exibe).
    expect(new Date(body.since).getTime()).toBe(new Date('2026-09-12T18:00:07-04:00').getTime());
    expect(body.since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(body.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('omite source/since em documentos legados que só têm open', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'N' }));

    const result = await getProviderStatus(PROVIDER_ID);

    expect(result).toMatchObject({ status: 'ok' });
    const data = (result as any).data;
    expect(data.open).toBe(false);
    expect(data.source).toBeUndefined();
    expect(data.since).toBeUndefined();
  });

  it('não tem efeito colateral: não abre, não fecha e não registra heartbeat', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'N', openSource: 'manual' }));

    await getProviderStatus(PROVIDER_ID);

    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
    expect(restauranteControllerMock.abrirRestauranteInterno).not.toHaveBeenCalled();
    expect(restauranteControllerMock.fecharRestauranteInterno).not.toHaveBeenCalled();
    expect(state.getEntry(PROVIDER_ID)).toBeUndefined();
  });
});

describe('estado publicado por GET /providers/status', () => {
  it('após PUT /providers open:"S" → open:true, source:"manual"', async () => {
    const gravado = await callPut('S');

    expect(gravado.open).toBe('S');
    expect(gravado.openSource).toBe('manual');
    expect(gravado.openChangedAt).toEqual(expect.any(String));

    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, gravado));

    const result = await getProviderStatus(PROVIDER_ID);

    expect((result as any).data).toMatchObject({ open: true, source: 'manual' });
    expect((result as any).data.since).toEqual(expect.any(String));
  });

  it('após PUT /providers open:"N" → open:false', async () => {
    const gravado = await callPut('N');

    expect(gravado.open).toBe('N');
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, gravado));

    const result = await getProviderStatus(PROVIDER_ID);

    expect((result as any).data).toMatchObject({ open: false, source: 'manual' });
  });

  it('após reabertura pelo heartbeat → source:"heartbeat"', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'N' }));

    await handleHeartbeat(PROVIDER_ID);

    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'S', 'heartbeat');

    providersServiceMock.getProviderSnapshot.mockResolvedValue(
      mockSnapshot(true, { open: 'S', openSource: 'heartbeat', openChangedAt: new Date().toISOString() }),
    );
    resetStatusCache();

    const result = await getProviderStatus(PROVIDER_ID);
    expect((result as any).data).toMatchObject({ open: true, source: 'heartbeat' });
  });

  it('após fechamento pelo watchdog → open:false, source:"watchdog"', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'N' }));
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);

    await handleHeartbeat(PROVIDER_ID);
    await runWatchdogTick(start + HEARTBEAT_TIMEOUT_MS + 1000);

    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'N', 'watchdog');

    (Date.now as jest.Mock).mockRestore();

    providersServiceMock.getProviderSnapshot.mockResolvedValue(
      mockSnapshot(true, { open: 'N', openSource: 'watchdog', openChangedAt: new Date().toISOString() }),
    );
    resetStatusCache();

    const result = await getProviderStatus(PROVIDER_ID);
    expect((result as any).data).toMatchObject({ open: false, source: 'watchdog' });
  });
});

describe('cache do status', () => {
  it('serve do cache dentro do TTL e revalida depois dele', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'S', openSource: 'manual' }));

    const t0 = Date.now();
    await getProviderStatus(PROVIDER_ID, t0);
    await getProviderStatus(PROVIDER_ID, t0 + 1000);
    await getProviderStatus(PROVIDER_ID, t0 + STATUS_CACHE_TTL_MS - 1);

    expect(providersServiceMock.getProviderSnapshot).toHaveBeenCalledTimes(1);

    await getProviderStatus(PROVIDER_ID, t0 + STATUS_CACHE_TTL_MS + 1);

    expect(providersServiceMock.getProviderSnapshot).toHaveBeenCalledTimes(2);
    expect(STATUS_CACHE_TTL_MS).toBeLessThanOrEqual(10_000);
  });

  it('serverTime é sempre o relógio atual, mesmo com resposta em cache', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'S' }));

    const t0 = Date.now();
    const primeiro = (await getProviderStatus(PROVIDER_ID, t0)) as any;
    const segundo = (await getProviderStatus(PROVIDER_ID, t0 + 3000)) as any;

    expect(segundo.data.serverTime).not.toBe(primeiro.data.serverTime);
  });
});

describe('consulta não conta como heartbeat', () => {
  it('GET /providers/status repetido não impede o watchdog de fechar após 90 s', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, { open: 'N' }));
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);

    await handleHeartbeat(PROVIDER_ID);
    const primeiroHeartbeat = state.getEntry(PROVIDER_ID)!.lastHeartbeatAt;

    // PDV consultando a cada 30 s, em 8 terminais, durante todo o intervalo do watchdog.
    for (let i = 0; i < 24; i += 1) {
      const req: any = { query: { id: PROVIDER_ID } };
      await status(req, mockResponse());
    }

    expect(state.getEntry(PROVIDER_ID)!.lastHeartbeatAt).toBe(primeiroHeartbeat);

    jest.clearAllMocks();
    providersServiceMock.setProviderOpenFlag.mockResolvedValue(undefined as any);
    restauranteControllerMock.fecharRestauranteInterno.mockResolvedValue(undefined as any);

    await runWatchdogTick(start + HEARTBEAT_TIMEOUT_MS + 1000);

    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'N', 'watchdog');
    expect(restauranteControllerMock.fecharRestauranteInterno).toHaveBeenCalledWith(PROVIDER_ID);

    (Date.now as jest.Mock).mockRestore();
  });
});
