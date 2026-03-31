import { Router, Request, Response } from 'express';

export const usersRouter = Router();

// GET /api/users
usersRouter.get('/', (_req: Request, res: Response) => {
  // TODO: fetch from database
  res.json([]);
});

// GET /api/users/:id
usersRouter.get('/:id', (req: Request, res: Response) => {
  // TODO: fetch user by id
  res.json({ id: req.params.id });
});

// POST /api/users
usersRouter.post('/', (_req: Request, res: Response) => {
  // TODO: create user
  res.status(201).json({ created: true });
});

// DELETE /api/users/:id
usersRouter.delete('/:id', (req: Request, res: Response) => {
  // TODO: delete user
  res.json({ deleted: req.params.id });
});
