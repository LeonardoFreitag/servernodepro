import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { firebase } from '../../../shared/firebase/firebase.config';

const fb = firebase;

export function getEstoque(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM v_estoque', (err, result) => {
      const dataResult = result.map((item: any) => ({
        codigo: item.CODIGO,
        nome: item.NOME,
        unidade: item.UNIDADE,
        preco: item.PRECO,
        grupo: item.GRUPO,
        subgrupo: item.SUBGRUPO,
        fracionado: item.FRACIONADO,
        impressao: item.IMPRESSO,
      }));
      res.status(200).send(dataResult);
      db.detach();
    });
  });
}

export function getCardapio(req: Request, res: Response, next: NextFunction): void {
  const idProvider = req.body.idProvider;

  if (!idProvider) {
    throw new Error('Id Provider is required!');
  }

  const products: any[] = [];
  fb.firestore().collection('products')
    .where('idProvider', '==', idProvider)
    .orderBy('description')
    .get()
    .then((result: any) => {
      result.forEach((item: any) => {
        const d = item.data();
        products.push({
          id: d.id,
          idProvider: d.idProvider,
          code: d.code,
          description: d.description,
          unity: d.unity,
          group: d.group,
          subgroup: d.subgroup,
          price: d.price,
          active: d.active,
          fractioned: d.fractioned,
          fractions: d.fractions,
          edge: d.edge,
          additional: d.additional,
          portionSize: d.portionSize,
        });
      });
      res.status(200).send(products);
    });
}

export async function post(req: Request, res: Response): Promise<void> {
  const data = req.body;
  const id: string = data.id || fb.firestore().collection('products').doc().id;
  let user = fb.auth().currentUser;

  const payload = {
    idProvider: data.idProvider, id, code: data.code, description: data.description,
    unity: data.unity, group: data.group, subgroup: data.subgroup, price: data.price,
    active: data.active, fractioned: data.fractioned, fractions: data.fractions,
    edge: data.edge, additional: data.additional, portionSize: data.portionSize,
    web_img_64: data.web_img_64, web_borda_subgrupo: data.web_borda_subgrupo,
    monday: data.monday, monday_start: data.monday_start, monday_stop: data.monday_stop,
    tuesday: data.tuesday, tuesday_start: data.tuesday_start, tuesday_stop: data.tuesday_stop,
    wednesday: data.wednesday, wednesday_start: data.wednesday_start, wednesday_stop: data.wednesday_stop,
    thursday: data.thursday, thursday_start: data.thursday_start, thursday_stop: data.thursday_stop,
    friday: data.friday, friday_start: data.friday_start, friday_stop: data.friday_stop,
    saturday: data.saturday, saturday_start: data.saturday_start, saturday_stop: data.saturday_stop,
    sunday: data.sunday, sunday_start: data.sunday_start, sunday_stop: data.sunday_stop,
  };

  const save = () =>
    fb.firestore().collection('products').doc(id).set(payload)
      .then(() => res.status(201).send({ id }))
      .catch((erro: any) => { res.status(400).send(erro); console.log(erro); });

  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    save();
  } else {
    save();
  }
}

export async function del(req: Request, res: Response): Promise<void> {
  const data = req.body;
  let user = fb.auth().currentUser;

  const remove = () =>
    fb.firestore().collection('products').doc(data.id).delete()
      .then(() => res.status(201).json({ resp: 'ok' }))
      .catch((erro: any) => { res.status(400).json({ resp: 'error' }); console.log(erro); });

  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    remove();
  } else {
    remove();
  }
}

export async function clearProducts(req: Request, res: Response): Promise<void> {
  const data = req.body;
  let user = fb.auth().currentUser;

  const clear = async () => {
    const result = await fb.firestore().collection('products')
      .where('idProvider', '==', data.idProvider).get();
    for (const item of (result as any)) {
      await fb.firestore().collection('products').doc(item.data().id).delete()
        .then(() => res.status(201).json({ resp: 'ok' }))
        .catch((erro: any) => { res.status(400).json({ resp: 'error' }); console.log(erro); });
    }
  };

  if (user == null) {
    await fb.auth().signInWithEmailAndPassword(data.email, data.password);
    clear();
  } else {
    clear();
  }
}

export function put(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send({ id: req.params.id, title: req.body.title, cost: req.body.cost });
}
