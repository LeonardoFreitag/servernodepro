import { Request, Response, NextFunction } from 'express';
import { firebase } from '../../../shared/firebase/firebase.config';
import * as rm from '../../../shared/utils/removeEmoji';

const fb = firebase;

export function get(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send([]);
}

export function post(req: Request, res: Response, next: NextFunction): void {
  const data = req.body;
  const ticket = data.file ? rm.remove(data.file) : data.file;
  fb.firestore().collection('requests').doc(data.id).update({ ticket })
    .then(() => res.status(200).send(data))
    .catch((erro: any) => res.status(400).send({ erro: erro.code }));
}

export function put(req: Request, res: Response, next: NextFunction): void {
  const data = req.body;
  const payload: Record<string, any> = {
    status: data.status,
    reason: data.reason,
  };
  if (data.deliveryMan?.code) {
    payload.deliveryMan = {
      code: data.deliveryMan.code,
      name: data.deliveryMan.name,
      phone: data.deliveryMan.phone,
    };
  }
  fb.firestore().collection('requests').doc(data.id)
    .update(payload)
    .then(() => res.status(200).send(data))
    .catch((erro: any) => res.status(400).send({ erro: erro.code }));
}

export function getByDeliveryMan(req: Request, res: Response, next: NextFunction): void {
  const { code } = req.params;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  fb.firestore().collection('requests')
    .where('deliveryMan.code', '==', code)
    .where('dateRequest', '>=', since.toISOString())
    .orderBy('dateRequest', 'desc')
    .get()
    .then((snapshot: any) => {
      const result = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.status(200).send(result);
    })
    .catch((erro: any) => res.status(400).send({ erro: erro.code }));
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send([]);
}
