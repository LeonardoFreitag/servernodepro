import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { firebase } from '../../../shared/firebase/firebase.config';
import config from '../../../config';

const fb = firebase;

async function ensureAuth(): Promise<void> {
  if (fb.auth().currentUser == null) {
    await fb.auth().signInWithEmailAndPassword(config.firebaseEmail, config.firebasePassword);
  }
}

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
  const { idProvider } = req.query;

  if (!idProvider) {
    throw new Error('Id Provider is required!');
  }

  const products: any[] = [];
  fb.firestore().collection('products')
    .where('idProvider', '==', idProvider)
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
      products.sort((a, b) => (a.description || '').localeCompare(b.description || ''));
      res.status(200).send(products);
    });
}

export async function post(req: Request, res: Response): Promise<void> {
  const data = req.body;
  const id: string = data.id || fb.firestore().collection('products').doc().id;

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

  try {
    await ensureAuth();
    await fb.firestore().collection('products').doc(id).set(payload);
    res.status(201).send({ id });
  } catch (erro: any) {
    console.log(erro);
    res.status(400).send({ message: erro.message });
  }
}

export async function del(req: Request, res: Response): Promise<void> {
  const data = req.body;
  // console.log('Delete product', data);

  if (!data.id) {
    res.status(400).json({ resp: 'error', message: 'id is required' });
    return;
  }

  try {
    await ensureAuth();
    await fb.firestore().collection('products').doc(data.id).delete();
    res.status(200).json({ resp: 'ok' });
  } catch (erro: any) {
    console.log(erro);
    res.status(400).json({ resp: 'error', message: erro.message });
  }
}

export async function clearProducts(req: Request, res: Response): Promise<void> {
  const data = req.body;

  try {
    await ensureAuth();
    const result = await fb.firestore().collection('products')
      .where('idProvider', '==', data.idProvider).get();
    const deletePromises = result.docs.map((item: any) =>
      fb.firestore().collection('products').doc(item.id).delete()
    );
    await Promise.all(deletePromises);
    res.status(200).json({ resp: 'ok', deleted: result.docs.length });
  } catch (erro: any) {
    console.log(erro);
    res.status(400).json({ resp: 'error', message: erro.message });
  }
}

export function put(req: Request, res: Response, next: NextFunction): void {
  res.status(201).send({ id: req.params.id, title: req.body.title, cost: req.body.cost });
}
