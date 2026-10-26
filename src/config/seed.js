import { faker } from '@faker-js/faker';
import sequelize from '../config/db.js';
import Product from '../models/Product.js';

const CATALOG = {
  Laptops: {
    brands: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus'],
    types: ['Ultrabook', 'Gaming Laptop', 'Business Laptop', '2-in-1 Laptop'],
    features: ['16GB RAM', '512GB SSD', 'Full HD display', 'backlit keyboard', 'all-day battery'],
    price: [28000, 180000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSisk39mpuhYXyWbaUgDSQAmHwVvVWH5ZONRmzO5bRQpA&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5WYtZVTk9LGqslUnh8UfGdFWpnV1t8QCEYP4UOUuH6g&s=10',
    ],
  },
  Smartphones: {
    brands: ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme'],
    types: ['5G Smartphone', 'Flagship Phone', 'Budget Smartphone', 'Foldable Phone'],
    features: ['AMOLED display', '50MP camera', 'fast charging', '128GB storage', '5000mAh battery'],
    price: [8000, 150000],
    images: [
      'https://img.magnific.com/free-photo/elegant-smartphone-composition_23-2149437074.jpg?semt=ais_hybrid&w=740&q=80',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSSE85EybZsl5bW9SvIi_ghPZk7wJM0YZFNSvgRwtUuCA&s=10',
    ],
  },
  Headphones: {
    brands: ['Sony', 'Boat', 'Noise', 'JBL', 'Bose'],
    types: ['Wireless Headphones', 'Noise Cancelling Headphones', 'Earbuds', 'Neckband Earphones'],
    features: ['active noise cancellation', '30-hour battery', 'Bluetooth 5.3', 'deep bass', 'built-in mic'],
    price: [699, 35000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDr4uN2hRUGNos_T5igjf1sDi4iS57Toffp0o9GFQCOg&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTdsrUYoN1EXCl0FXyu61Ew68pssFFFy2mEiM3qan8ToQ&s=10',
    ],
  },
  Cameras: {
    brands: ['Canon', 'Sony', 'Nikon', 'Fujifilm', 'GoPro'],
    types: ['Mirrorless Camera', 'DSLR Camera', 'Action Camera', 'Compact Camera'],
    features: ['24MP sensor', '4K video', 'image stabilisation', 'Wi-Fi sharing', 'weather sealed body'],
    price: [9000, 200000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmZp16VAlY4P86ftwgCOQVlx1-PUWTQilHaUQ6CFcQaQ&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcStQIIHAZtsXDbz3KuobMUHk7a1V87MaLWIEp5WDcZ0DQ&s=10',
    ],
  },
  Watches: {
    brands: ['Apple', 'Samsung', 'Noise', 'Fossil', 'Titan'],
    types: ['Smartwatch', 'Fitness Band', 'Analog Watch', 'Chronograph Watch'],
    features: ['heart-rate tracking', 'GPS', 'water resistant', 'sleep monitoring', '7-day battery'],
    price: [1299, 60000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTRVZ4T-rn3qJq3a73mPYNbsaPzTwEsnpe3jhX1dtqU1Q&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfEAJIz51uvI8XPo_loMzkloVgxJpeo9VE92NJV_MExw&s',
    ],
  },
  Shoes: {
    brands: ['Nike', 'Adidas', 'Puma', 'Reebok', 'Asics'],
    types: ['Running Shoes', 'Sneakers', 'Training Shoes', 'Football Boots'],
    features: ['breathable mesh', 'cushioned sole', 'lightweight design', 'slip-resistant grip'],
    price: [1499, 18000],
    images: [
      'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/7/1/71f6d8eNike-IX3952-400_1.jpg?rnd=20200526195200&tr=w-1536',
      'https://www.campusshoes.com/cdn/shop/files/HOLDER_22G-13502_BLACK-SILVER_01.webp?v=1791799741',
    ],
  },
  Clothing: {
    brands: ['Nike', 'Adidas', 'Puma', 'Levis', 'H&M'],
    types: ['T-Shirt', 'Hoodie', 'Jeans', 'Track Pants', 'Jacket'],
    features: ['100% cotton', 'regular fit', 'machine washable', 'soft fabric', 'moisture-wicking'],
    price: [499, 8000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTX-GH_K-_-jA6xhBGo5zI41Is3q-ewucjbwTi0PXDkIQ&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiSVez40Ecs4x1Rir1SiVnqG44iSV4qu9p6JXPwF3McA&s=10',
    ],
  },
  'Home Appliances': {
    brands: ['LG', 'Philips', 'Samsung', 'Bosch', 'Prestige'],
    types: ['Air Fryer', 'Microwave Oven', 'Vacuum Cleaner', 'Mixer Grinder', 'Water Purifier'],
    features: ['energy efficient', '1-year warranty', 'easy to clean', 'compact design', 'auto shut-off'],
    price: [1999, 75000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSoPUqKVilq6CF62pipuAkj4wh-WgsM1U5TfB-9duG9Qw&s=10',
      'https://img.magnific.com/free-vector/appliances-kitchen-utensil-icons-set_1284-10067.jpg?semt=ais_hybrid&w=740&q=80',
    ],
  },
  Books: {
    brands: ['Penguin', 'HarperCollins', "O'Reilly", 'Pearson', 'Wiley'],
    types: ['Programming Guide', 'Novel', 'Self-Help Book', 'Data Structures Textbook', 'Biography'],
    features: ['paperback', 'revised edition', 'illustrated', 'bestseller', '400+ pages'],
    price: [199, 2500],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9ZzXHi_hkNwJXtVbSl21XPRgQtFxyd9GbRv5X1Tj9MQ&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmcNS44I_RTbBUadkL71YKo7jlHR_bhxP1LZNCWvWpsQ&s=10',
    ],
  },
  Gaming: {
    brands: ['Sony', 'Logitech', 'Razer', 'Asus', 'Microsoft'],
    types: ['Gaming Mouse', 'Mechanical Keyboard', 'Game Controller', 'Gaming Headset', 'Console'],
    features: ['RGB lighting', 'low latency', 'ergonomic design', 'programmable keys', 'USB-C'],
    price: [999, 60000],
    images: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8oW1MWP2ug_xZXtYL8Ci3MWO4eFFuhXmnzO03wzA5XA&s=10',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQHyUJT4G7R4PbOZCrQkLbDzpWN7KMNQGbPHzwqR9hMdQ&s=10',
    ],
  },
};

const SERIES = ['Pro', 'Max', 'Lite', 'Plus', 'Air', 'Elite', 'Edge', 'Prime', 'Ultra', 'Neo'];

function makeProduct(i) {
  const category = faker.helpers.objectKey(CATALOG);
  const cfg = CATALOG[category];
  const brand = faker.helpers.arrayElement(cfg.brands);
  const type = faker.helpers.arrayElement(cfg.types);
  const series = `${faker.helpers.arrayElement(SERIES)} ${faker.number.int({ min: 1, max: 9 })}`;
  const name = `${brand} ${series} ${type}`;
  const [f1, f2, f3] = faker.helpers.arrayElements(cfg.features, 3);
  const stockQty = faker.helpers.maybe(() => faker.number.int({ min: 1, max: 200 }), { probability: 0.85 }) ?? 0;

  return {
    sku: `${category.slice(0, 3).toUpperCase()}-${String(i).padStart(5, '0')}`,
    name,
    description: `${name} with ${f1}, ${f2} and ${f3}. A reliable pick from ${brand} in the ${category.toLowerCase()} range.`,
    brand,
    category,
    price: faker.number.float({ min: cfg.price[0], max: cfg.price[1], fractionDigits: 2 }),
    rating: faker.number.float({ min: 2.5, max: 5, fractionDigits: 1 }),
    inStock: stockQty > 0,
    stockQty, // matches the model field
    imageUrl: faker.helpers.arrayElement(cfg.images),
    createdAt: faker.date.past({ years: 2 }),
  };
}

const COUNT = Number(process.argv[2]) || 600;

try {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await sequelize.sync({ force: true });

  for (const col of ['name', 'brand', 'sku', 'category']) {
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_products_${col}_trgm ON products USING gin (${col} gin_trgm_ops)`
    );
  }

  const products = Array.from({ length: COUNT }, (_, i) => makeProduct(i + 1));
  await Product.bulkCreate(products);

  console.log(`Seeded ${await Product.count()} products`);
} catch (err) {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}