import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { db } from '../../../shared/firebase/firebase-admin.config';

export function getProviderId(callback: (id: string) => void): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) throw err;

    db.query('SELECT web_key FROM config', (err, result) => {
      db.detach();
      const id: string = result[0].WEB_KEY;
      return callback(id);
    });
  });
}

export interface ConfigRow {
  webKey: string;
  webUrlWhats?: string;
}

export function getConfigRow(): Promise<ConfigRow> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, fbDb) => {
      if (err) {
        reject(err);
        return;
      }

      fbDb.query('SELECT web_key, web_url_whats FROM config ROWS 1', (queryErr, result) => {
        fbDb.detach();

        if (queryErr) {
          reject(queryErr);
          return;
        }

        const row = result && result[0];
        if (!row) {
          reject(new Error('Nenhum registro encontrado na tabela config'));
          return;
        }

        resolve({
          webKey: row.WEB_KEY ?? row.web_key,
          webUrlWhats: row.WEB_URL_WHATS ?? row.web_url_whats,
        });
      });
    });
  });
}

export function getProviderSnapshot(id: string): Promise<FirebaseFirestore.DocumentSnapshot> {
  return db.collection('providers').doc(id).get();
}

export function setProviderOpenFlag(id: string, open: 'S' | 'N'): Promise<FirebaseFirestore.WriteResult> {
  return db.collection('providers').doc(id).update({ open });
}
