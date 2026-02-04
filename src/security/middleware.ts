/**
 * 安全中间件
 * 提供通用的安全验证功能
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * 验证请求内容类型
 */
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers["content-type"];

  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (!contentType || !contentType.includes("application/json")) {
      res.status(415).json({
        error: "Unsupported Media Type",
        message: "Content-Type must be application/json",
      });
      return;
    }
  }

  next();
}

/**
 * 防止NoSQL注入
 */
export function preventNoSqlInjection(req: Request, res: Response, next: NextFunction): void {
  // 检查请求体中的可疑模式
  const checkObject = (obj: unknown): boolean => {
    if (typeof obj !== "object" || obj === null) {
      return true;
    }

    const str = JSON.stringify(obj);

    // 检查NoSQL注入模式
    const nosqlPatterns = [
      /\$where/i,
      /\$ne/i,
      /\$nin/i,
      /\$in/i,
      /\$regex/i,
      /\$or/i,
      /\$and/i,
      /\$not/i,
      /\$nor/i,
      /\$exists/i,
      /\$type/i,
      /\$mod/i,
      /\$size/i,
      /\$all/i,
      /\$elemMatch/i,
      /\$text/i,
      /\$search/i,
    ];

    for (const pattern of nosqlPatterns) {
      if (pattern.test(str)) {
        return false;
      }
    }

    return true;
  };

  if (req.body && !checkObject(req.body)) {
    res.status(400).json({ error: "Bad Request", message: "Invalid request data" });
    return;
  }

  next();
}

/**
 * 防止跨站脚本攻击（XSS）
 */
export function preventXSS(req: Request, res: Response, next: NextFunction): void {
  const sanitize = (value: unknown): unknown => {
    if (typeof value === "string") {
      // 基本的XSS防护：转义HTML特殊字符
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
    }

    if (Array.isArray(value)) {
      return value.map(sanitize);
    }

    if (typeof value === "object" && value !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitize(val);
      }
      return sanitized;
    }

    return value;
  };

  // 清理请求体
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // 清理查询参数
  if (req.query) {
    const sanitizedQuery: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.query)) {
      sanitizedQuery[key] = sanitize(value);
    }
    req.query = sanitizedQuery as typeof req.query;
  }

  next();
}

/**
 * 速率限制中间件（简化版）
 */
export function createRateLimiter(maxRequests: number, windowMs: number): RequestHandler {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    let record = requests.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      requests.set(ip, record);
    }

    record.count++;

    // 设置速率限制头部
    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count).toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000).toString());

    if (record.count > maxRequests) {
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${Math.ceil((record.resetTime - now) / 1000)} seconds.`,
      });
      return;
    }

    next();
  };
}

/**
 * 验证输入长度
 */
export function validateInputLength(maxLength: number = 10000): RequestHandler {
  return function (req: Request, res: Response, next: NextFunction): void {
    const checkLength = (obj: unknown): boolean => {
      if (typeof obj === "string") {
        return obj.length <= maxLength;
      }

      if (Array.isArray(obj)) {
        return obj.every(checkLength);
      }

      if (typeof obj === "object" && obj !== null) {
        return Object.values(obj).every(checkLength);
      }

      return true;
    };

    if (req.body && !checkLength(req.body)) {
      res.status(400).json({
        error: "Bad Request",
        message: `Input too long. Maximum length is ${maxLength} characters.`,
      });
      return;
    }

    next();
  };
}

/**
 * 安全头部中间件
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // 设置安全相关的HTTP头部
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'");

  next();
}

/**
 * 组合所有安全中间件
 */
export const securityMiddleware: RequestHandler[] = [
  validateContentType,
  preventNoSqlInjection,
  preventXSS,
  createRateLimiter(100, 15 * 60 * 1000), // 15分钟内最多100次请求
  validateInputLength(),
  securityHeaders,
];
