import { Request, Response, NextFunction } from 'express';

/**
 * MongoDB operator-injection protection: strips any key beginning with `$` or containing `.`
 * from req.body / req.params / req.query (same idea as express-mongo-sanitize, no dependency).
 */
function sanitizeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      out[key] = sanitizeValue(val);
    }
    return out as T;
  }
  return value;
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body = sanitizeValue(req.body);
  if (req.params && typeof req.params === 'object') {
    for (const [k, v] of Object.entries(req.params)) {
      if (typeof v === 'string' && v.startsWith('$')) (req.params as any)[k] = v.replace(/^\$+/, '');
    }
  }
  if (req.query && typeof req.query === 'object') {
    const cleaned = sanitizeValue(req.query);
    // Express 4 exposes req.query as a plain object we can mutate.
    for (const key of Object.keys(req.query)) delete (req.query as any)[key];
    Object.assign(req.query, cleaned);
  }
  next();
}
