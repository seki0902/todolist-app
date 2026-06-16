/** 返回本地日期字符串 'YYYY-MM-DD'。
 *  禁止使用 toISOString()——它是 UTC，跨时区会差一天。 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
