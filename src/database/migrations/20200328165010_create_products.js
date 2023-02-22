
exports.up = function(knex) {
  return knex.schema.createTable('products', function (table) {
      table.string('id').primary();
      table.string('code', 30).noteNullable();
      table.string('description', 150).noteNullable();
      table.string('unity', 150).noteNullable();
      table.string('group', 150).noteNullable();
      table.string('subgroup',150).noteNullable();
      table.decimal('price').noteNullable();

  })
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};
