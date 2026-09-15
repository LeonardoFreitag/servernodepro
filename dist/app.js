"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _express = _interopRequireDefault(require("express"));
var _cors = _interopRequireDefault(require("cors"));
var _bodyParser = _interopRequireDefault(require("body-parser"));
var _path = _interopRequireDefault(require("path"));
var _config = _interopRequireDefault(require("./modules/pdv/config/config.routes"));
var _func = _interopRequireDefault(require("./modules/pdv/func/func.routes"));
var _grupos = _interopRequireDefault(require("./modules/pdv/grupos/grupos.routes"));
var _subgrupos = _interopRequireDefault(require("./modules/pdv/subgrupos/subgrupos.routes"));
var _obs = _interopRequireDefault(require("./modules/pdv/obs/obs.routes"));
var _mesas = _interopRequireDefault(require("./modules/pdv/mesas/mesas.routes"));
var _itens = _interopRequireDefault(require("./modules/pdv/itens/itens.routes"));
var _cielo = _interopRequireDefault(require("./modules/pdv/cielo/cielo.routes"));
var _nfce = _interopRequireDefault(require("./modules/pdv/nfce/nfce.routes"));
var _cardapio = _interopRequireDefault(require("./modules/digital/cardapio/cardapio.routes"));
var _productManager = _interopRequireDefault(require("./modules/digital/cardapio/productManager.routes"));
var _providers = _interopRequireDefault(require("./modules/digital/providers/providers.routes"));
var _neighborhood = _interopRequireDefault(require("./modules/digital/neighborhood/neighborhood.routes"));
var _payment = _interopRequireDefault(require("./modules/digital/payment/payment.routes"));
var _requests = _interopRequireDefault(require("./modules/digital/requests/requests.routes"));
var _entregas = _interopRequireDefault(require("./modules/digital/entregas/entregas.routes"));
var _delivery = _interopRequireDefault(require("./modules/digital/delivery/delivery.routes"));
var _restaurante = _interopRequireDefault(require("./modules/digital/restaurante/restaurante.routes"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// PDV

// Digital

const app = (0, _express.default)();
app.use((0, _cors.default)());
app.use(_bodyParser.default.json({
  limit: '50mb'
}));
app.use(_bodyParser.default.urlencoded({
  limit: '50mb',
  extended: true
}));
app.use(_express.default.static(_path.default.join(__dirname, 'images')));
app.use(_express.default.static(_path.default.join(__dirname, 'views')));
app.get('/', (req, res) => {
  res.status(200).send({
    title: 'Mettre API',
    version: '0.0.2'
  });
});

// PDV
app.use('/config', _config.default);
app.use('/func', _func.default);
app.use('/grupos', _grupos.default);
app.use('/subgrupos', _subgrupos.default);
app.use('/obs', _obs.default);
app.use('/mesas', _mesas.default);
app.use('/itens', _itens.default);
app.use('/cielo', _cielo.default);
app.use('/nfce', _nfce.default);

// Digital
app.use('/products', _cardapio.default);
app.use('/productManager', _productManager.default);
app.use('/providers', _providers.default);
app.use('/neighborhood', _neighborhood.default);
app.use('/payment', _payment.default);
app.use('/request', _requests.default);
app.use('/entregas', _entregas.default);
app.use('/delivery', _delivery.default);
app.use('/restaurante', _restaurante.default);
var _default = exports.default = app;