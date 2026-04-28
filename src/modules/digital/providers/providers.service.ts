import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';

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
