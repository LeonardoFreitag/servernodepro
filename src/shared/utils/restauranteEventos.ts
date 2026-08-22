import fs from 'fs';
import path from 'path';

export type TipoEvento = 'abertura' | 'fechamento';
export type OrigemEvento = 'manual' | 'heartbeat' | 'watchdog';

export interface RestauranteEvento {
  timestamp: string;
  idProvider: string;
  tipo: TipoEvento;
  origem: OrigemEvento;
}

// Persistido fora de src/dist para sobreviver a rebuilds
const EVENTOS_FILE = path.join(process.cwd(), 'logs', 'restaurante-eventos.jsonl');

export function registrarEventoRestaurante(idProvider: string, tipo: TipoEvento, origem: OrigemEvento): void {
  const evento: RestauranteEvento = { timestamp: new Date().toISOString(), idProvider, tipo, origem };
  fs.mkdirSync(path.dirname(EVENTOS_FILE), { recursive: true });
  fs.appendFileSync(EVENTOS_FILE, JSON.stringify(evento) + '\n');
}

export function listarEventosRestaurante(limit = 200): RestauranteEvento[] {
  if (!fs.existsSync(EVENTOS_FILE)) return [];

  const linhas = fs.readFileSync(EVENTOS_FILE, 'utf-8').split('\n').filter(Boolean);
  const eventos = linhas.map((linha) => JSON.parse(linha) as RestauranteEvento);

  return eventos.reverse().slice(0, limit);
}
