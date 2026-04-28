import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { firebase } from '../../../shared/firebase/firebase.config';

const fb = firebase;

interface Customer {
  id: string;
  email: string;
  password: string;
  name: string;
  cpf: string;
  zipcode: string;
  address: string;
  number: string;
  neigh: string;
  feeDelivery: number;
  complement: string;
  city: string;
  uf: string;
  ibge: string;
  whats: string;
  comments: string;
}

export function getNewCustomers(idProvider: string): void {
  fb.firestore()
    .collection('customers')
    .where('idProvider', '==', idProvider)
    .where('read', '==', false)
    .get()
    .then((result: any) => {
      result.forEach((item: any) => saveCustomer(item.data()));
    })
    .catch((erro: Error) => console.log(erro));
}

function saveCustomer(customer: Customer): void {
  const data = customer;

  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query(
      'SELECT oretorno FROM WEB_CLIENTES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.id, data.email, data.password, data.name, data.cpf,
        data.zipcode, data.address, data.number, data.neigh,
        data.feeDelivery, data.complement, data.city, data.uf,
        data.ibge, data.whats, data.comments,
      ],
      (err, result) => {
        if (err) console.log('erro cadastro ' + err);
        else console.log(result);
        db.detach();
      }
    );
  });

  fb.firestore().collection('customers').doc(data.id).update({ read: true });
}
