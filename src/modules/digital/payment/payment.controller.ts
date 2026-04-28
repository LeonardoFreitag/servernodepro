import { Request, Response, NextFunction } from 'express';
import { firebase } from '../../../shared/firebase/firebase.config';

const fb = firebase;

export function get(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send([]);
}

export async function post(req: Request, res: Response, next: NextFunction): Promise<void> {
  const data = req.body;
  let user = fb.auth().currentUser;

  const save = () => {
    const ref = fb.firestore().collection('formPayment').doc();
    ref.set({
      idProvider: data.idProvider, id: ref.id,
      code: data.code, formPayment: data.formPayment, change: data.change,
    })
      .then(() => res.status(201).send({ id: ref.id }))
      .catch((erro: any) => { res.status(400).send(erro); console.log(erro); });
  };

  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    save();
  } else {
    save();
  }
}

export async function put(req: Request, res: Response, next: NextFunction): Promise<void> {
  const data = req.body;
  let user = fb.auth().currentUser;

  const deleteAll = () =>
    fb.firestore().collection('formPayment').orderBy('formPayment')
      .where('idProvider', '==', data.idProvider).get()
      .then(async (result: any) => {
        const allForms: any[] = [];
        result.forEach((item: any) => allForms.push(item.data()));
        for (const d of allForms) {
          await fb.firestore().collection('formPayment').doc(d.id).delete();
        }
        res.status(200).send({ status: 'ok' });
      })
      .catch((erro: any) => res.status(400).send(erro.code));

  if (user == null) {
    fb.auth().signInWithEmailAndPassword(data.email, data.password)
      .then(deleteAll)
      .catch((erro: any) => res.status(400).send(erro.code));
  } else {
    deleteAll();
  }
}

export function del(req: Request, res: Response, next: NextFunction): void {
  res.status(200).send();
}
