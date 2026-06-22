const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();

const app = express();

const morgan = require('morgan');
app.use(morgan('dev'));

const helmet = require('helmet');
app.use(helmet());

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));


app.use(express.json({ limit: '10kb' }));

const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());


// Rate limiting — max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { msg: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ─── Database connection ──────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/loans',  require('./routes/loans'));
app.use('/api/credit', require('./routes/credit'));

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ msg: 'Something went wrong', error: err.message });
});

// ─── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));

const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));