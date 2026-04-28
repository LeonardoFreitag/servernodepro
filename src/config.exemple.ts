interface Config {
  host: string;
  connectionString: string;
  port: string;
  venonBot: boolean;
}

const config: Config = {
  host: '192.168.18.103',
  connectionString: 'C:/Projetos/Mettre/Dados/DADOS.FDB',
  port: '3000',
  venonBot: false,
};

export default config;
