import config from '../../config';

const firebirdOptions = {
  host: config.host,
  port: 3050,
  database: config.connectionString,
  user: 'SYSDBA',
  password: 'masterkey',
  lowercase_keys: false,
  role: null as string | null,
  pageSize: 4096,
};

export default firebirdOptions;
