import express from 'express';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// MySQL Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root', // update with your MySQL root password
  database: process.env.DB_NAME || 'food',     // database name from your MySQL Workbench
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Health check & test connection
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as connected');
    res.json({ status: 'ok', database: 'MySQL Connected successfully', test: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 1. GET all restaurants
app.get('/api/restaurants', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM restaurants');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET all menu items
app.get('/api/menuitems', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM menuitems');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET all orders
app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY OrderDate DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET order details
app.get('/api/orderdetails', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orderdetails');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST create new order (Transaction across `orders` and `orderdetails`)
app.post('/api/orders', async (req, res) => {
  const { UserID, RestaurantID, TotalAmount, items } = req.body;
  if (!UserID || !RestaurantID || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Insert into orders table
    const [orderResult] = await conn.query(
      'INSERT INTO orders (UserID, RestaurantID, OrderDate, TotalAmount, Status) VALUES (?, ?, NOW(), ?, "Placed")',
      [UserID, RestaurantID, TotalAmount]
    );
    const newOrderId = orderResult.insertId;

    // Insert into orderdetails table for each item
    for (const item of items) {
      await conn.query(
        'INSERT INTO orderdetails (OrderID, ItemID, Quantity, Subtotal) VALUES (?, ?, ?, ?)',
        [newOrderId, item.ItemID, item.Quantity, item.Subtotal]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      OrderID: newOrderId,
      message: 'Order recorded in MySQL successfully',
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 7. PUT update user profile
app.put('/api/users/:id', async (req, res) => {
  const { Name, Phone, Address } = req.body;
  try {
    await pool.query(
      'UPDATE users SET Name = ?, Phone = ?, Address = ? WHERE UserID = ?',
      [Name, Phone, Address, req.params.id]
    );
    res.json({ success: true, message: 'User updated in MySQL' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Tomato MySQL Backend Server listening on http://localhost:${PORT}`);
});
