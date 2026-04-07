import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps async Express handlers so rejections are passed to `next` (Express 4). */
export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => void fn(req, res, next).catch(next);
}
