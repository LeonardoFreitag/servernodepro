import 'dotenv/config';

interface Config {
  host: string;
  connectionString: string;
  port: string;
  firebirdPort: number;
  firebirdUser: string;
  firebirdPassword: string;
  venonBot: boolean;
  jwtSecret: string;
  twilioSid: string;
  twilioToken: string;
  twilioWhatsappFrom: string;
  frontendUrl: string;
  firebaseEmail: string;
  firebasePassword: string;
}

const config: Config = {
  host: process.env.HOST || '',
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
  firebasePassword: process.env.FIREBASE_PASSWORD || '',
};

export default config;
