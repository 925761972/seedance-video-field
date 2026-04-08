import { SEEDANCE_CREATE_TASK_URL, MODEL_CAPABILITIES, MODEL_DURATION_RANGE, MODEL_SUPPORTS_AUDIO } from '../constants';
import { FormItemParams, SeedanceContentItem, SeedanceCreateResponse } from '../types';
import { extractImageAttachments, extractVideoAttachments, batchDownloadAndEncode, batchDownloadAndUploadVideos } from '../utils/media';
import { FetchInit } from '../utils/fetch';

/**
 * SafeFetch 函数类型签名
 */
type SafeFetchFn = <T = any>(url: string, init: FetchInit, authId?: string) => Promise<T | { code: number; error: any; [p: string]: any }>;

/** 任务创建最大重试次数 */
const MAX_CREATE_RETRIES = 2;
/** 重试间隔（毫秒） */
const RETRY_DELAY_MS = 3000;

/**
 * 合并多个附件字段的附件数据
 * 将 imageField / imageField2 / imageField3 等多个字段的数据合并为一个数组
 * @param params - 表单参数对象
 * @param fieldKeys - 要合并的字段名数组
 * @returns 合并后的附件数组
 */
function mergeAttachmentFields(params: FormItemParams, fieldKeys: string[]): any[] {
  const merged: any[] = [];
  for (const key of fieldKeys) {
    const fieldData = (params as any)[key];
    if (Array.isArray(fieldData) && fieldData.length > 0) {
      merged.push(...fieldData);
    }
  }
  return merged;
}

/** 图片相关的所有字段名 */
const IMAGE_FIELD_KEYS = ['imageField', 'imageField2', 'imageField3'];
/** 视频相关的所有字段名 */
const VIDEO_FIELD_KEYS = ['videoField', 'videoField2', 'videoField3'];

/**
 * 构建 content 数组（根据生成模式组装 text + image_url / video_url）
 * 核心改进：所有飞书附件先下载转 base64，再传给 API
 * 这样解决了飞书内部 URL 无法被火山引擎 API 访问的问题
 *
 * 注意：duration / ratio / watermark / generate_audio 不再拼在 text 中，
 * 而是作为请求体顶层参数传入（与官方 SDK 示例一致）
 * @param params - 表单参数对象
 * @param rawFetch - 原始 fetch 函数（context.fetch），用于下载飞书附件
 * @param debugLog - 日志函数
 * @returns SeedanceContentItem 数组
 */
export async function buildContent(
  params: FormItemParams,
  rawFetch: (url: string, init?: any, authId?: string) => Promise<any>,
  debugLog: (arg: any) => void
): Promise<SeedanceContentItem[]> {
  const content: SeedanceContentItem[] = [];
  const mode = params.mode;

  // 所有模式都需要文本提示词（纯文本，不再拼接 --dur 等参数）
  const textPrompt = (params.prompt as string) || '';
  content.push({ type: 'text', text: textPrompt });

  // ====== text2video 模式：仅文本 ======
  if (mode === 'text2video') {
    return content;
  }

  // ====== image2video_first 模式：首帧图片 ======
  if (mode === 'image2video_first') {
    const allImages = mergeAttachmentFields(params, IMAGE_FIELD_KEYS);
    const imageAttachments = extractImageAttachments(allImages).slice(0, 1);
    if (imageAttachments.length > 0) {
      const base64Uris = await batchDownloadAndEncode(imageAttachments, rawFetch, 1, debugLog);
      if (base64Uris.length > 0) {
        content.push({
          type: 'image_url',
          image_url: { url: base64Uris[0] },
          role: 'first_frame',
        });
      }
    }
    return content;
  }

  // ====== image2video_ref 模式：参考图片（1-4 张） ======
  if (mode === 'image2video_ref') {
    const allImages = mergeAttachmentFields(params, IMAGE_FIELD_KEYS);
    const imageAttachments = extractImageAttachments(allImages).slice(0, 4);
    if (imageAttachments.length > 0) {
      const base64Uris = await batchDownloadAndEncode(imageAttachments, rawFetch, 4, debugLog);
      base64Uris.forEach((uri) => {
        content.push({
          type: 'image_url',
          image_url: { url: uri },
          role: 'reference_image',
        });
      });
    }
    return content;
  }

  // ====== video2video 模式：视频参考 ======
  // 注意：Seedance API 要求 video_url 必须是公网可访问的 web URL，不支持 base64
  // 因此需要下载飞书附件 → 上传到临时文件托管 → 获取公网 URL
  if (mode === 'video2video') {
    const allVideos = mergeAttachmentFields(params, VIDEO_FIELD_KEYS);
    const videoAttachments = extractVideoAttachments(allVideos).slice(0, 3);
    if (videoAttachments.length > 0) {
      const publicUrls = await batchDownloadAndUploadVideos(videoAttachments, rawFetch, 3, debugLog);
      publicUrls.forEach((url) => {
        content.push({
          type: 'video_url',
          video_url: { url },
          role: 'reference_video',
        });
      });
    }
    return content;
  }

  // ====== multimodal 模式：全能参考（文本 + 图片 + 视频） ======
  if (mode === 'multimodal') {
    // 添加图片参考（图片支持 base64）— 合并所有图片列
    const allImages = mergeAttachmentFields(params, IMAGE_FIELD_KEYS);
    const imageAttachments = extractImageAttachments(allImages).slice(0, 9);
    if (imageAttachments.length > 0) {
      const imageBase64Uris = await batchDownloadAndEncode(imageAttachments, rawFetch, 9, debugLog);
      imageBase64Uris.forEach((uri) => {
        content.push({
          type: 'image_url',
          image_url: { url: uri },
          role: 'reference_image',
        });
      });
    }
    // 添加视频参考（视频必须用公网 URL，不支持 base64）— 合并所有视频列
    const allVideos = mergeAttachmentFields(params, VIDEO_FIELD_KEYS);
    const videoAttachments = extractVideoAttachments(allVideos).slice(0, 3);
    if (videoAttachments.length > 0) {
      const videoPublicUrls = await batchDownloadAndUploadVideos(videoAttachments, rawFetch, 3, debugLog);
      videoPublicUrls.forEach((url) => {
        content.push({
          type: 'video_url',
          video_url: { url },
          role: 'reference_video',
        });
      });
    }
    return content;
  }

  return content;
}

/**
 * 构建请求体（content + 顶层参数）
 * duration / ratio / watermark / generate_audio 作为顶层字段传入
 * 与官方 SDK 示例完全一致
 * @param params - 表单参数对象
 * @param content - buildContent 生成的 content 数组
 * @returns 完整的请求体对象
 */
function buildRequestBody(params: FormItemParams, content: SeedanceContentItem[]): Record<string, any> {
  const modelValue = typeof params.model === 'string' ? params.model : (params.model as any)?.value || '';
  const body: Record<string, any> = {
    model: modelValue,
    content,
  };

  // duration：作为顶层参数（官方示例 "duration": 5）
  if (params.duration) {
    body.duration = parseInt(params.duration, 10);
  }

  // ratio：作为顶层参数（官方示例 "ratio": "16:9"）
  if (params.ratio) {
    body.ratio = params.ratio;
  }

  // watermark：作为顶层布尔值（官方示例 "watermark": false）
  if (params.watermark === 'true') {
    body.watermark = true;
  } else if (params.watermark === 'false') {
    body.watermark = false;
  }

  // generate_audio：作为顶层布尔值（官方示例 "generate_audio": true）
  if (params.generateAudio === 'true') {
    body.generate_audio = true;
  } else if (params.generateAudio === 'false') {
    body.generate_audio = false;
  }

  // seed：仅当用户明确指定时才传入（作为顶层参数）
  if (params.seed && params.seed !== '-1') {
    const seedNum = parseInt(params.seed, 10);
    if (!isNaN(seedNum) && seedNum >= -1) {
      body.seed = seedNum;
    }
  }

  return body;
}

/**
 * 校验表单参数
 * @param params - 表单参数对象
 * @returns 错误信息字符串，校验通过返回 null
 */
export function validateParams(params: FormItemParams): string | null {
  if (!params.apiKey) return '请输入火山引擎 API Key';
  if (!params.mode) return '请选择生成模式';
  if (!params.model) return '请选择模型';
  if (!params.prompt) return '请选择提示词字段';

  const modelValue = typeof params.model === 'string' ? params.model : (params.model as any)?.value || '';

  // 校验模式与模型匹配
  const capabilities = MODEL_CAPABILITIES[modelValue];
  if (capabilities && !capabilities.includes(params.mode)) {
    return `所选模型不支持"${params.mode}"模式，请更换模型或模式`;
  }

  // 校验时长范围是否在模型支持范围内
  if (params.duration) {
    const durNum = parseInt(params.duration, 10);
    const range = MODEL_DURATION_RANGE[modelValue];
    if (range && (durNum < range[0] || durNum > range[1])) {
      return `所选模型不支持 ${durNum} 秒时长，支持范围：${range[0]}~${range[1]} 秒`;
    }
  }

  // 图生视频-首帧：需要图片附件
  if (params.mode === 'image2video_first') {
    const allImages = mergeAttachmentFields(params, IMAGE_FIELD_KEYS);
    const imageAttachments = extractImageAttachments(allImages);
    if (imageAttachments.length === 0) return '图生视频（首帧）模式需要所选列中有图片附件';
  }

  // 图生视频-参考图：需要图片附件
  if (params.mode === 'image2video_ref') {
    const allImages = mergeAttachmentFields(params, IMAGE_FIELD_KEYS);
    const imageAttachments = extractImageAttachments(allImages);
    if (imageAttachments.length === 0) return '图生视频（参考图）模式需要所选列中有图片附件';
  }

  // 视频参考：需要视频附件
  if (params.mode === 'video2video') {
    const allVideos = mergeAttachmentFields(params, VIDEO_FIELD_KEYS);
    const videoAttachments = extractVideoAttachments(allVideos);
    if (videoAttachments.length === 0) return '视频参考模式需要所选列中有视频附件';
  }

  // 全能参考：至少有图片或视频
  if (params.mode === 'multimodal') {
    const allImages = mergeAttachmentFields(params, IMAGE_FIELD_KEYS);
    const allVideos = mergeAttachmentFields(params, VIDEO_FIELD_KEYS);
    const hasImages = extractImageAttachments(allImages).length > 0;
    const hasVideos = extractVideoAttachments(allVideos).length > 0;
    if (!hasImages && !hasVideos) {
      return '全能参考模式需要所选列中有图片或视频附件';
    }
  }

  return null;
}

/**
 * 创建视频生成任务（带自动重试）
 * 网络波动或服务端临时错误时自动重试最多 MAX_CREATE_RETRIES 次
 * @param params - 表单参数对象
 * @param safeFetch - 安全的 fetch 函数（用于调用火山引擎 API）
 * @param rawFetch - 原始 fetch 函数（context.fetch，用于下载飞书附件）
 * @param debugLog - 日志函数
 * @returns 包含 taskId 和 error 的结果对象
 */
export async function createVideoTask(
  params: FormItemParams,
  safeFetch: SafeFetchFn,
  rawFetch: (url: string, init?: any, authId?: string) => Promise<any>,
  debugLog: (arg: any) => void
): Promise<{ taskId: string | null; error: string | null }> {
  // 构建 content（异步：需要下载附件转 base64）
  const content = await buildContent(params, rawFetch, debugLog);

  // 构建完整请求体（content + 顶层参数）
  const requestBody = buildRequestBody(params, content);

  // 调试日志：打印请求体（截断 base64 数据避免日志过大）
  const logBody = { ...requestBody, content: content.map((item) => {
    if (item.type === 'image_url' && item.image_url?.url) {
      // 图片可能是 base64，截断显示
      if (item.image_url.url.startsWith('data:')) {
        return { ...item, image_url: { url: item.image_url.url.slice(0, 80) + '...[base64]' } };
      }
    }
    // 视频 URL 是公网 URL，完整显示
    return item;
  })};
  debugLog({ '===请求体 (图片base64+视频公网URL)': logBody });

  // 带重试的任务创建
  let lastError = '';
  for (let attempt = 0; attempt <= MAX_CREATE_RETRIES; attempt++) {
    if (attempt > 0) {
      debugLog({ '===任务创建重试': { attempt, maxRetries: MAX_CREATE_RETRIES, lastError } });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }

    const res = await safeFetch<SeedanceCreateResponse>(
      SEEDANCE_CREATE_TASK_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    // 网络层错误
    if (res && typeof res === 'object' && 'code' in res && res.code === -1) {
      lastError = `网络请求失败: ${JSON.stringify(res.error)}`;
      continue;
    }

    // API 返回了错误响应体（如 InvalidParameter、RateLimit 等）
    if (res && typeof res === 'object' && 'error' in res && !(res as any).id) {
      const apiError = (res as any).error;
      const errorCode = apiError?.code || 'Unknown';
      const errorMsg = apiError?.message || JSON.stringify(apiError);

      // 不可重试的错误（参数错误、认证错误等），直接返回
      const nonRetryableCodes = ['InvalidParameter', 'AuthenticationFailed', 'PermissionDenied', 'NotFound'];
      if (nonRetryableCodes.includes(errorCode)) {
        return { taskId: null, error: `API 错误 [${errorCode}]: ${errorMsg}` };
      }

      // 可重试的错误（限流、服务端内部错误等）
      lastError = `API 错误 [${errorCode}]: ${errorMsg}`;
      continue;
    }

    const taskId = (res as SeedanceCreateResponse)?.id;

    if (!taskId) {
      lastError = `创建任务失败，响应中无 taskId: ${JSON.stringify(res).slice(0, 500)}`;
      continue;
    }

    return { taskId, error: null };
  }

  return { taskId: null, error: `任务创建失败（已重试 ${MAX_CREATE_RETRIES} 次）: ${lastError}` };
}
