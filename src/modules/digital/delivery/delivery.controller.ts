import { Request, Response, NextFunction } from 'express';
import Firebird from 'node-firebird';
import firebirdOptions from '../../../shared/database/firebird';
import { firebase } from '../../../shared/firebase/firebase.config';

const fb = firebase;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getFee(req: Request, res: Response, next: NextFunction): void {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'invalid_params', message: 'Parâmetros lat e lng são obrigatórios e devem ser números válidos.' });
    return;
  }

  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) {
      next(err);
      return;
    }

    db.query('SELECT ORIGIN_LAT, ORIGIN_LNG FROM CONFIG', (err, configRows) => {
      if (err) {
        db.detach();
        next(err);
        return;
      }

      const cfg = configRows && configRows[0];
      const originLat = cfg ? parseFloat(cfg.ORIGIN_LAT) : NaN;
      const originLng = cfg ? parseFloat(cfg.ORIGIN_LNG) : NaN;

      if (isNaN(originLat) || isNaN(originLng)) {
        db.detach();
        res.status(500).json({ error: 'config_missing', message: 'Coordenadas de origem do estabelecimento não configuradas (ORIGIN_LAT / ORIGIN_LNG).' });
        return;
      }

      const distanceKm = parseFloat(haversineKm(originLat, originLng, lat, lng).toFixed(2));

      db.query(
        'SELECT FIRST 1 ID, DIST_MIN, DIST_MAX, FEE FROM DELIVERY_ZONES WHERE ? >= DIST_MIN AND ? < DIST_MAX AND ACTIVE = ?',
        [distanceKm, distanceKm, 'S'],
        (err, zoneRows) => {
          db.detach();

          if (err) {
            next(err);
            return;
          }

          if (!zoneRows || zoneRows.length === 0) {
            res.status(422).json({
              error: 'outside_delivery_area',
              message: 'Endereço fora da área de entrega.',
              distanceKm,
            });
            return;
          }

          const zone = zoneRows[0];
          res.status(200).json({
            fee: parseFloat(zone.FEE),
            distanceKm,
            zone: `${zone.DIST_MIN}–${zone.DIST_MAX} km`,
          });
        }
      );
    });
  });
}

export function sync(req: Request, res: Response, next: NextFunction): void {
  Firebird.attach(firebirdOptions, (err, db) => {
    if (err) { next(err); return; }

    db.query('SELECT WEB_KEY, ORIGIN_LAT, ORIGIN_LNG FROM CONFIG', (err, configRows) => {
      if (err) { db.detach(); next(err); return; }

      const cfg = configRows && configRows[0];
      const idProvider: string = cfg?.WEB_KEY ?? '';
      const originLat = cfg ? parseFloat(cfg.ORIGIN_LAT) : NaN;
      const originLng = cfg ? parseFloat(cfg.ORIGIN_LNG) : NaN;

      if (isNaN(originLat) || isNaN(originLng)) {
        db.detach();
        res.status(500).json({ error: 'config_missing', message: 'Coordenadas de origem não configuradas.' });
        return;
      }

      db.query(
        "SELECT DIST_MIN, DIST_MAX, FEE FROM DELIVERY_ZONES WHERE ACTIVE = 'S' ORDER BY DIST_MIN",
        [],
        (err, zoneRows) => {
          db.detach();
          if (err) { next(err); return; }

          const zones = (zoneRows || []).map((z: any) => ({
            distMin: parseFloat(z.DIST_MIN),
            distMax: parseFloat(z.DIST_MAX),
            fee: parseFloat(z.FEE),
          }));

          const payload = {
            originLat,
            originLng,
            zones,
            updatedAt: new Date().toISOString(),
          };

          fb.firestore()
            .collection('deliveryConfig')
            .doc(idProvider)
            .set(payload, { merge: true })
            .then(() => {
              res.status(200).json({ success: true, zonesCount: zones.length });
            })
            .catch((firestoreErr: Error) => {
              res.status(500).json({ error: 'firestore_error', message: firestoreErr.message });
            });
        }
      );
    });
  });
}
