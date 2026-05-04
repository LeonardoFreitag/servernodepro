import { Request, Response } from 'express';
import Firebird from 'node-firebird';
import { admin, db } from '../../../shared/firebase/firebase-admin.config';
import firebirdOptions from '../../../shared/database/firebird';

export function abrirRestaurante(req: Request, res: Response): void {
  Firebird.attach(firebirdOptions, (err, fbDb) => {
    if (err) {
      res.status(500).send({ sucesso: false, erro: err.message });
      return;
    }

    fbDb.query('SELECT web_key, web_url_whats FROM config ROWS 1', async (queryErr, result) => {
      fbDb.detach();

      if (queryErr) {
        res.status(500).send({ sucesso: false, erro: queryErr.message });
        return;
      }

      const row = result && result[0];
      if (!row) {
        res.status(500).send({ sucesso: false, erro: 'Nenhum registro encontrado na tabela config' });
        return;
      }

      try {
        const idProvider = row.WEB_KEY ?? row.web_key;

        await db.collection('restauranteAtivo').doc(idProvider).set({
          restaurante: 'ServerNode',
          idProvider,
          link: row.WEB_URL_WHATS ?? row.web_url_whats,
          ativo: true,
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).send({ sucesso: true, restaurante: 'ServerNode' });
      } catch (fsErr: any) {
        res.status(500).send({ sucesso: false, erro: fsErr.message });
      }
    });
  });
}

export function fecharRestaurante(req: Request, res: Response): void {
  Firebird.attach(firebirdOptions, (err, fbDb) => {
    if (err) {
      res.status(500).send({ sucesso: false, erro: err.message });
      return;
    }

    fbDb.query('SELECT web_key FROM config ROWS 1', async (queryErr, result) => {
      fbDb.detach();

      if (queryErr) {
        res.status(500).send({ sucesso: false, erro: queryErr.message });
        return;
      }

      const row = result && result[0];
      if (!row) {
        res.status(500).send({ sucesso: false, erro: 'Nenhum registro encontrado na tabela config' });
        return;
      }

      try {
        const idProvider = row.WEB_KEY ?? row.web_key;

        await db.collection('restauranteAtivo').doc(idProvider).update({
          ativo: false,
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).send({ sucesso: true, restaurante: 'ServerNode' });
      } catch (fsErr: any) {
        res.status(500).send({ sucesso: false, erro: fsErr.message });
      }
    });
  });
}
