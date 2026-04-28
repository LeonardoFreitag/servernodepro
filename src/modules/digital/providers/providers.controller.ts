import { Request, Response, NextFunction } from 'express';
import { firebase } from '../../../shared/firebase/firebase.config';

const fb = firebase;

export function get(req: Request, res: Response, next: NextFunction): void {
  const data = req.body;
  fb.auth().signInWithEmailAndPassword(data.email, data.password)
    .then(() => {
      const uid = (fb.auth().currentUser as any)?.uid;
      res.status(200).send({ id: uid });
    })
    .catch((erro: any) => {
      res.status(400).send({ id: erro.code });
    });
}

export function post(req: Request, res: Response, next: NextFunction): void {
  const data = req.body;

  const providerPayload = {
    id: '', name: data.name, fantasy: data.fantasy, cnpj: data.cnpj,
    phone: data.phone, cellphone: data.cellphone, email: data.email,
    password: data.password, logo: data.logo, feeDelivery: data.feeDelivery,
    ray: data.ray, feeDeliveryMode: data.feeDeliveryMode, singleEdge: data.singleEdge,
  };

  if (data.id === '0' || data.id == null) {
    fb.auth().createUserWithEmailAndPassword(data.email, data.password)
      .then(() => {
        const uid = fb.auth().currentUser!.uid;
        fb.firestore().collection('providers').doc(uid).set({ ...providerPayload, id: uid })
          .then(() => res.status(200).send({ id: uid }))
          .catch((erro: any) => { res.status(400).send(erro.code); console.log(erro); });
      })
      .catch((erro: any) => { res.status(400).send(erro.code); console.log(erro); });
  } else {
    fb.auth().signInWithEmailAndPassword(data.email, data.password)
      .then(() => {
        fb.firestore().collection('providers').doc(data.id).set({ ...providerPayload, id: data.id })
          .then(() => res.status(200).send({ id: data.id }))
          .catch((erro: any) => { res.status(400).send(erro); console.log(erro); });
      })
      .catch((erro: any) => { res.status(400).send(erro); console.log(erro); });
  }
}

export function put(req: Request, res: Response, next: NextFunction): void {
  const data = req.body;
  fb.auth().signInWithEmailAndPassword(data.email, data.password)
    .then(() => {
      fb.firestore().collection('providers').doc(data.id).update({ open: data.open })
        .then(() => res.status(200).send({ id: data.id }))
        .catch((erro: any) => { res.status(400).send(erro); console.log(erro); });
    })
    .catch((erro: any) => res.status(400).send(erro));
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send();
}
