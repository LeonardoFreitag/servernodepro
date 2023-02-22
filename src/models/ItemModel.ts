export interface ItemModel {
  mobileId: string;
  codigo: string;
  comandaCodigo: string;
  funcionarioCodigo: string;
  produtoCodigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  unitario: number;
  total: number;
  hora: number;
  grupo: string;
  subgrupo: string;
  impresso: string;
  obs: string;
  enviado: string;
  combinado: boolean;
  codCombinado: string;
  flavors: ItemModel[];
}
