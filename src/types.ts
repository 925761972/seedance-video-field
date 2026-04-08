/**
 * 表单参数接口
 * 对应飞书字段捷径插件的表单配置项
 */
export interface FormItemParams {
  /** 火山引擎 API Key */
  apiKey: string;
  /** 生成模式：text2video / image2video_first / image2video_ref / video2video / multimodal */
  mode: string;
  /** 模型标识 */
  model: string;
  /** 提示词内容 */
  prompt: string;
  /** 参考图片附件数组（FieldSelect 选择附件列后，飞书直接传入该列的附件数据） */
  imageField: any[];
  /** 参考视频附件数组（FieldSelect 选择附件列后，飞书直接传入该列的附件数据） */
  videoField: any[];
  /** 分辨率：480p / 720p / 1080p */
  resolution: string;
  /** 宽高比：16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / adaptive */
  ratio: string;
  /** 时长（秒）：2~15（取决于模型） */
  duration: string;
  /** 水印：'true' / 'false' */
  watermark: string;
  /** 生成音频：'true' / 'false'（仅 Seedance 2.0 / 1.5 Pro 支持） */
  generateAudio: string;
  /** 随机种子，-1 表示随机 */
  seed: string;
}

/**
 * Seedance 创建任务响应
 */
export interface SeedanceCreateResponse {
  /** 任务 ID */
  id: string;
}

/**
 * Seedance 查询任务响应
 * 来源：https://www.volcengine.com/docs/82379/1521309
 */
export interface SeedanceQueryResponse {
  /** 任务 ID */
  id: string;
  /** 使用的模型 */
  model: string;
  /** 任务状态：queued / running / succeeded / failed / expired / cancelled */
  status: string;
  /** 错误信息 */
  error: any;
  /** 创建时间 */
  created_at: number;
  /** 更新时间 */
  updated_at: number;
  /** 生成内容 */
  content: {
    /** 生成的视频 URL，mp4 格式，24 小时后清理 */
    video_url: string;
    /** 最后一帧图片 URL，24 小时后清理（需设置 return_last_frame: true） */
    last_frame_url?: string;
  };
  /** 随机种子 */
  seed: number;
  /** 分辨率 */
  resolution: string;
  /** 宽高比 */
  ratio: string;
  /** 时长（秒） */
  duration: number;
  /** 帧数 */
  frames?: number;
  /** 帧率 */
  framespersecond: number;
  /** 是否生成音频（仅 Seedance 1.5 pro 返回） */
  generate_audio?: boolean;
  /** 是否为 Draft 视频（仅 Seedance 1.5 pro 返回） */
  draft?: boolean;
  /** Draft 视频任务 ID */
  draft_task_id?: string;
  /** token 使用量 */
  usage: {
    /** 完成 token 数 */
    completion_tokens: number;
    /** 总 token 数 */
    total_tokens: number;
  };
  /** 服务层级 */
  service_tier: string;
  /** 任务超时阈值（秒） */
  execution_expires_after: number;
}

/**
 * Seedance 请求体中的 content 项
 * 根据 Seedance 2.0 API 文档，支持 text / image_url / video_url / audio_url 四种类型
 * 来源：https://www.volcengine.com/docs/82379/2298881
 */
export interface SeedanceContentItem {
  /** 内容类型：text / image_url / video_url / audio_url */
  type: 'text' | 'image_url' | 'video_url' | 'audio_url';
  /** 文本内容（type 为 text 时使用） */
  text?: string;
  /** 图片 URL 对象（type 为 image_url 时使用） */
  image_url?: { url: string };
  /** 视频 URL 对象（type 为 video_url 时使用） */
  video_url?: { url: string };
  /** 音频 URL 对象（type 为 audio_url 时使用，Seedance 2.0 新增） */
  audio_url?: { url: string };
  /** 角色标识：first_frame / last_frame / reference_image / reference_video / reference_audio */
  role?: string;
}
