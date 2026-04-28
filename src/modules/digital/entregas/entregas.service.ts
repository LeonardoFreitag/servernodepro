import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import config from '../../../config';
import { EntregadorPayload } from '../../../shared/middlewares/authJWT';

export function gerarToken(payload: EntregadorPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' });
}

export async function enviarWhatsApp(fone: string, link: string): Promise<void> {
  const client = twilio(config.twilioSid, config.twilioToken);

  await client.messages.create({
    from: config.twilioWhatsappFrom,
    to: `whatsapp:+${fone}`,
    body: `Olá! Acesse seus pedidos de entrega pelo link:\n${link}`,
  });
}
