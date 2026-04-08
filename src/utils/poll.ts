import { POLL_INTERVAL_MS, MAX_POLL_COUNT, TERMINAL_STATUSES, SEEDANCE_QUERY_TASK_URL_PREFIX } from '../constants';
import { SeedanceQueryResponse } from '../types';
import { FetchInit } from './fetch';

/**
 * SafeFetch 函数类型签名
 */
type SafeFetchFn = <T = any>(url: string, init: FetchInit, authId?: string) => Promise<T | { code: number; error: any; [p: string]: any }>;

/** 轮询连续失败最大次数，超过则提前终止 */
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * 延迟函数
 * @param ms - 延迟的毫秒数
 * @returns Promise，在指定时间后 resolve
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 根据轮询进度计算动态间隔（渐进式退避）
 * 前30次：10秒固定间隔
 * 30~60次：15秒间隔
 * 60次后：20秒间隔
 * @param index - 当前轮询索引（从0开始）
 * @returns 延迟毫秒数
 */
function getDynamicInterval(index: number): number {
  if (index < 30) return POLL_INTERVAL_MS;
  if (index < 60) return 15000;
  return 20000;
}

/**
 * 轮询查询视频生成任务状态
 * 采用渐进式间隔策略，减少无效轮询频率
 * 连续查询失败超过 MAX_CONSECUTIVE_FAILURES 次时提前终止
 * @param taskId - 火山引擎任务 ID
 * @param apiKey - 火山引擎 API Key
 * @param safeFetch - 安全的 fetch 函数
 * @param debugLog - 日志函数
 * @returns 任务查询结果，如果超时或连续失败返回 null
 */
export async function pollTask(
  taskId: string,
  apiKey: string,
  safeFetch: SafeFetchFn,
  debugLog: (arg: any, showContext?: boolean) => void
): Promise<SeedanceQueryResponse | null> {
  let consecutiveFailures = 0;

  for (let i = 0; i < MAX_POLL_COUNT; i++) {
    await sleep(getDynamicInterval(i));

    const queryRes = await safeFetch<SeedanceQueryResponse>(
      `${SEEDANCE_QUERY_TASK_URL_PREFIX}${taskId}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );

    // 检查 fetch 是否失败
    if (queryRes && typeof queryRes === 'object' && 'code' in queryRes && queryRes.code === -1) {
      consecutiveFailures++;
      debugLog({ pollError: '查询任务状态失败', taskId, index: i, consecutiveFailures });
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        debugLog({ pollAbort: '连续查询失败次数过多，提前终止轮询', taskId, consecutiveFailures });
        return null;
      }
      continue;
    }

    // 查询成功，重置连续失败计数
    consecutiveFailures = 0;

    const status = (queryRes as SeedanceQueryResponse)?.status;
    debugLog({ pollIndex: i, status, taskId });

    if (status === 'succeeded') {
      return queryRes as SeedanceQueryResponse;
    }

    if (TERMINAL_STATUSES.includes(status as any)) {
      return queryRes as SeedanceQueryResponse;
    }

    // queued / running → 继续轮询
  }

  return null; // 超时
}
