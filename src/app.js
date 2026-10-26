import express from 'express';
import cors from 'cors';
import productRoutes from './Products/routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// /api/products and /api/filters
app.use('/api', productRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;