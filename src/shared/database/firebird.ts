import config from '../../config';

const firebirdOptions = {
  host: config.host,
  port: config.firebirdPort,
  database: config.connectionString,
  user: config.firebirdUser,
  password: config.firebirdPassword,
  lowercase_keys: false,
  role: null as string | null,
  pageSize: 4096,
};

export default firebirdOptions;
