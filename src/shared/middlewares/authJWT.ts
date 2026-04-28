import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config';

export interface EntregadorPayload {
  idProvider: string;
  entregador_code: string;
  entregador_name: string;
}

declare global {
  namespace Express {
    interface Request {
      entregador?: EntregadorPayload;
    }
  }
}

export function authJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'Token inválido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwtSecret) as EntregadorPayload;
    req.entregador = payload;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
}
