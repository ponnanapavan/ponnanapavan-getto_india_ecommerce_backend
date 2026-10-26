import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import request from 'supertest';
import express from 'express';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL / TEST_DATABASE_URL must be set in .env');
}

const { default: Product } = await import('../models/Product.js');
const { default: sequelize } = await import('../config/db.js');
const { default: routes } = await import('../Products/routes.js');

const app = express();
app.use(express.json());
app.use('/api', routes);

const FIXTURES = [
  { sku: 'LAP-00001', name: 'Apple MacBook Pro 14',     description: 'Powerful laptop',   brand: 'Apple',    category: 'Laptops',     price: 199999, rating: 4.8, inStock: true,  stockQty: 5,   imageUrl: 'placeholder://a' },
  { sku: 'LAP-00002', name: 'Dell XPS 13',              description: 'Thin ultrabook',    brand: 'Dell',     category: 'Laptops',     price: 129999, rating: 4.5, inStock: false, stockQty: 0,   imageUrl: 'placeholder://b' },
  { sku: 'PHN-00001', name: 'Apple iPhone 15 Pro',      description: 'Flagship phone',    brand: 'Apple',    category: 'Smartphones', price: 149900, rating: 4.7, inStock: true,  stockQty: 50,  imageUrl: 'placeholder://c' },
  { sku: 'PHN-00002', name: 'Samsung Galaxy S24',       description: 'Android flagship',  brand: 'Samsung',  category: 'Smartphones', price: 79999,  rating: 4.4, inStock: true,  stockQty: 20,  imageUrl: 'placeholder://d' },
  { sku: 'BOK-00001', name: 'Clean Code',               description: 'Programming guide', brand: "O'Reilly", category: 'Books',       price: 2500,   rating: 4.9, inStock: true,  stockQty: 100, imageUrl: 'placeholder://e' },
  { sku: 'BOK-00002', name: 'The Pragmatic Programmer', description: 'Software craft',    brand: 'Pearson',  category: 'Books',       price: 3200,   rating: 4.6, inStock: false, stockQty: 0,   imageUrl: 'placeholder://f' },
  { sku: 'GAM-00001', name: 'Sony PlayStation 5',       description: 'Next-gen console',  brand: 'Sony',     category: 'Gaming',      price: 54990,  rating: 4.9, inStock: true,  stockQty: 3,   imageUrl: 'placeholder://g' },
  { sku: 'GAM-00002', name: 'Logitech G Pro Mouse',     description: 'Gaming mouse',      brand: 'Logitech', category: 'Gaming',      price: 12999,  rating: 4.3, inStock: true,  stockQty: 15,  imageUrl: 'placeholder://h' },
];

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await sequelize.sync({ force: true });

  for (const col of ['name', 'brand', 'sku', 'category']) {
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_products_${col}_trgm ON products USING gin (${col} gin_trgm_ops)`
    );
  }

  const btree = [
    ['price', 'price'],
    ['rating', 'rating DESC'],
    ['created_at', '"createdAt" DESC'],
    ['category_price', 'category, price'],
    ['brand_price', 'brand, price'],
  ];
  for (const [name, cols] of btree) {
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_products_${name} ON products (${cols})`
    );
  }

  await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector`);
  await sequelize.query(`
    CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')),        'A') ||
        setweight(to_tsvector('english', coalesce(NEW.brand, '')),       'B') ||
        setweight(to_tsvector('english', coalesce(NEW.category, '')),    'B') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
        setweight(to_tsvector('simple',  coalesce(NEW.sku, '')),         'D');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);
  await sequelize.query(`
    DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
    CREATE TRIGGER trg_products_search_vector
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
  `);
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING gin (search_vector)`
  );

  await Product.bulkCreate(FIXTURES);
}, 30000);

afterAll(async () => {
  await sequelize.close();
});

describe('Search API — happy paths', () => {
  test('full product-name search', async () => {
    const res = await request(app).get('/api/products?q=MacBook');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toContain('MacBook');
  });

  test('partial product-name search', async () => {
    const res = await request(app).get('/api/products?q=Book');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('search by brand', async () => {
    const res = await request(app).get('/api/products?q=Apple');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(
      res.body.data.every((p) => p.brand === 'Apple' || p.name.includes('Apple'))
    ).toBe(true);
  });

  test('search by category', async () => {
    const res = await request(app).get('/api/products?q=Books');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('search by SKU', async () => {
    const res = await request(app).get('/api/products?q=PHN-00001');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sku).toBe('PHN-00001');
  });

  test('case-insensitive search', async () => {
    const a = await request(app).get('/api/products?q=macbook');
    const b = await request(app).get('/api/products?q=MACBOOK');
    const c = await request(app).get('/api/products?q=MacBook');
    expect(a.body.data.length).toBe(b.body.data.length);
    expect(b.body.data.length).toBe(c.body.data.length);
  });
});

describe('Filter combinations', () => {
  test('multiple filters at once', async () => {
    const res = await request(app).get(
      '/api/products?q=Apple&minRating=4.6&inStock=true'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.rating >= 4.6 && p.inStock === true)).toBe(true);
  });

  test('category + brand', async () => {
    const res = await request(app).get('/api/products?category=Laptops&brand=Apple');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.category === 'Laptops' && p.brand === 'Apple')).toBe(true);
  });

  test('price range', async () => {
    const res = await request(app).get('/api/products?minPrice=100000&maxPrice=200000');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => Number(p.price) >= 100000 && Number(p.price) <= 200000)).toBe(true);
  });

  test('sort price_asc', async () => {
    const res = await request(app).get('/api/products?sort=price_asc&limit=100&page=1');
    const prices = res.body.data.map((p) => Number(p.price));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  test('sort price_desc', async () => {
    const res = await request(app).get('/api/products?sort=price_desc&limit=100&page=1');
    const prices = res.body.data.map((p) => Number(p.price));
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });

  test('sort rating', async () => {
    const res = await request(app).get('/api/products?sort=rating&limit=100&page=1');
    const ratings = res.body.data.map((p) => p.rating);
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
  });

  test('in stock only', async () => {
    const res = await request(app).get('/api/products?inStock=true&limit=100&page=1');
    expect(res.body.data.every((p) => p.inStock === true)).toBe(true);
  });
});

describe('Offset pagination', () => {
  test('pagination with active search criteria', async () => {
    const page1 = await request(app).get('/api/products?limit=2&page=1&sort=name');
    const page2 = await request(app).get('/api/products?limit=2&page=2&sort=name');
    expect(page1.body.pagination.page).toBe(1);
    expect(page2.body.pagination.page).toBe(2);
    expect(page1.body.data.map((p) => p.id)).not.toEqual(page2.body.data.map((p) => p.id));
  });

  test('stable pagination when sort values are equal', async () => {
    await Product.update({ rating: 4.5 }, { where: {} });

    const p1 = await request(app).get('/api/products?sort=rating&limit=3&page=1');
    const p2 = await request(app).get('/api/products?sort=rating&limit=3&page=2');
    const p3 = await request(app).get('/api/products?sort=rating&limit=3&page=3');

    const ids = [
      ...p1.body.data.map((p) => p.id),
      ...p2.body.data.map((p) => p.id),
      ...p3.body.data.map((p) => p.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);

    const all = await Product.findAll({ order: [['id', 'ASC']], raw: true });
    expect(ids).toEqual(all.map((p) => p.id));

    for (const f of FIXTURES) {
      await Product.update({ rating: f.rating }, { where: { sku: f.sku } });
    }
  });

  test('pagination respects filters', async () => {
    const res = await request(app).get('/api/products?category=Books&limit=1&page=1');
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('Cursor pagination', () => {
  test('first page returns nextCursor and hasMore', async () => {
    const res = await request(app).get('/api/products?sort=price_asc&limit=3&mode=cursor');
    expect(res.status).toBe(200);
    expect(res.body.pagination.mode).toBe('cursor');
    expect(res.body.pagination.hasMore).toBe(true);
    expect(typeof res.body.pagination.nextCursor).toBe('string');
    expect(res.body.data).toHaveLength(3);
  });

  test('walking pages via cursor returns every product exactly once', async () => {
    const seen = [];
    let cursor = null;
    for (let i = 0; i < 10; i++) {
      const url =
        `/api/products?sort=price_asc&limit=3&mode=cursor` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      seen.push(...res.body.data.map((p) => p.id));
      if (!res.body.pagination.hasMore) break;
      cursor = res.body.pagination.nextCursor;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(FIXTURES.length);
  });

  test('cursor order matches offset order', async () => {
    const offset1 = await request(app).get('/api/products?sort=price_asc&limit=3&page=1');
    const cursor1 = await request(app).get('/api/products?sort=price_asc&limit=3&mode=cursor');
    expect(cursor1.body.data.map((p) => p.id)).toEqual(
      offset1.body.data.map((p) => p.id)
    );

    const offset2 = await request(app).get('/api/products?sort=price_asc&limit=3&page=2');
    const cursor2 = await request(app).get(
      `/api/products?sort=price_asc&limit=3&mode=cursor&cursor=${encodeURIComponent(cursor1.body.pagination.nextCursor)}`
    );
    expect(cursor2.body.data.map((p) => p.id)).toEqual(
      offset2.body.data.map((p) => p.id)
    );
  });

  test('cursor pagination respects filters', async () => {
    const res = await request(app).get('/api/products?category=Books&sort=price_asc&limit=1&mode=cursor');
    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.category === 'Books')).toBe(true);
  });

  test('cursor works with price_desc', async () => {
    const p1 = await request(app).get('/api/products?sort=price_desc&limit=3&mode=cursor');
    const p2 = await request(app).get(
      `/api/products?sort=price_desc&limit=3&mode=cursor&cursor=${encodeURIComponent(p1.body.pagination.nextCursor)}`
    );
    const all = [...p1.body.data, ...p2.body.data].map((p) => Number(p.price));
    expect([...all].sort((a, b) => b - a)).toEqual(all);
  });

  test('rejects malformed cursor', async () => {
    const res = await request(app).get('/api/products?cursor=not-base64-json');
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/cursor/i);
  });
});

describe('Empty results & clearing', () => {
  test('nonsense query returns empty when fuzzy also fails', async () => {
    const res = await request(app).get('/api/products?q=zzzzzzzzzzzzzzzzzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.fuzzy).toBe(false);
  });

  test('clearing filters returns full catalogue', async () => {
    const res = await request(app).get('/api/products?limit=100&page=1');
    expect(res.body.pagination.total).toBe(FIXTURES.length);
  });
});

describe('Invalid inputs', () => {
  test('negative minPrice', async () => {
    const res = await request(app).get('/api/products?minPrice=-10');
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/minPrice/);
  });

  test('negative maxPrice', async () => {
    const res = await request(app).get('/api/products?maxPrice=-1');
    expect(res.status).toBe(400);
  });

  test('minPrice > maxPrice', async () => {
    const res = await request(app).get('/api/products?minPrice=100&maxPrice=50');
    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/higher than maxPrice/);
  });

  test('invalid sort', async () => {
    const res = await request(app).get('/api/products?sort=lol');
    expect(res.status).toBe(400);
  });

  test('minRating out of range', async () => {
    const res = await request(app).get('/api/products?minRating=9');
    expect(res.status).toBe(400);
  });

  test('invalid inStock', async () => {
    const res = await request(app).get('/api/products?inStock=maybe');
    expect(res.status).toBe(400);
  });

  test('limit > 100', async () => {
    const res = await request(app).get('/api/products?limit=1000');
    expect(res.status).toBe(400);
  });

  test('page < 1', async () => {
    const res = await request(app).get('/api/products?page=0');
    expect(res.status).toBe(400);
  });

  test('query too long', async () => {
    const res = await request(app).get(`/api/products?q=${'a'.repeat(101)}`);
    expect(res.status).toBe(400);
  });
});

describe('SQL injection attempts', () => {
  const payloads = [
    "' OR '1'='1",
    "'; DROP TABLE products; --",
    "Apple'; DELETE FROM products; --",
    "%' OR name IS NOT NULL --",
    "1; SELECT * FROM products",
  ];

  test.each(payloads)('payload %s does not break or leak', async (payload) => {
    const res = await request(app).get('/api/products').query({ q: payload });
    expect(res.status).toBe(200);

    const count = await Product.count();
    expect(count).toBe(FIXTURES.length);

    expect(res.body.data.every((p) => p.name !== payload)).toBe(true);
  });
});

describe('Rapid search / outdated responses', () => {
  test('concurrent requests return consistent data', async () => {
    const [a, b, c] = await Promise.all([
      request(app).get('/api/products?q=Apple'),
      request(app).get('/api/products?q=Samsung'),
      request(app).get('/api/products?q=PlayStation'),
    ]);
    expect(a.body.data.every((p) => p.name.includes('Apple') || p.brand === 'Apple')).toBe(true);
    expect(b.body.data.every((p) => p.name.includes('Samsung') || p.brand === 'Samsung')).toBe(true);
    expect(c.body.data.every((p) => p.name.includes('PlayStation') || p.brand === 'Sony')).toBe(true);
  });
});

describe('Autocomplete', () => {
  test('suggest returns names matching prefix', async () => {
    const res = await request(app).get('/api/products/suggest?q=App');
    expect(res.status).toBe(200);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(res.body.suggestions.every((s) => /app/i.test(s))).toBe(true);
  });

  test('suggest ignores short queries', async () => {
    const res = await request(app).get('/api/products/suggest?q=a');
    expect(res.body.suggestions).toEqual([]);
  });
});

describe('Filters endpoint', () => {
  test('returns category + brand counts', async () => {
    const res = await request(app).get('/api/products/filters');
    expect(res.status).toBe(200);
    expect(res.body.categories.find((c) => c.name === 'Laptops').count).toBe(2);
    expect(res.body.brands.find((b) => b.name === 'Apple').count).toBe(2);
  });
});