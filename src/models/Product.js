import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sku: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  brand: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  rating: { type: DataTypes.FLOAT, allowNull: false },
  inStock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  stockQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  imageUrl: { type: DataTypes.STRING },
}, { tableName: 'products', timestamps: true });

export default Product;