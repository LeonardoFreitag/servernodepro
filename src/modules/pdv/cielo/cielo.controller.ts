/**
 * @deprecated Substituído por `../pagamentos`. Mantido apenas como reexport
 * para não quebrar imports antigos.
 */
export {
  registrarLegadoCielo as registrarPagamento,
  listarLegadoMesa as listarPagamentosMesa,
} from '../pagamentos/pagamentos.controller';
