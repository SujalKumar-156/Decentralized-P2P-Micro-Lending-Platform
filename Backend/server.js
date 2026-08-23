const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const morgan        = require('morgan');
const helmet        = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const { startEventListener } = require('./listeners/eventListener');

const app = express();

app.set('trust proxy', 1);

app.use(morgan('dev'));
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { msg: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    try {
      await startEventListener();
    } catch (err) {
      console.error('❌ Failed to start Web3 Listener:', err.message);
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/loans',  require('./routes/loans'));
app.use('/api/credit', require('./routes/credit'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    msg: 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));