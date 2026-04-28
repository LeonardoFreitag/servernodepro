import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { firebase } from '../../../shared/firebase/firebase.config';
import * as rm from '../../../shared/utils/removeEmoji';
import dateAndTime from 'date-and-time';

const fb = firebase;

interface FlavorItem {
  idRequest: string;
  code: string;
  description: string;
  edge: string;
  unity: string;
  amount: number;
  price: number;
  priceEdge: number;
  totalFlavor: number;
  totalEdge: number;
  comments: string;
}

interface RequestItem {
  combined: string;
  flavors: FlavorItem[];
  id: string;
  idRequest: string;
  code: string;
  description: string;
  unity: string;
  amount: number;
  price: number;
  total: number;
  comments: string;
}

interface RequestData {
  id: string;
  idCustomer: string;
  idProvider: string;
  dateRequest: string;
  totalProducts: number;
  feeDelivery: number;
  totalRequest: number;
  status: string;
  address: string;
  neigh: string;
  idNeigh: string;
  complement: string;
  formPayment: string;
  comments: string;
  comeGet: boolean;
  change: number;
  items: RequestItem[];
  dataCustomer: {
    whats: string;
    name: string;
    address: string;
    number: string;
    neigh: string;
    complement: string;
    latitude: string;
    longitude: string;
    zipcode: string;
    city: string;
    state: string;
  };
}

export function getNewRequests(idProvider: string): void {
  fb.firestore()
    .collection('requests')
    .where('idProvider', '==', idProvider)
    .where('read', '==', false)
    .get()
    .then((result: any) => {
      result.forEach((item: any) => handleSave(item));
    })
    .catch((erro: Error) => console.log(erro));
}

function handleSave(req: any): void {
  saveRequest(req, (idRequest: string) => {
    const items: RequestItem[] = req.data().items;
    items.forEach((prod) => {
      if (prod.combined === 'S') {
        const codeCombined = Math.floor(Math.random() * (100000 - 1) + 1);
        prod.flavors.forEach((flavor) => {
          const f = {
            id: codeCombined,
            idRequest: flavor.idRequest,
            code: flavor.code,
            description: `${flavor.description} ${flavor.edge}`,
            unity: flavor.unity,
            amount: flavor.amount.toFixed(3),
            price: flavor.price + flavor.priceEdge,
            total: flavor.totalFlavor + flavor.totalEdge,
            comments: flavor.comments,
            conjuga: codeCombined,
            idEntrega: idRequest,
          };
          saveFlavors(f, idRequest, (ok: string) => console.log('insert flavor ' + ok));
        });
      } else {
        saveItems(prod, idRequest, (ok: string) => console.log('insert item ' + ok));
      }
    });
  });
}

function saveRequest(request: any, callback: (idRequest: string) => void): void {
  const data: RequestData = request.data();
  const comeGet = data.comeGet ? 'S' : 'N';
  const newDate = dateAndTime.format(new Date(data.dateRequest), 'DD/MM/YYYY').toString();

  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query(
      'SELECT oretorno FROM WEB_ENTREGA(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.id, data.idCustomer, data.idProvider, newDate,
        data.totalProducts, data.feeDelivery, data.totalRequest, data.status,
        rm.remove(data.address), rm.remove(data.dataCustomer.number),
        data.neigh, data.idNeigh, rm.remove(data.complement),
        data.formPayment, data.dataCustomer.whats, rm.remove(data.dataCustomer.name),
        rm.remove(data.comments), comeGet, data.change,
        rm.remove(data.dataCustomer.address), rm.remove(data.dataCustomer.number),
        data.dataCustomer.neigh, rm.remove(data.dataCustomer.complement),
        data.dataCustomer.latitude, data.dataCustomer.longitude,
        rm.remove(data.dataCustomer.zipcode), rm.remove(data.dataCustomer.city),
        data.dataCustomer.state,
      ],
      (err, result) => {
        if (err) {
          console.log('save request ' + err);
        } else {
          callback(result[0].ORETORNO);
          fb.firestore().collection('requests').doc(data.id).update({ read: true });
        }
        db.detach();
      }
    );
  });
}

function saveFlavors(flavor: any, idRequest: string, callback: (ok: string) => void): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.transaction(Firebird.ISOLATION_READ_COMMITED, (errt, transaction) => {
      db.query(
        'SELECT oretorno FROM WEB_ITEMS_COMBINED(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          flavor.id, flavor.idRequest, flavor.code, flavor.description,
          flavor.unity, flavor.amount, flavor.price, flavor.total,
          rm.remove(flavor.comments), flavor.idEntrega, flavor.conjuga,
        ],
        (errq, result) => {
          if (errq) { transaction.rollback(); return callback('0'); }
          transaction.commit((errf) => {
            if (errf) { transaction.rollback(); callback('0'); }
            else { db.detach(); callback(result[0].ORETORNO); }
          });
        }
      );
    });
  });
}

function saveItems(item: RequestItem, idRequest: string, callback: (ok: string) => void): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.transaction(Firebird.ISOLATION_READ_COMMITED, (errt, transaction) => {
      transaction.query(
        'SELECT oretorno FROM WEB_ITEMS(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          item.id, item.idRequest, item.code, item.description,
          item.unity, parseFloat(String(item.amount)), parseFloat(String(item.price)),
          parseFloat(String(item.total)), rm.remove(item.comments), idRequest,
        ],
        (errq, result) => {
          if (errq) { transaction.rollback(); return callback('0'); }
          transaction.commit((errf) => {
            if (errf) { console.log(errf); transaction.rollback(); callback('0'); }
            else { console.log('retorno do firebird'); callback(result[0].ORETORNO); }
          });
          db.detach();
        }
      );
    });
  });
}
