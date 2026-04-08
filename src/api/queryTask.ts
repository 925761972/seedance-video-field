import { SEEDANCE_QUERY_TASK_URL_PREFIX } from '../constants';
import { SeedanceQueryResponse } from '../types';
import { FetchInit } from '../utils/fetch';

/**
 * SafeFetch 函数类型签名
 */
type SafeFetchFn = <T = any>(url: string, init: FetchInit, authId?: string) => Promise<T | { code: number; error: any; [p: string]: any }>;

/**
 * 查询视频生成任务状态（单次查询）
 * 调用火山引擎 Seedance API 查询指定任务的状态和结果
 * @param taskId - 火山引擎任务 ID
 * @param apiKey - 火山引擎 API Key
 * @param safeFetch - 安全的 fetch 函数
 * @returns 任务查询结果，如果请求失败返回 null
 */
export async function queryVideoTask(
  taskId: string,
  apiKey: string,
  safeFetch: SafeFetchFn
): Promise<SeedanceQueryResponse | null> {
  const res = await safeFetch<SeedanceQueryResponse>(
    `${SEEDANCE_QUERY_TASK_URL_PREFIX}${taskId}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }
  );

  if (res && typeof res === 'object' && 'code' in res && res.code === -1) {
    return null;
  }

  return res as SeedanceQueryResponse;
}
