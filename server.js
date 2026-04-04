import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './src/config/db.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';
import { errorHandler, notFound } from './src/middleware/error.js';
import authRoutes from './src/routes/authRoutes.js';
import riskRoutes from './src/routes/riskRoutes.js';

dotenv.config();
connectDB();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/risks', riskRoutes);

app.get('/', (req, res) => res.json({ message: 'API Running securely' }));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
