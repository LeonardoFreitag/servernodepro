"use strict";

var _fb = require("../fb");
var _dbVersion = require("../dbVersion");
jest.mock("../fb", () => {
  const actual = jest.requireActual("../fb");
  return {
    ...actual,
    fbQuery: jest.fn()
  };
});
const q = _fb.fbQuery;
function res() {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.send = jest.fn().mockReturnValue(r);
  return r;
}
const erroFb = (message, gdscode) => Object.assign(new Error(message), {
  gdscode
});
beforeEach(() => {
  jest.clearAllMocks();
  (0, _dbVersion.resetVersaoDbCache)();
});
describe('obterVersaoDb', () => {
  it('banco em 23 → ok', async () => {
    q.mockResolvedValue([{
      N: 23
    }]);
    expect(await (0, _dbVersion.obterVersaoDb)()).toMatchObject({
      scriptAtual: 23,
      scriptMinimo: _dbVersion.SCRIPT_MINIMO,
      ok: true
    });
    expect(q).toHaveBeenCalledWith('SELECT MAX(NUMERO) AS N FROM VERSAO_SCRIPTS');
  });
  it('banco em 21 → não ok', async () => {
    q.mockResolvedValue([{
      N: 21
    }]);
    expect(await (0, _dbVersion.obterVersaoDb)()).toMatchObject({
      scriptAtual: 21,
      ok: false
    });
  });
  it('VERSAO_SCRIPTS ausente (Table unknown) → script 0', async () => {
    q.mockRejectedValue(erroFb('Dynamic SQL Error, SQL error code = -204, Table unknown VERSAO_SCRIPTS', 335544580));
    expect(await (0, _dbVersion.obterVersaoDb)()).toMatchObject({
      scriptAtual: 0,
      ok: false
    });
  });
  it('banco inacessível sem leitura anterior → scriptAtual null, erro preenchido', async () => {
    q.mockRejectedValue(new Error('connect ECONNREFUSED'));
    expect(await (0, _dbVersion.obterVersaoDb)()).toMatchObject({
      scriptAtual: null,
      ok: false,
      erro: 'connect ECONNREFUSED'
    });
  });
  it('banco cai depois de uma leitura boa → mantém o último valor (não bloqueia)', async () => {
    q.mockResolvedValueOnce([{
      N: 23
    }]);
    await (0, _dbVersion.obterVersaoDb)();
    q.mockRejectedValueOnce(new Error('timeout'));
    const v = await (0, _dbVersion.obterVersaoDb)(true);
    expect(v).toMatchObject({
      scriptAtual: 23,
      ok: true,
      erro: 'timeout'
    });
  });
  it('usa cache: segunda chamada não consulta o banco', async () => {
    q.mockResolvedValue([{
      N: 23
    }]);
    await (0, _dbVersion.obterVersaoDb)();
    await (0, _dbVersion.obterVersaoDb)();
    expect(q).toHaveBeenCalledTimes(1);
  });
});
describe('requireDbVersion', () => {
  it('passa com 23', async () => {
    q.mockResolvedValue([{
      N: 23
    }]);
    const next = jest.fn();
    (0, _dbVersion.requireDbVersion)({}, res(), next);
    await new Promise(process.nextTick);
    expect(next).toHaveBeenCalled();
  });
  it('503 BANCO_DESATUALIZADO com 21', async () => {
    q.mockResolvedValue([{
      N: 21
    }]);
    const r = res();
    const next = jest.fn();
    (0, _dbVersion.requireDbVersion)({}, r, next);
    await new Promise(process.nextTick);
    expect(next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(503);
    expect(r.send).toHaveBeenCalledWith({
      erro: 'BANCO_DESATUALIZADO',
      scriptAtual: 21,
      scriptMinimo: _dbVersion.SCRIPT_MINIMO
    });
  });
  it('503 BANCO_INDISPONIVEL quando nunca conseguiu ler', async () => {
    q.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = res();
    (0, _dbVersion.requireDbVersion)({}, r, jest.fn());
    await new Promise(process.nextTick);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({
      erro: 'BANCO_INDISPONIVEL'
    }));
  });
});
describe('GET /health', () => {
  it('sempre 200; status degraded quando o banco está em 21', async () => {
    q.mockResolvedValue([{
      N: 21
    }]);
    const r = res();
    await (0, _dbVersion.healthHandler)({
      query: {}
    }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({
      status: 'degraded',
      db: expect.objectContaining({
        scriptAtual: 21,
        scriptMinimo: 23,
        ok: false
      })
    }));
  });
  it('force=1 ignora o cache', async () => {
    q.mockResolvedValueOnce([{
      N: 21
    }]).mockResolvedValueOnce([{
      N: 23
    }]);
    await (0, _dbVersion.healthHandler)({
      query: {}
    }, res());
    const r = res();
    await (0, _dbVersion.healthHandler)({
      query: {
        force: '1'
      }
    }, r);
    expect(r.send).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok'
    }));
  });
});