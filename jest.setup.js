// Os unitários descrevem o Mettre (origens M | B | E). O `.env` local pode estar
// em MODO=AUTOMAX (origens V | S | A) para testar contra o Firebird 5 — sem isto
// a suíte passaria a depender do .env da máquina. dotenv não sobrescreve
// variáveis já definidas, então este valor vence o do arquivo.
process.env.MODO = 'METTRE';
