import express from 'express';
import { usersRouter } from './routes/users';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', authMiddleware, usersRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
