import * as providersService from '../providers.service';
import * as restauranteController from '../../restaurante/restaurante.controller';
import * as state from '../heartbeat.state';
import { handleHeartbeat, runWatchdogTick, onManualClose, HEARTBEAT_TIMEOUT_MS } from '../heartbeat.service';
import { heartbeat } from '../heartbeat.controller';

jest.mock('../providers.service');
jest.mock('../../restaurante/restaurante.controller');

const providersServiceMock = providersService as jest.Mocked<typeof providersService>;
const restauranteControllerMock = restauranteController as jest.Mocked<typeof restauranteController>;

const PROVIDER_ID = 'provider-123';

function mockSnapshot(exists: boolean, open?: 'S' | 'N') {
  return {
    exists,
    data: () => (exists ? { open } : undefined),
  } as unknown as FirebaseFirestore.DocumentSnapshot;
}

function mockResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  state.resetState();
  providersServiceMock.setProviderOpenFlag.mockResolvedValue(undefined as any);
  providersServiceMock.getConfigRow.mockResolvedValue({ webKey: PROVIDER_ID, webUrlWhats: 'https://wa.me/xxx' });
  restauranteControllerMock.abrirRestauranteInterno.mockResolvedValue(undefined as any);
  restauranteControllerMock.fecharRestauranteInterno.mockResolvedValue(undefined as any);
});

describe('POST /providers/heartbeat', () => {
  it('retorna 404 para id desconhecido', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(false));

    const req: any = { body: { id: 'id-inexistente' } };
    const res = mockResponse();

    await heartbeat(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
  });
});

describe('handleHeartbeat', () => {
  it('abre o provider na transição fechado -> aberto', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));

    const result = await handleHeartbeat(PROVIDER_ID);

    expect(result).toEqual({ status: 'ok', open: true });
    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'S');
    expect(restauranteControllerMock.abrirRestauranteInterno).toHaveBeenCalledTimes(1);
  });

  it('não reabre nem renotifica em heartbeats subsequentes enquanto já está aberto', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    await handleHeartbeat(PROVIDER_ID);

    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'S'));
    await handleHeartbeat(PROVIDER_ID);
    await handleHeartbeat(PROVIDER_ID);

    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledTimes(1);
    expect(restauranteControllerMock.abrirRestauranteInterno).toHaveBeenCalledTimes(1);
  });
});

describe('runWatchdogTick', () => {
  it('não faz nada logo após o boot (map vazio)', async () => {
    await runWatchdogTick();

    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
    expect(restauranteControllerMock.fecharRestauranteInterno).not.toHaveBeenCalled();
  });

  it('fecha o provider após 91s sem heartbeat', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);

    await handleHeartbeat(PROVIDER_ID);

    await runWatchdogTick(start + HEARTBEAT_TIMEOUT_MS + 1000);

    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'N');
    expect(restauranteControllerMock.fecharRestauranteInterno).toHaveBeenCalledWith(PROVIDER_ID);

    (Date.now as jest.Mock).mockRestore();
  });

  it('fechamento manual não é revertido pelo watchdog enquanto não chega novo heartbeat', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);

    await handleHeartbeat(PROVIDER_ID);
    onManualClose(PROVIDER_ID);

    jest.clearAllMocks();

    await runWatchdogTick(start + HEARTBEAT_TIMEOUT_MS + 1000);

    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
    expect(restauranteControllerMock.fecharRestauranteInterno).not.toHaveBeenCalled();

    (Date.now as jest.Mock).mockRestore();
  });
});
