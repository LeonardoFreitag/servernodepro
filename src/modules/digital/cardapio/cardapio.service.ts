import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

interface Product {
  CODIGO: string;
  NOME: string;
  UNIDADE: string;
  PRECO: number;
  GRUPO: string;
  SUBGRUPO: string;
  IMPRESSAO: string;
}

export function getProducts(): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM v_estoque', (err, result) => {
      db.detach();
    });
  });
}

export function sendProducts(): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT * FROM v_estoque', (err, result) => {
      insertProduct(result);
      db.detach();
    });
  });
}

function insertProduct(data: Product[]): void {
  data.forEach((element) => {
    const { CODIGO, NOME, UNIDADE, PRECO, GRUPO, SUBGRUPO, IMPRESSAO } = element;
    console.log({ CODIGO, NOME, UNIDADE, PRECO, GRUPO, SUBGRUPO, IMPRESSAO });
  });
}
