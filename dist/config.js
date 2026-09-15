"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _path = _interopRequireDefault(require("path"));
var _dotenv = _interopRequireDefault(require("dotenv"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
_dotenv.default.config({
  path: _path.default.resolve(__dirname, '../.env')
});
const config = {
  host: process.env.FIREBIRD_HOST || '',
  connectionString: process.env.CONNECTION_STRING || '',
  port: process.env.PORT || '3000',
  firebirdPort: Number(process.env.FIREBIRD_PORT) || 3050,
  firebirdUser: process.env.FIREBIRD_USER || 'SYSDBA',
  firebirdPassword: process.env.FIREBIRD_PASSWORD || 'masterkey',
  venonBot: process.env.VENON_BOT === 'true',
  jwtSecret: process.env.JWT_SECRET || '',
  twilioSid: process.env.TWILIO_SID || '',
  twilioToken: process.env.TWILIO_TOKEN || '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  frontendUrl: process.env.FRONTEND_URL || '',
  firebaseEmail: process.env.FIREBASE_EMAIL || '',
  firebasePassword: process.env.FIREBASE_PASSWORD || ''
};
var _default = exports.default = config;