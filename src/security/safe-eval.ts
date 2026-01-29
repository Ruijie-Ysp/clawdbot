/**
 * 安全的代码评估工具
 * 提供比eval更安全的替代方案
 */

/**
 * 安全地评估JavaScript代码
 * @param code 要评估的代码
 * @param context 执行上下文（可选）
 * @returns 评估结果
 */
export function safeEval(code: string, context: Record<string, unknown> = {}): unknown {
  if (!isSafeJavaScript(code)) {
    throw new Error("Unsafe JavaScript code detected");
  }

  try {
    // 创建安全的沙箱环境
    const sandbox = createSafeSandbox(context);

    // 使用Function构造函数而不是eval
    const fn = new Function(
      "sandbox",
      `with (sandbox) {
        "use strict";
        return (${code});
      }`,
    );

    return fn(sandbox);
  } catch (error) {
    throw new Error(`Evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 检查JavaScript代码是否安全
 * @param code 要检查的代码
 * @returns 是否安全
 */
export function isSafeJavaScript(code: string): boolean {
  // 检查代码长度
  if (code.length > 5000) {
    return false;
  }

  // 移除字符串内容以避免误报
  const sanitized = removeStringLiterals(code);

  // 检查危险模式
  const dangerousPatterns = [
    // 禁止的全局对象
    /\b(window|document|localStorage|sessionStorage|indexedDB)\b/gi,
    /\b(XMLHttpRequest|fetch|WebSocket)\b/gi,
    /\b(import|require|eval|Function)\s*\(/gi,
    /\b(setTimeout|setInterval|setImmediate)\s*\(/gi,
    // 禁止的语句
    /\bwith\s*\(/gi,
    /\bdelete\s+\w+/gi,
    // 命令注入尝试
    /`.*\$\(.*\)/gi,
    /`.*\$\{.*\}/gi,
    // 注释绕过
    /\/\*[\s\S]*?\*\//g,
    /\/\/.*$/gm,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      return false;
    }
  }

  // 检查括号平衡
  if (!areBracketsBalanced(sanitized)) {
    return false;
  }

  return true;
}

/**
 * 移除字符串字面量
 * @param code 源代码
 * @returns 移除字符串后的代码
 */
function removeStringLiterals(code: string): string {
  // 移除双引号字符串
  let result = code.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""');
  // 移除单引号字符串
  result = result.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");
  // 移除模板字符串
  result = result.replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, "``");
  return result;
}

/**
 * 检查括号是否平衡
 * @param code 代码
 * @returns 括号是否平衡
 */
function areBracketsBalanced(code: string): boolean {
  const brackets = code.replace(/[^{}()[\]]/g, "");
  const stack: string[] = [];

  for (const char of brackets) {
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
    } else {
      const last = stack.pop();
      if (
        (char === ")" && last !== "(") ||
        (char === "]" && last !== "[") ||
        (char === "}" && last !== "{")
      ) {
        return false;
      }
    }
  }

  return stack.length === 0;
}

/**
 * 创建安全的沙箱环境
 * @param context 用户提供的上下文
 * @returns 安全的沙箱对象
 */
function createSafeSandbox(context: Record<string, unknown>): Record<string, unknown> {
  // 基本的安全全局对象
  const safeGlobals = {
    // 数学函数
    Math: {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      random: Math.random,
      round: Math.round,
      sqrt: Math.sqrt,
    },
    // 字符串函数
    String: String,
    Number: Number,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    JSON: JSON,
    // 日期
    Date: Date,
    // 正则表达式
    RegExp: RegExp,
  };

  // 合并用户上下文
  return {
    ...safeGlobals,
    ...context,
  };
}

/**
 * 安全地解析JSON
 * @param json JSON字符串
 * @returns 解析后的对象
 */
export function safeParseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * 验证文件路径是否安全
 * @param filePath 文件路径
 * @param allowedBase 允许的基础路径
 * @returns 是否安全
 */
export function isSafeFilePath(filePath: string, allowedBase: string): boolean {
  const resolved = require("path").resolve(filePath);
  const baseResolved = require("path").resolve(allowedBase);

  // 检查路径是否在允许的基础路径内
  return resolved.startsWith(baseResolved);
}
