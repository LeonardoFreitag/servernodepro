"use strict";

var providersService = _interopRequireWildcard(require("../providers.service"));
var restauranteController = _interopRequireWildcard(require("../../restaurante/restaurante.controller"));
var state = _interopRequireWildcard(require("../heartbeat.state"));
var _heartbeat2 = require("../heartbeat.service");
var _heartbeat3 = require("../heartbeat.controller");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
jest.mock("../providers.service");
jest.mock("../../restaurante/restaurante.controller");
const providersServiceMock = providersService;
const restauranteControllerMock = restauranteController;
const PROVIDER_ID = 'provider-123';
function mockSnapshot(exists, open) {
  return {
    exists,
    data: () => exists ? {
      open
    } : undefined
  };
}
function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}
beforeEach(() => {
  jest.clearAllMocks();
  state.resetState();
  providersServiceMock.setProviderOpenFlag.mockResolvedValue(undefined);
  providersServiceMock.getConfigRow.mockResolvedValue({
    webKey: PROVIDER_ID,
    webUrlWhats: 'https://wa.me/xxx'
  });
  restauranteControllerMock.abrirRestauranteInterno.mockResolvedValue(undefined);
  restauranteControllerMock.fecharRestauranteInterno.mockResolvedValue(undefined);
});
describe('POST /providers/heartbeat', () => {
  it('retorna 404 para id desconhecido', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(false));
    const req = {
      body: {
        id: 'id-inexistente'
      }
    };
    const res = mockResponse();
    await (0, _heartbeat3.heartbeat)(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
  });
});
describe('handleHeartbeat', () => {
  it('abre o provider na transição fechado -> aberto', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    const result = await (0, _heartbeat2.handleHeartbeat)(PROVIDER_ID);
    expect(result).toEqual({
      status: 'ok',
      open: true
    });
    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'S', 'heartbeat');
    expect(restauranteControllerMock.abrirRestauranteInterno).toHaveBeenCalledTimes(1);
  });
  it('não reabre nem renotifica em heartbeats subsequentes enquanto já está aberto', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    await (0, _heartbeat2.handleHeartbeat)(PROVIDER_ID);
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'S'));
    await (0, _heartbeat2.handleHeartbeat)(PROVIDER_ID);
    await (0, _heartbeat2.handleHeartbeat)(PROVIDER_ID);
    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledTimes(1);
    expect(restauranteControllerMock.abrirRestauranteInterno).toHaveBeenCalledTimes(1);
  });
});
describe('runWatchdogTick', () => {
  it('não faz nada logo após o boot (map vazio)', async () => {
    await (0, _heartbeat2.runWatchdogTick)();
    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
    expect(restauranteControllerMock.fecharRestauranteInterno).not.toHaveBeenCalled();
  });
  it('fecha o provider após 91s sem heartbeat', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);
    await (0, _heartbeat2.handleHeartbeat)(PROVIDER_ID);
    await (0, _heartbeat2.runWatchdogTick)(start + _heartbeat2.HEARTBEAT_TIMEOUT_MS + 1000);
    expect(providersServiceMock.setProviderOpenFlag).toHaveBeenCalledWith(PROVIDER_ID, 'N', 'watchdog');
    expect(restauranteControllerMock.fecharRestauranteInterno).toHaveBeenCalledWith(PROVIDER_ID);
    Date.now.mockRestore();
  });
  it('fechamento manual não é revertido pelo watchdog enquanto não chega novo heartbeat', async () => {
    providersServiceMock.getProviderSnapshot.mockResolvedValue(mockSnapshot(true, 'N'));
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);
    await (0, _heartbeat2.handleHeartbeat)(PROVIDER_ID);
    (0, _heartbeat2.onManualClose)(PROVIDER_ID);
    jest.clearAllMocks();
    await (0, _heartbeat2.runWatchdogTick)(start + _heartbeat2.HEARTBEAT_TIMEOUT_MS + 1000);
    expect(providersServiceMock.setProviderOpenFlag).not.toHaveBeenCalled();
    expect(restauranteControllerMock.fecharRestauranteInterno).not.toHaveBeenCalled();
    Date.now.mockRestore();
  });
});