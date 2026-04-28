import { Router } from 'express';
import * as controller from './requests.controller';

const router = Router();

router.get('/', controller.get);
router.get('/deliveryman/:code', controller.getByDeliveryMan);
router.post('/', controller.post);
router.put('/', controller.put);
router.delete('/', controller.del);

export default router;
