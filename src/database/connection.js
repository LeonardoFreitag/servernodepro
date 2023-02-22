const knex = require('knex');
const configuracion = require('../../knexfile');

const connection = knex(configuracion.development);

module.exports = connection;