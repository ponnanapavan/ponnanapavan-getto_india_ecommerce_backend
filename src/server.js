import 'dotenv/config';
import app from './app.js';
import sequelize from './config/db.js';


const PORT = process.env.PORT || 5000;

try {
  await sequelize.authenticate(); // checks the database connection first
  console.log('Database connected');

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('Could not connect to the database:', err.message);
  process.exit(1);
}