const test = require('node:test');
const assert = require('node:assert/strict');

const { getProductFilters, getSortOption } = require('../util/product-query');

test('builds product filters from query', () => {
  const filter = getProductFilters({
    category: 'Shoes',
    minPrice: '10',
    maxPrice: '20',
    search: 'nike'
  });

  assert.equal(filter.category, 'Shoes');
  assert.equal(filter.price.$gte, 10);
  assert.equal(filter.price.$lte, 20);
  assert.ok(filter.$or);
});

test('uses a safe default sort', () => {
  assert.deepEqual(getSortOption('price_asc'), { price: 1 });
  assert.deepEqual(getSortOption('unknown_key'), { createdAt: -1 });
});
