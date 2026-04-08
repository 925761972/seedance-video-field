/** 火山引擎 Seedance API 基础配置 */
export const SEEDANCE_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
export const SEEDANCE_CREATE_TASK_URL = `${SEEDANCE_API_BASE}/contents/generations/tasks`;
export const SEEDANCE_QUERY_TASK_URL_PREFIX = `${SEEDANCE_API_BASE}/contents/generations/tasks/`;

/** 轮询配置：10秒间隔，最多120次（总超时约20分钟，覆盖视频生成所需时间） */
export const POLL_INTERVAL_MS = 10000;
export const MAX_POLL_COUNT = 120;

/**
 * 支持的模型列表（最新版本 ID）
 * 来源：https://www.volcengine.com/docs/82379/2298881 模型能力表
 */
export const SUPPORTED_MODELS = {
  SEEDANCE_2_0: 'doubao-seedance-2-0-260128',
  SEEDANCE_2_0_FAST: 'doubao-seedance-2-0-fast-260128',
  SEEDANCE_1_5_PRO: 'doubao-seedance-1-5-pro-251215',
  PRO: 'doubao-seedance-1-0-pro-250528',
  PRO_FAST: 'doubao-seedance-1-0-pro-fast-251015',
  LITE_T2V: 'doubao-seedance-1-0-lite-t2v-250428',
  LITE_I2V: 'doubao-seedance-1-0-lite-i2v-250428',
} as const;

/**
 * 模型能力映射：哪些模型支持哪些生成模式
 * 来源：官方模型能力表
 * - Seedance 2.0 / 2.0 fast：文生视频、图生视频-首帧/首尾帧、多模态参考（图片/视频/音频/组合）、编辑视频、延长视频
 * - Seedance 1.5 pro：文生视频、图生视频-首帧/首尾帧、多模态参考、编辑视频、延长视频
 * - Seedance 1.0 pro / pro-fast：文生视频、图生视频-首帧/首尾帧
 * - Seedance 1.0 lite-i2v：文生视频、图生视频-首帧/首尾帧/参考图
 * - Seedance 1.0 lite-t2v：文生视频
 */
export const MODEL_CAPABILITIES: Record<string, string[]> = {
  [SUPPORTED_MODELS.SEEDANCE_2_0]: ['text2video', 'image2video_first', 'image2video_ref', 'video2video', 'multimodal'],
  [SUPPORTED_MODELS.SEEDANCE_2_0_FAST]: ['text2video', 'image2video_first', 'image2video_ref', 'video2video', 'multimodal'],
  [SUPPORTED_MODELS.SEEDANCE_1_5_PRO]: ['text2video', 'image2video_first', 'image2video_ref', 'video2video', 'multimodal'],
  [SUPPORTED_MODELS.PRO]: ['text2video', 'image2video_first'],
  [SUPPORTED_MODELS.PRO_FAST]: ['text2video', 'image2video_first'],
  [SUPPORTED_MODELS.LITE_T2V]: ['text2video'],
  [SUPPORTED_MODELS.LITE_I2V]: ['text2video', 'image2video_first', 'image2video_ref'],
};

/**
 * 模型支持的时长范围（秒）
 * 来源：官方模型能力表
 * - Seedance 2.0 / 2.0 fast：4~15 秒
 * - Seedance 1.5 pro：4~12 秒
 * - Seedance 1.0 pro / pro-fast / lite-i2v / lite-t2v：2~12 秒
 */
export const MODEL_DURATION_RANGE: Record<string, [number, number]> = {
  [SUPPORTED_MODELS.SEEDANCE_2_0]: [4, 15],
  [SUPPORTED_MODELS.SEEDANCE_2_0_FAST]: [4, 15],
  [SUPPORTED_MODELS.SEEDANCE_1_5_PRO]: [4, 12],
  [SUPPORTED_MODELS.PRO]: [2, 12],
  [SUPPORTED_MODELS.PRO_FAST]: [2, 12],
  [SUPPORTED_MODELS.LITE_T2V]: [2, 12],
  [SUPPORTED_MODELS.LITE_I2V]: [2, 12],
};

/**
 * 模型是否支持 generate_audio（有声视频）
 * 来源：官方文档 — Seedance 2.0 / 1.5 pro 支持生成有声视频
 */
export const MODEL_SUPPORTS_AUDIO: Record<string, boolean> = {
  [SUPPORTED_MODELS.SEEDANCE_2_0]: true,
  [SUPPORTED_MODELS.SEEDANCE_2_0_FAST]: true,
  [SUPPORTED_MODELS.SEEDANCE_1_5_PRO]: true,
  [SUPPORTED_MODELS.PRO]: false,
  [SUPPORTED_MODELS.PRO_FAST]: false,
  [SUPPORTED_MODELS.LITE_T2V]: false,
  [SUPPORTED_MODELS.LITE_I2V]: false,
};

/** 任务终态 */
export const TERMINAL_STATUSES = ['succeeded', 'failed', 'expired', 'cancelled'] as const;

/** 生成模式列表 */
export const GENERATION_MODES = [
  { label: '文生视频', value: 'text2video' },
  { label: '图生视频（首帧）', value: 'image2video_first' },
  { label: '图生视频（参考图）', value: 'image2video_ref' },
  { label: '视频参考', value: 'video2video' },
  { label: '全能参考', value: 'multimodal' },
] as const;

/** 模型选项列表 */
export const MODEL_OPTIONS = [
  { label: 'Seedance 2.0', value: SUPPORTED_MODELS.SEEDANCE_2_0 },
  { label: 'Seedance 2.0 Fast', value: SUPPORTED_MODELS.SEEDANCE_2_0_FAST },
  { label: 'Seedance 1.5 Pro', value: SUPPORTED_MODELS.SEEDANCE_1_5_PRO },
  { label: 'Seedance 1.0 Pro', value: SUPPORTED_MODELS.PRO },
  { label: 'Seedance 1.0 Pro Fast', value: SUPPORTED_MODELS.PRO_FAST },
  { label: 'Seedance 1.0 Lite 文生视频', value: SUPPORTED_MODELS.LITE_T2V },
  { label: 'Seedance 1.0 Lite 图生视频', value: SUPPORTED_MODELS.LITE_I2V },
] as const;

/** 分辨率选项 */
export const RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p（仅 1.x 系列）', value: '1080p' },
] as const;

/** 宽高比选项 */
export const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '1:1', value: '1:1' },
  { label: '3:4', value: '3:4' },
  { label: '9:16', value: '9:16' },
  { label: '21:9', value: '21:9' },
  { label: 'adaptive（跟随图片）', value: 'adaptive' },
] as const;

/** 时长选项（2~15 秒，具体可用范围取决于所选模型） */
export const DURATION_OPTIONS = [
  { label: '2秒', value: '2' },
  { label: '3秒', value: '3' },
  { label: '4秒', value: '4' },
  { label: '5秒（默认）', value: '5' },
  { label: '6秒', value: '6' },
  { label: '7秒', value: '7' },
  { label: '8秒', value: '8' },
  { label: '9秒', value: '9' },
  { label: '10秒', value: '10' },
  { label: '11秒', value: '11' },
  { label: '12秒', value: '12' },
  { label: '13秒（仅 2.0）', value: '13' },
  { label: '14秒（仅 2.0）', value: '14' },
  { label: '15秒（仅 2.0）', value: '15' },
] as const;

/** 水印选项 */
export const WATERMARK_OPTIONS = [
  { label: '无水印', value: 'false' },
  { label: '有水印', value: 'true' },
] as const;

/** 生成音频选项 */
export const GENERATE_AUDIO_OPTIONS = [
  { label: '不生成音频', value: 'false' },
  { label: '生成音频（仅 2.0 / 1.5 Pro）', value: 'true' },
] as const;
