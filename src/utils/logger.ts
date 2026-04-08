/**
 * 日志工具函数
 * 封装 debugLog，用于在飞书字段捷径 FaaS 环境中记录日志
 * @param arg - 要记录的日志内容
 * @param context - 飞书字段捷径的上下文对象
 * @param showContext - 是否同时显示 formItemParams 和 context
 */
export function debugLog(arg: any, context: any, showContext = false): void {
  if (!showContext) {
    console.log(JSON.stringify({ arg, logID: context?.logID }), '\n');
    return;
  }
  console.log(JSON.stringify({ formItemParams: context?.formItemParams, context, arg }), '\n');
}
