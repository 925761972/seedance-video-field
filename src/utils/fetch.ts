/**
 * HTTP 请求配置接口
 * 兼容飞书 FaaS 环境 context.fetch 的请求参数
 */
export interface FetchInit {
  /** HTTP 方法 */
  method?: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: string;
}

/**
 * 安全的 fetch 封装
 * 基于 context.fetch，自动处理日志记录和错误捕获
 * 注意：context.fetch 返回的不是标准 Response，需先 .text() 再 JSON.parse()
 * @param context - 飞书字段捷径的上下文对象，提供 context.fetch 方法
 * @param debugLog - 日志函数，用于记录请求和响应信息
 * @returns safeFetch 函数，用于发起安全的 HTTP 请求
 */
export function createSafeFetch(context: any, debugLog: (arg: any, showContext?: boolean) => void) {
  /**
   * 安全的 fetch 请求函数
   * @param url - 请求的 URL
   * @param init - 请求配置（method, headers, body 等）
   * @param authId - 可选的认证 ID
   * @returns 解析后的 JSON 响应，如果请求失败返回 { code: -1, error } 格式
   */
  return async function safeFetch<T = any>(url: string, init: FetchInit, authId?: string): Promise<T | { code: number; error: any; [p: string]: any }> {
    try {
      const res = await context.fetch(url, init, authId);
      const resText = await res.text();
      debugLog({
        [`===fetch res: ${url}`]: { url, init, authId, resText: resText.slice(0, 4000) }
      });
      return JSON.parse(resText);
    } catch (e) {
      debugLog({ [`===fetch error: ${url}`]: { url, init, authId, error: e } });
      return { code: -1, error: e };
    }
  };
}
