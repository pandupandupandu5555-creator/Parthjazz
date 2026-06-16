import { Request, Response, NextFunction } from "express";
import { logError } from "../utils/logger";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logError(
    `[ERROR] ${req.method} ${req.originalUrl}: ${
      err?.message || "Unknown error"
    }`
  );

  res.status(err?.status || 500).json({
    success: false,
    error: err?.message || "Internal Server Error",
  });
}