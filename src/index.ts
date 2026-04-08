/**
 * Seedance 2.0 视频生成 — 文本版入口文件
 * resultType 为 FieldType.Text，生成的视频链接以文本形式存放在表格中
 * 用户可复制链接到浏览器中观看视频
 *
 * 核心改进：所有飞书附件先下载转 base64 再传给 API
 * 解决飞书内部 URL 无法被火山引擎 API 访问的问题
 */
import { basekit, FieldType, field, FieldComponent, FieldCode } from '@lark-opdev/block-basekit-server-api';
const { t } = field;

import { MODEL_OPTIONS, RESOLUTION_OPTIONS, RATIO_OPTIONS, DURATION_OPTIONS, WATERMARK_OPTIONS, GENERATE_AUDIO_OPTIONS } from './constants';
import { FormItemParams } from './types';
import { debugLog } from './utils/logger';
import { createSafeFetch } from './utils/fetch';
import { pollTask } from './utils/poll';
import { validateParams, createVideoTask } from './api/createTask';

// 域名白名单：火山引擎 API 域名 + 飞书内部附件下载域名
basekit.addDomainList(['ark.cn-beijing.volces.com', 'internal-api-drive-stream.feishu.cn']);

basekit.addField({
  i18n: {
    messages: {
      'zh-CN': {
        'field_name': 'Seedance 视频生成',
        'field_desc': '调用 Seedance 2.0 API 生成视频，视频链接存放在此列',
        'api_key_label': 'API Key',
        'api_key_placeholder': '请输入火山引擎 API Key',
        'mode_label': '生成模式',
        'model_label': '模型',
        'prompt_label': '文本提示词',
        'prompt_placeholder': '描述你想要生成的视频内容',
        'image_label': '参考图片列（图生视频/全能参考需选择）',
        'image_placeholder': '选择表格中的附件列',
        'video_label': '参考视频列（视频参考/全能参考需选择）',
        'video_placeholder': '选择表格中的附件列',
        'resolution_label': '分辨率',
        'ratio_label': '宽高比',
        'duration_label': '视频时长',
        'watermark_label': '水印',
        'generate_audio_label': '生成音频',
        'seed_label': '种子值',
        'mode_text2video': '文生视频',
        'mode_image2video_first': '图生视频（首帧）',
        'mode_image2video_ref': '图生视频（参考图）',
        'mode_video2video': '视频参考',
        'mode_multimodal': '全能参考',
      },
      'en-US': {
        'field_name': 'Seedance Video Gen',
        'field_desc': 'Generate video via Seedance 2.0 API, video link saved in this column',
        'api_key_label': 'API Key',
        'api_key_placeholder': 'Enter Volcengine API Key',
        'mode_label': 'Mode',
        'model_label': 'Model',
        'prompt_label': 'Text Prompt',
        'prompt_placeholder': 'Describe the video you want to generate',
        'image_label': 'Image Column (for I2V/Multimodal)',
        'image_placeholder': 'Select attachment column',
        'video_label': 'Video Column (for V2V/Multimodal)',
        'video_placeholder': 'Select attachment column',
        'resolution_label': 'Resolution',
        'ratio_label': 'Aspect Ratio',
        'duration_label': 'Duration',
        'watermark_label': 'Watermark',
        'generate_audio_label': 'Generate Audio',
        'seed_label': 'Seed',
        'mode_text2video': 'Text to Video',
        'mode_image2video_first': 'Image to Video (First Frame)',
        'mode_image2video_ref': 'Image to Video (Reference)',
        'mode_video2video': 'Video Reference',
        'mode_multimodal': 'Multimodal Reference',
      },
    },
  },
  formItems: [
    {
      key: 'apiKey',
      label: t('api_key_label'),
      component: FieldComponent.Input,
      props: { placeholder: t('api_key_placeholder') },
      validator: { required: true },
    },
    {
      key: 'mode',
      label: t('mode_label'),
      component: FieldComponent.SingleSelect,
      props: {
        options: [
          { label: t('mode_text2video'), value: 'text2video' },
          { label: t('mode_image2video_first'), value: 'image2video_first' },
          { label: t('mode_image2video_ref'), value: 'image2video_ref' },
          { label: t('mode_video2video'), value: 'video2video' },
          { label: t('mode_multimodal'), value: 'multimodal' },
        ],
      },
      validator: { required: true },
    },
    {
      key: 'model',
      label: t('model_label'),
      component: FieldComponent.SingleSelect,
      props: { options: MODEL_OPTIONS.map(o => ({ label: o.label, value: o.value })) },
      validator: { required: true },
    },
    {
      key: 'prompt',
      label: t('prompt_label'),
      component: FieldComponent.Input,
      props: { placeholder: t('prompt_placeholder') },
      validator: { required: true },
    },
    {
      key: 'imageField',
      label: t('image_label'),
      component: FieldComponent.FieldSelect,
      props: { supportType: [FieldType.Attachment] },
      validator: { required: false },
    },
    {
      key: 'videoField',
      label: t('video_label'),
      component: FieldComponent.FieldSelect,
      props: { supportType: [FieldType.Attachment] },
      validator: { required: false },
    },
    {
      key: 'resolution',
      label: t('resolution_label'),
      component: FieldComponent.SingleSelect,
      props: { options: RESOLUTION_OPTIONS.map(o => ({ label: o.label, value: o.value })) },
      validator: { required: false },
    },
    {
      key: 'ratio',
      label: t('ratio_label'),
      component: FieldComponent.SingleSelect,
      props: { options: RATIO_OPTIONS.map(o => ({ label: o.label, value: o.value })) },
      validator: { required: false },
    },
    {
      key: 'duration',
      label: t('duration_label'),
      component: FieldComponent.SingleSelect,
      props: { options: DURATION_OPTIONS.map(o => ({ label: o.label, value: o.value })) },
      validator: { required: false },
    },
    {
      key: 'watermark',
      label: t('watermark_label'),
      component: FieldComponent.SingleSelect,
      props: { options: WATERMARK_OPTIONS.map(o => ({ label: o.label, value: o.value })) },
      validator: { required: false },
    },
    {
      key: 'generateAudio',
      label: t('generate_audio_label'),
      component: FieldComponent.SingleSelect,
      props: { options: GENERATE_AUDIO_OPTIONS.map(o => ({ label: o.label, value: o.value })) },
      validator: { required: false },
    },
    {
      key: 'seed',
      label: t('seed_label'),
      component: FieldComponent.Input,
      props: { placeholder: '-1（随机）' },
      validator: { required: false },
    },
  ],
  // 文本类型输出：视频链接以文本形式存放在表格中
  resultType: {
    type: FieldType.Text,
  },
  execute: async (params: { [key: string]: any }, context: any) => {
    const formItemParams = params as unknown as FormItemParams;
    /** 日志工具 */
    const log = (arg: any, showContext = false) => debugLog(arg, context, showContext);
    log('=====start=====url-v5-base64', true);

    /**
     * 返回空结果（Text 类型返回 null 表示无数据）
     */
    const emptyResult = { code: FieldCode.Success, data: null };

    // ====== 付费包检测 ======
    // 飞书平台通过 context 传入付费相关信息：
    // - context.isNeedPayPack: 是否需要购买付费包
    // - context.hasQuota: 用户是否有剩余额度
    // 当 isNeedPayPack=true 且 hasQuota=false 时，提示用户购买
    const isNeedPayPack = context?.isNeedPayPack === true;
    const hasQuota = context?.hasQuota === true;

    if (isNeedPayPack && !hasQuota) {
      log({ payPackRequired: true, isNeedPayPack, hasQuota });
      return { code: FieldCode.Success, data: '\u26a0\ufe0f \u8bf7\u5148\u8d2d\u4e70\u4f1a\u5458\u5305\u540e\u518d\u4f7f\u7528\u3002\u5728\u5b57\u6bb5\u914d\u7f6e\u4e2d\u70b9\u51fb\u201c\u5347\u7ea7\u4f1a\u5458\u201d\u5373\u53ef\u89e3\u9501\u66f4\u591a\u751f\u6210\u6b21\u6570\u548c\u9ad8\u7ea7\u6a21\u578b\u3002' };
    }

    /** 安全 fetch（用于调用火山引擎 API） */
    const safeFetch = createSafeFetch(context, log);

    /** 原始 fetch（用于下载飞书附件） */
    const rawFetch = context.fetch;

    try {
      // ====== 标准化飞书 SingleSelect 返回值 ======
      const normalizeSelect = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object' && val.value) return String(val.value);
        return String(val);
      };

      formItemParams.mode = normalizeSelect(formItemParams.mode) as FormItemParams['mode'];
      formItemParams.model = normalizeSelect(formItemParams.model);
      formItemParams.resolution = normalizeSelect(formItemParams.resolution);
      formItemParams.ratio = normalizeSelect(formItemParams.ratio);
      formItemParams.duration = normalizeSelect(formItemParams.duration);
      formItemParams.watermark = normalizeSelect(formItemParams.watermark);
      formItemParams.generateAudio = normalizeSelect(formItemParams.generateAudio);

      // 打印标准化后的 params
      const rawPrompt = formItemParams.prompt;
      const imagesCount = Array.isArray(formItemParams.imageField) ? formItemParams.imageField.length : 0;
      const videosCount = Array.isArray(formItemParams.videoField) ? formItemParams.videoField.length : 0;
      log({ '===标准化后params': { mode: formItemParams.mode, model: formItemParams.model, resolution: formItemParams.resolution, ratio: formItemParams.ratio, duration: formItemParams.duration, watermark: formItemParams.watermark, generateAudio: formItemParams.generateAudio, imagesCount, videosCount } });

      // 提取 prompt 的实际文本值
      let promptText = '';
      if (typeof rawPrompt === 'string') {
        promptText = rawPrompt;
      } else if (Array.isArray(rawPrompt)) {
        promptText = (rawPrompt as any[]).map((item: any) => {
          if (typeof item === 'string') return item;
          if (item?.text) return item.text;
          if (item?.value) return item.value;
          if (item?.link) return item.link;
          return JSON.stringify(item);
        }).join(' ');
      } else if (rawPrompt && typeof rawPrompt === 'object') {
        const obj = rawPrompt as any;
        promptText = obj.text || obj.value || obj.link || JSON.stringify(rawPrompt);
      }

      log({ '===提取的promptText': promptText.slice(0, 200) });

      // 空内容检查
      if (!promptText.trim()) {
        log({ skip: true, reason: 'prompt为空，跳过执行' });
        return emptyResult;
      }

      formItemParams.prompt = promptText;

      // 参数校验
      const validationError = validateParams(formItemParams);
      if (validationError) {
        log({ validationError, skip: true });
        return emptyResult;
      }

      // 创建视频生成任务（传入 rawFetch 用于下载飞书附件转 base64）
      const { taskId, error: createError } = await createVideoTask(formItemParams, safeFetch, rawFetch, log);
      if (createError || !taskId) {
        log({ createError, taskId });
        // 将错误信息作为结果返回，方便用户排查
        const errorMsg = createError || '未知错误';
        return { code: FieldCode.Success, data: `❌ 生成失败: ${errorMsg}` };
      }

      log({ taskId, msg: '任务创建成功，开始轮询' });

      // 轮询等待结果
      const result = await pollTask(taskId, formItemParams.apiKey, safeFetch, log);

      if (!result) {
        log({ timeout: true, taskId });
        return { code: FieldCode.Success, data: `⏱️ 轮询超时: 任务 ${taskId} 在规定时间内未完成，请稍后在火山引擎控制台查看` };
      }

      if (result.status === 'succeeded') {
        const videoUrl = result.content?.video_url || '';
        log({ succeeded: true, videoUrl: videoUrl.slice(0, 200) });
        return { code: FieldCode.Success, data: videoUrl };
      }

      // 任务失败
      const failReason = result.error?.message || result.error || result.status;
      log({ taskFailed: true, status: result.status, error: result.error });
      return { code: FieldCode.Success, data: `❌ 任务失败 [${result.status}]: ${typeof failReason === 'string' ? failReason : JSON.stringify(failReason)}` };
    } catch (e) {
      log({ '===999 异常错误': String(e), stack: (e as Error)?.stack?.slice(0, 500) });
      return emptyResult;
    }
  },
});

export default basekit;
