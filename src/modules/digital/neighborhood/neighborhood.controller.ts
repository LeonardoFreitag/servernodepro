import { Request, Response, NextFunction } from 'express';
import { firebase } from '../../../shared/firebase/firebase.config';

const fb = firebase;

export function get(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send([]);
}

export async function post(req: Request, res: Response, next: NextFunction): Promise<void> {
  const data = req.body;
  const id: string = data.id || fb.firestore().collection('neighborhood').doc().id;
  let user = fb.auth().currentUser;

  const payload = {
    idProvider: data.idProvider, id, code: data.code, name: data.name,
    feeDelivery: data.feeDelivery, city: data.city, uf: data.uf,
    ibge: data.ibge, active: data.active,
  };

  const save = () =>
    fb.firestore().collection('neighborhood').doc(id).set(payload)
      .then(() => res.status(201).send({ id }))
      .catch((erro: any) => { res.status(400).send(erro); console.log(erro); });

  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    save();
  } else {
    save();
  }
}

export function put(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send({ id: req.params.id, title: req.body.title, cost: req.body.cost });
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send(req.body);
}
