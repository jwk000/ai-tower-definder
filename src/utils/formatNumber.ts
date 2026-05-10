// ============================================================
// formatNumber — 显示用浮点数格式化
//
// 规范：所有显示用的浮点数精度最多保留2位小数
// 用法：formatNumber(5.9999999) → "6"
//       formatNumber(5.9999999, 2) → "6"
//       formatNumber(3.14159) → "3.14"
//       formatNumber(3.1) → "3.1"（不会输出3.10）
// ============================================================

/**
 * 格式化数字用于显示，保留最多 `maxDecimals` 位小数。
 * 自动去除多余的尾随零。
 *
 * @param value - 要格式化的数字
 * @param maxDecimals - 最大小数位数（默认 2）
 * @returns 格式化后的字符串
 *
 * @example
 * formatNumber(5.9999999)    // "6"
 * formatNumber(5.9999999, 2) // "6"
 * formatNumber(3.14159)      // "3.14"
 * formatNumber(3.1)          // "3.1"
 * formatNumber(10)           // "10"
 */
export function formatNumber(value: number, maxDecimals: number = 2): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(maxDecimals);
  // 移除尾随零（保留至少一位小数时的小数点）
  return parseFloat(fixed).toString();
}
