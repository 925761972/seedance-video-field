/**
 * Seedance 2.0 视频生成 — 状态版入口文件
 * resultType 为 FieldType.Object，返回完整的任务状态和参数信息
 */
import { basekit, FieldType, field, FieldComponent, FieldCode } from '@lark-opdev/block-basekit-server-api';
const { t } = field;

import { MODEL_OPTIONS, RESOLUTION_OPTIONS, RATIO_OPTIONS, DURATION_OPTIONS, WATERMARK_OPTIONS, MAX_POLL_COUNT, POLL_INTERVAL_MS } from './constants';
import { FormItemParams } from './types';
import { debugLog } from './utils/logger';
import { createSafeFetch } from './utils/fetch';
import { pollTask } from './utils/poll';
import { validateParams, createVideoTask } from './api/createTask';

// 域名白名单：火山引擎 API 域名
basekit.addDomainList(['ark.cn-beijing.volces.com', 'internal-api-drive-stream.feishu.cn']);

basekit.addField({
  i18n: {
    messages: {
      'zh-CN': {
        'field_name': 'Seedance 生成状态',
        'field_desc': '显示 Seedance 2.0 视频生成的任务状态和参数信息',
        'api_key_label': 'API Key',
        'api_key_placeholder': '请输入火山引擎 API Key',
        'mode_label': '生成模式',
        'model_label': '模型',
        'prompt_label': '文本提示词',
        'prompt_placeholder': '描述你想要生成的视频内容',
        'image_label': '图片字段名（图生视频/全能参考需填）',
        'image_placeholder': '填写附件字段名，如：图片',
        'video_label': '视频字段名（视频参考/全能参考需填）',
        'video_placeholder': '填写附件字段名，如：视频',
        'resolution_label': '分辨率',
        'ratio_label': '宽高比',
        'duration_label': '视频时长',
        'watermark_label': '水印',
        'seed_label': '种子值',
        'status_label': '状态',
        'task_id_label': '任务ID',
        'model_used_label': '使用模型',
        'resolution_result_label': '分辨率',
        'ratio_result_label': '宽高比',
        'duration_result_label': '时长(秒)',
        'fps_label': '帧率',
        'seed_result_label': '种子值',
        'tokens_label': 'Token消耗',
        'error_label': '错误信息',
        'mode_text2video': '文生视频',
        'mode_image2video_first': '图生视频（首帧）',
        'mode_image2video_ref': '图生视频（参考图）',
        'mode_video2video': '视频参考',
        'mode_multimodal': '全能参考',
      },
      'en-US': {
        'field_name': 'Seedance Status',
        'field_desc': 'Show Seedance 2.0 video generation task status and parameters',
        'api_key_label': 'API Key',
        'api_key_placeholder': 'Enter Volcengine API Key',
        'mode_label': 'Mode',
        'model_label': 'Model',
        'prompt_label': 'Text Prompt',
        'prompt_placeholder': 'Describe the video you want to generate',
        'image_label': 'Image Field Name (for I2V/Multimodal)',
        'image_placeholder': 'Attachment field name, e.g.: Image',
        'video_label': 'Video Field Name (for V2V/Multimodal)',
        'video_placeholder': 'Attachment field name, e.g.: Video',
        'resolution_label': 'Resolution',
        'ratio_label': 'Aspect Ratio',
        'duration_label': 'Duration',
        'watermark_label': 'Watermark',
        'seed_label': 'Seed',
        'status_label': 'Status',
        'task_id_label': 'Task ID',
        'model_used_label': 'Model Used',
        'resolution_result_label': 'Resolution',
        'ratio_result_label': 'Aspect Ratio',
        'duration_result_label': 'Duration(s)',
        'fps_label': 'FPS',
        'seed_result_label': 'Seed',
        'tokens_label': 'Token Usage',
        'error_label': 'Error',
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
      component: FieldComponent.Input,
      props: { placeholder: t('image_placeholder') },
      validator: { required: false },
    },
    {
      key: 'videoField',
      label: t('video_label'),
      component: FieldComponent.Input,
      props: { placeholder: t('video_placeholder') },
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
      key: 'seed',
      label: t('seed_label'),
      component: FieldComponent.Input,
      props: { placeholder: '-1（随机）' },
      validator: { required: false },
    },
  ],
  // 对象类型输出：返回完整的任务状态和参数信息
  resultType: {
    type: FieldType.Object,
    extra: {
      icon: {
        light: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/eqgeh7upeubqnulog/chatbot.svg',
      },
      properties: [
        {
          key: 'id',
          isGroupByKey: true,
          type: FieldType.Text,
          label: 'id',
          hidden: true,
        },
        {
          key: 'status',
          type: FieldType.Text,
          label: t('status_label'),
          primary: true,
        },
        {
          key: 'task_id',
          type: FieldType.Text,
          label: t('task_id_label'),
        },
        {
          key: 'model',
          type: FieldType.Text,
          label: t('model_used_label'),
        },
        {
          key: 'resolution',
          type: FieldType.Text,
          label: t('resolution_result_label'),
        },
        {
          key: 'ratio',
          type: FieldType.Text,
          label: t('ratio_result_label'),
        },
        {
          key: 'duration',
          type: FieldType.Number,
          label: t('duration_result_label'),
        },
        {
          key: 'fps',
          type: FieldType.Number,
          label: t('fps_label'),
        },
        {
          key: 'seed',
          type: FieldType.Number,
          label: t('seed_result_label'),
        },
        {
          key: 'total_tokens',
          type: FieldType.Number,
          label: t('tokens_label'),
        },
        {
          key: 'error_message',
          type: FieldType.Text,
          label: t('error_label'),
        },
      ],
    },
  },
  execute: async (params: { [key: string]: any }, context: any) => {
    /** 保存原始 params 引用（用于从字段名获取附件数据） */
    const rawParams = params as Record<string, any>;
    const formItemParams = params as unknown as FormItemParams;
    /** 日志工具 */
    const log = (arg: any, showContext = false) => debugLog(arg, context, showContext);
    log('=====start=====status-v1', true);

    /** 安全 fetch */
    const safeFetch = createSafeFetch(context, log);
    const rawFetch = context.fetch;

    /**
     * 构建默认错误结果对象
     */
    const buildErrorResult = (status: string, taskId: string, errorMsg: string) => ({
      id: `${Math.random()}`,
      status,
      task_id: taskId,
      model: formItemParams.model || '',
      resolution: '',
      ratio: '',
      duration: 0,
      fps: 24,
      seed: -1,
      total_tokens: 0,
      error_message: errorMsg,
    });

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

      // 提取 prompt 的实际文本值
      let promptText = '';
      const rawPrompt = formItemParams.prompt;
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

      // 空内容检查
      if (!promptText.trim()) {
        log({ skip: true, reason: 'prompt为空，跳过执行' });
        return {
          code: FieldCode.Success,
          data: buildErrorResult('error', '', '提示词为空'),
        };
      }

      formItemParams.prompt = promptText;

      // 参数校验
      const validationError = validateParams(formItemParams);
      if (validationError) {
        log({ validationError });
        return {
          code: FieldCode.Success,
          data: buildErrorResult('error', '', validationError),
        };
      }

      // 创建视频生成任务
      const { taskId, error: createError } = await createVideoTask(formItemParams, safeFetch, rawFetch, log);
      if (createError || !taskId) {
        log({ createError, taskId });
        return {
          code: FieldCode.Success,
          data: buildErrorResult('error', '', createError || '创建任务失败'),
        };
      }

      log({ taskId, msg: '任务创建成功，开始轮询' });

      // 轮询等待结果
      const result = await pollTask(taskId, formItemParams.apiKey, safeFetch, log);

      if (!result) {
        // 超时
        const timeoutMsg = `生成超时（超过${MAX_POLL_COUNT * POLL_INTERVAL_MS / 1000}秒），任务ID: ${taskId}`;
        log({ timeout: true, taskId });
        return {
          code: FieldCode.Success,
          data: buildErrorResult('timeout', taskId, timeoutMsg),
        };
      }

      if (result.status === 'succeeded') {
        const videoUrl = result.content?.video_url || '';
        log({ succeeded: true, videoUrl: videoUrl.slice(0, 200) });
        return {
          code: FieldCode.Success,
          data: {
            id: `${Math.random()}`,
            status: 'succeeded',
            task_id: taskId,
            model: result.model || formItemParams.model,
            resolution: result.resolution || '',
            ratio: result.ratio || '',
            duration: result.duration || (result.frames ? Math.round((result.frames || 0) / 24) : 0),
            fps: result.framespersecond || 24,
            seed: result.seed ?? -1,
            total_tokens: result.usage?.total_tokens || 0,
            error_message: '',
          },
        };
      }

      // 任务失败 / 过期 / 取消
      const errorMsg = result.error?.message || `任务${result.status}`;
      log({ taskFailed: true, status: result.status, error: result.error });
      return {
        code: FieldCode.Success,
        data: buildErrorResult(result.status || 'failed', taskId, errorMsg),
      };
    } catch (e) {
      log({ '===999 异常错误': String(e) });
      return { code: FieldCode.Error };
    }
  },
});

export default basekit;
