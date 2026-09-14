import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { db } from '../../../shared/firebase/firebase-admin.config';
import { invalidateStatusCache } from './status.cache';
import { toIsoOffset } from '../../../shared/utils/datetime';

export type ProviderOpenSource = 'manual' | 'heartbeat' | 'watchdog' | 'panel' | (string & {});

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

/**
 * Grava o estado de abertura do provider.
 *
 * `source` é opcional e apenas carimba quem definiu o estado (consumido por
 * GET /providers/status). O contrato HTTP das rotas existentes não muda.
 */
export function setProviderOpenFlag(
  id: string,
  open: 'S' | 'N',
  source?: ProviderOpenSource,
): Promise<FirebaseFirestore.WriteResult> {
  const payload: Record<string, unknown> = { open };

  if (source) {
    payload.openSource = source;
    payload.openChangedAt = toIsoOffset();
  }

  // Invalida antes e depois: antes evita servir estado velho durante a escrita,
  // depois cobre leituras que tenham repovoado o cache no meio do caminho.
  invalidateStatusCache(id);

  return db.collection('providers').doc(id).update(payload).then((result) => {
    invalidateStatusCache(id);
    return result;
  });
}
