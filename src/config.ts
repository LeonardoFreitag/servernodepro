import 'dotenv/config';

interface Config {
  host: string;
  connectionString: string;
  port: string;
  venonBot: boolean;
  jwtSecret: string;
  twilioSid: string;
  twilioToken: string;
  twilioWhatsappFrom: string;
  frontendUrl: string;
}

const config: Config = {
  host: process.env.HOST || '',
  connectionString: process.env.CONNECTION_STRING || '',
  port: process.env.PORT || '3000',
  venonBot: process.env.VENON_BOT === 'true',
  jwtSecret: process.env.JWT_SECRET || '',
  twilioSid: process.env.TWILIO_SID || '',
  twilioToken: process.env.TWILIO_TOKEN || '',
  twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  frontendUrl: process.env.FRONTEND_URL || '',
};

export default config;
