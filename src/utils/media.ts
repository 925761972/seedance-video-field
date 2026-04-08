/**
 * 清理 URL 两端可能存在的反引号、引号、空格等字符
 * 飞书 FieldSelect 传入的附件 URL 可能被 CLI 日志包裹反引号
 * @param url - 原始 URL 字符串
 * @returns 清理后的 URL
 */
function cleanUrl(url: string): string {
  return url.replace(/^[`'"\s]+|[`'"\s]+$/g, '');
}

/**
 * 根据文件名或 MIME 类型推断文件格式（用于 base64 data URI）
 * @param mimeType - MIME 类型字符串，如 'image/png'、'video/mp4'
 * @param fileName - 文件名，如 'photo.jpg'、'clip.mp4'
 * @returns 小写的文件格式，如 'png'、'jpeg'、'mp4'
 */
function inferFormat(mimeType: string, fileName: string): string {
  // 优先从 MIME 类型提取
  if (mimeType) {
    const match = mimeType.match(/\/(jpeg|png|webp|bmp|tiff|gif|mp4|mov|avi|mkv|webm|flv|wmv|mpeg|mp3|wav|aac|ogg)$/i);
    if (match) return match[1].toLowerCase();
  }
  // 从文件扩展名提取
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    // 特殊映射
    if (ext === 'jpg') return 'jpeg';
    if (ext) return ext;
  }
  // 默认
  return 'jpeg';
}

/**
 * 根据文件类型判断媒体类别（image / video / audio）
 * @param mimeType - MIME 类型
 * @param fileName - 文件名
 * @returns 媒体类别字符串
 */
function inferMediaCategory(mimeType: string, fileName: string): 'image' | 'video' | 'audio' {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
  }
  if (fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'mpeg'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  }
  return 'image'; // 默认
}

/**
 * 下载飞书附件并转为 base64 data URI
 * 使用 context.fetch 下载附件二进制数据，然后编码为 base64 字符串
 * 这样可以解决飞书内部 URL 无法被外部 API 访问的问题
 * @param tmpUrl - 飞书附件的临时下载 URL（tmp_url）
 * @param mimeType - 文件 MIME 类型
 * @param fileName - 文件名
 * @param rawFetch - 原始 fetch 函数（context.fetch）
 * @returns base64 data URI 字符串，如 'data:image/png;base64,iVBOR...'
 * @throws 下载或编码失败时抛出错误
 */
export async function downloadAndEncodeBase64(
  tmpUrl: string,
  mimeType: string,
  fileName: string,
  rawFetch: (url: string, init?: any, authId?: string) => Promise<any>
): Promise<string> {
  const url = cleanUrl(tmpUrl);
  if (!url || !url.startsWith('http')) {
    throw new Error(`无效的附件 URL: ${url}`);
  }

  // 下载附件二进制数据
  const response = await rawFetch(url, { method: 'GET' });
  // 兼容性检查：context.fetch 可能不是标准 Response，同时检查 ok 和 status
  const statusCode = response?.status;
  const isOk = response?.ok !== false && (!statusCode || statusCode < 400);
  if (!response || !isOk) {
    throw new Error(`下载附件失败: HTTP ${statusCode || '无响应'}, URL: ${url.slice(0, 100)}`);
  }

  // 将响应转为二进制数据
  // 优先使用 .buffer()（node-fetch v2 特有），回退到 .arrayBuffer()
  let buffer: Buffer;
  if (typeof response.buffer === 'function') {
    buffer = await response.buffer();
  } else if (typeof response.arrayBuffer === 'function') {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else if (typeof response.text === 'function') {
    // 最保守的回退方案：通过文本获取二进制
    const text = await response.text();
    buffer = Buffer.from(text, 'binary');
  } else {
    throw new Error('context.fetch 返回的 response 不支持 buffer/arrayBuffer/text 方法');
  }

  // 转为 base64
  const base64 = buffer.toString('base64');

  // 推断格式和媒体类别
  const format = inferFormat(mimeType, fileName);
  const category = inferMediaCategory(mimeType, fileName);

  // 构造 data URI
  return `data:${category}/${format};base64,${base64}`;
}

/**
 * 批量下载飞书附件并转为 base64 data URI 数组
 * @param attachments - 附件数组，每项包含 tmp_url / url、type (MIME)、name
 * @param rawFetch - 原始 fetch 函数（context.fetch）
 * @param maxCount - 最多处理几个附件
 * @param debugLog - 可选的日志函数
 * @returns base64 data URI 字符串数组
 */
export async function batchDownloadAndEncode(
  attachments: any[],
  rawFetch: (url: string, init?: any, authId?: string) => Promise<any>,
  maxCount: number,
  debugLog?: (arg: any) => void
): Promise<string[]> {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  const results: string[] = [];
  const items = attachments.slice(0, maxCount);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = cleanUrl(item.tmp_url || item.url || '');
    const mimeType = item.type || item.mimeType || '';
    const fileName = item.name || '';

    try {
      const logKey1 = `===下载附件 ${i + 1}/${items.length}`;
      debugLog?.({ [logKey1]: { fileName, mimeType, urlLength: url.length } });
      const base64Uri = await downloadAndEncodeBase64(url, mimeType, fileName, rawFetch);
      const logKey2 = `===附件 ${i + 1} 编码完成`;
      debugLog?.({ [logKey2]: { fileName, base64Length: base64Uri.length } });
      results.push(base64Uri);
    } catch (e) {
      const logKey3 = `===附件 ${i + 1} 下载失败`;
      debugLog?.({ [logKey3]: { fileName, error: String(e) } });
      // 单个附件失败不影响其他附件
    }
  }

  return results;
}

/**
 * 从飞书附件字段值中提取图片附件信息
 * 返回附件对象数组（包含 tmp_url、type、name 等），而不是 URL 字符串
 * @param attachmentValue - 附件字段的值
 * @returns 图片附件对象数组
 */
export function extractImageAttachments(attachmentValue: any): any[] {
  if (!attachmentValue) return [];

  if (Array.isArray(attachmentValue)) {
    return attachmentValue.filter((item: any) => {
      const fileType = item.type || item.mimeType || '';
      if (fileType.startsWith('image/')) return true;
      const name = (item.name || '').toLowerCase();
      return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
    });
  }

  return [];
}

/**
 * 从飞书附件字段值中提取视频附件信息
 * 返回附件对象数组（包含 tmp_url、type、name 等），而不是 URL 字符串
 * @param attachmentValue - 附件字段的值
 * @returns 视频附件对象数组
 */
export function extractVideoAttachments(attachmentValue: any): any[] {
  if (!attachmentValue) return [];

  if (Array.isArray(attachmentValue)) {
    return attachmentValue.filter((item: any) => {
      const fileType = item.type || item.mimeType || '';
      if (fileType.startsWith('video/')) return true;
      const name = (item.name || '').toLowerCase();
      return /\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i.test(name);
    });
  }

  return [];
}

/**
 * 从飞书附件字段值中提取图片 URL（兼容旧逻辑，用于非 base64 场景）
 * 支持飞书附件字段（数组格式）和文本字段（URL 字符串）
 * @param attachmentValue - 附件字段的值
 * @returns 图片 URL 数组
 */
export function extractImageUrls(attachmentValue: any): string[] {
  if (!attachmentValue) return [];

  // 文本字段：用户直接填入图片 URL
  if (typeof attachmentValue === 'string') {
    const cleaned = cleanUrl(attachmentValue);
    return cleaned.startsWith('http') ? [cleaned] : [];
  }

  // 飞书附件字段（数组格式）
  if (Array.isArray(attachmentValue)) {
    return attachmentValue
      .filter((item: any) => {
        const fileType = item.type || item.mimeType || '';
        if (fileType.startsWith('image/')) return true;
        const name = (item.name || '').toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
      })
      .map((item: any) => cleanUrl(item.tmp_url || item.url || ''))
      .filter((url: string) => url.length > 0 && url.startsWith('http'));
  }

  return [];
}

/**
 * 从飞书附件字段值中提取视频 URL（兼容旧逻辑，用于非 base64 场景）
 * 支持飞书附件字段（数组格式）和文本字段（URL 字符串）
 * @param attachmentValue - 附件字段的值
 * @returns 视频 URL 数组
 */
export function extractVideoUrls(attachmentValue: any): string[] {
  if (!attachmentValue) return [];

  // 文本字段：用户直接填入视频 URL
  if (typeof attachmentValue === 'string') {
    const cleaned = cleanUrl(attachmentValue);
    return cleaned.startsWith('http') ? [cleaned] : [];
  }

  // 飞书附件字段（数组格式）
  if (Array.isArray(attachmentValue)) {
    return attachmentValue
      .filter((item: any) => {
        const fileType = item.type || item.mimeType || '';
        if (fileType.startsWith('video/')) return true;
        const name = (item.name || '').toLowerCase();
        return /\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i.test(name);
      })
      .map((item: any) => cleanUrl(item.tmp_url || item.url || ''))
      .filter((url: string) => url.length > 0 && url.startsWith('http'));
  }

  return [];
}

/** litterbox.catbox.moe 临时文件托管服务配置 */
const LITTERBOX_UPLOAD_URL = 'https://litterbox.catbox.moe/resources/internals/api.php';
/** 文件有效期：72小时（足够视频生成+轮询完成） */
const LITTERBOX_EXPIRY = '72h';

/** Seedance r2v 模式的视频像素数上限（width × height ≤ 927408） */
const MAX_VIDEO_PIXELS = 927408;
/**
 * 根据像素上限计算目标缩放尺寸
 * 保持原始宽高比，确保 width × height ≤ MAX_VIDEO_PIXELS
 * @param width - 原始视频宽度
 * @param height - 原始视频高度
 * @returns 缩放后的 { width, height }，若无需缩放则返回原始值
 */
function calculateScaledDimensions(width: number, height: number): { width: number; height: number } {
  const pixels = width * height;
  if (pixels <= MAX_VIDEO_PIXELS) {
    return { width, height };
  }
  // 按面积等比缩放：scale = sqrt(MAX_PIXELS / current_pixels)
  const scale = Math.sqrt(MAX_VIDEO_PIXELS / pixels);
  let newWidth = Math.floor(width * scale);
  let newHeight = Math.floor(height * scale);
  // 确保是偶数（ffmpeg 编码要求）
  newWidth = newWidth % 2 === 0 ? newWidth : newWidth - 1;
  newHeight = newHeight % 2 === 0 ? newHeight : newHeight - 1;
  return { width: newWidth, height: newHeight };
}

/**
 * 使用 ffprobe 获取视频的宽度和高度
 * @param inputPath - 视频文件路径
 * @returns { width, height } 视频尺寸
 */
function getVideoDimensions(inputPath: string): { width: number; height: number } {
  const { execSync } = require('child_process');
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${inputPath}"`,
      { encoding: 'utf-8', timeout: 30000 }
    ).trim();
    const [w, h] = output.split('x').map(Number);
    if (!w || !h || isNaN(w) || isNaN(h)) {
      throw new Error(`ffprobe 输出格式异常: ${output}`);
    }
    return { width: w, height: h };
  } catch (e: any) {
    throw new Error(`获取视频尺寸失败: ${e.message}`);
  }
}

/**
 * 使用 ffmpeg 压缩视频，使像素数不超过 MAX_VIDEO_PIXELS
 * 如果视频已经满足要求则直接返回原始路径
 * @param inputPath - 输入视频文件路径
 * @param debugLog - 可选的日志函数
 * @returns 压缩后的视频文件路径（可能是新文件，也可能是原始文件）
 */
function compressVideoIfNeeded(inputPath: string, debugLog?: (arg: any) => void): string {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  // 获取原始尺寸
  const original = getVideoDimensions(inputPath);
  const originalPixels = original.width * original.height;
  debugLog?.({ '===视频原始尺寸': { width: original.width, height: original.height, pixels: originalPixels } });

  // 检查是否需要压缩
  if (originalPixels <= MAX_VIDEO_PIXELS) {
    debugLog?.({ '===视频无需压缩': { pixels: originalPixels, maxPixels: MAX_VIDEO_PIXELS } });
    return inputPath;
  }

  // 计算目标尺寸
  const target = calculateScaledDimensions(original.width, original.height);
  debugLog?.({ '===视频需要压缩': { original: `${original.width}x${original.height}`, target: `${target.width}x${target.height}`, targetPixels: target.width * target.height } });

  // 生成输出文件路径
  const outputPath = inputPath.replace(/(\.[^.]+)$/, '_compressed$1');

  try {
    // 使用 ffmpeg 压缩：
    // -vf scale: 按目标尺寸缩放，保持宽高比
    // -c:v libx264: H.264 编码
    // -preset ultrafast: 最快编码速度（视频仅作参考，不需要高质量）
    // -crf 30: 较高压缩率（参考视频不需要高画质，减小上传体积和耗时）
    // -c:a aac -b:a 64k: 音频低码率（参考视频音频不重要）
    // -movflags +faststart: 优化流式播放
    // -an: 如果原始视频无音频轨则自动跳过音频处理
    const cmd = [
      'ffmpeg', '-y', '-i', `"${inputPath}"`,
      '-vf', `scale=${target.width}:${target.height}`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
      '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      `"${outputPath}"`
    ].join(' ');

    debugLog?.({ '===开始压缩视频': { cmd: cmd.slice(0, 200) } });
    execSync(cmd, { encoding: 'utf-8', timeout: 120000 });

    // 验证输出文件
    if (!fs.existsSync(outputPath)) {
      throw new Error('压缩后文件不存在');
    }

    const compressed = getVideoDimensions(outputPath);
    const compressedPixels = compressed.width * compressed.height;
    const outputSize = fs.statSync(outputPath).size;
    debugLog?.({
      '===视频压缩完成': {
        compressed: `${compressed.width}x${compressed.height}`,
        pixels: compressedPixels,
        sizeMB: (outputSize / 1024 / 1024).toFixed(2),
      }
    });

    // 删除原始文件，返回压缩后的路径
    try { fs.unlinkSync(inputPath); } catch (_) {}
    return outputPath;
  } catch (e: any) {
    // 压缩失败时清理可能存在的输出文件，返回原始路径让流程继续
    debugLog?.({ '===视频压缩失败，使用原始文件': { error: e.message } });
    try { if (fs.existsSync(inputPath.replace(/(\.[^.]+)$/, '_compressed$1'))) fs.unlinkSync(inputPath.replace(/(\.[^.]+)$/, '_compressed$1')); } catch (_) {}
    return inputPath;
  }
}

/**
 * 下载飞书视频附件并上传到临时文件托管服务，获取公网可访问的 URL
 * Seedance API 要求 video_url 必须是公网可访问的 web URL，不支持 base64
 * 流程：下载飞书附件 → 上传到 litterbox.catbox.moe → 返回公网 URL
 * @param tmpUrl - 飞书附件的临时下载 URL
 * @param fileName - 文件名（用于构造上传文件名）
 * @param rawFetch - 原始 fetch 函数（context.fetch，用于下载飞书附件）
 * @param debugLog - 可选的日志函数
 * @returns 公网可访问的视频 URL
 * @throws 下载或上传失败时抛出错误
 */
export async function downloadAndUploadVideo(
  tmpUrl: string,
  fileName: string,
  rawFetch: (url: string, init?: any, authId?: string) => Promise<any>,
  debugLog?: (arg: any) => void
): Promise<string> {
  const url = cleanUrl(tmpUrl);
  if (!url || !url.startsWith('http')) {
    throw new Error(`无效的视频附件 URL: ${url}`);
  }

  // 第一步：下载飞书附件二进制数据
  debugLog?.({ '===下载视频附件': { fileName, urlLength: url.length } });
  const response = await rawFetch(url, { method: 'GET' });
  const statusCode = response?.status;
  const isOk = response?.ok !== false && (!statusCode || statusCode < 400);
  if (!response || !isOk) {
    throw new Error(`下载视频附件失败: HTTP ${statusCode || '无响应'}`);
  }

  let buffer: Buffer;
  if (typeof response.buffer === 'function') {
    buffer = await response.buffer();
  } else if (typeof response.arrayBuffer === 'function') {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else if (typeof response.text === 'function') {
    const text = await response.text();
    buffer = Buffer.from(text, 'binary');
  } else {
    throw new Error('context.fetch 返回的 response 不支持 buffer/arrayBuffer/text 方法');
  }

  debugLog?.({ '===视频下载完成': { fileName, sizeBytes: buffer.length, sizeMB: (buffer.length / 1024 / 1024).toFixed(2) } });

  // 提取文件扩展名
  const fileExt = (fileName.split('.').pop() || 'mp4').toLowerCase();

  // 第二步：将视频写入临时文件，检查并压缩像素数
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const tmpDir = os.tmpdir();
  const tmpInputPath = path.join(tmpDir, `seedance_video_${Date.now()}.${fileExt}`);

  fs.writeFileSync(tmpInputPath, buffer);
  // 释放原始 buffer 内存
  buffer = Buffer.alloc(0);

  // 压缩视频（如果像素数超限）
  const finalVideoPath = compressVideoIfNeeded(tmpInputPath, debugLog);

  // 读取（可能压缩后的）视频数据
  const finalBuffer = fs.readFileSync(finalVideoPath);
  const finalSizeMB = (finalBuffer.length / 1024 / 1024).toFixed(2);
  debugLog?.({ '===视频准备上传': { sizeMB: finalSizeMB, path: finalVideoPath } });

  // 第三步：上传到 litterbox.catbox.moe
  // 使用 multipart/form-data 格式上传
  const boundary = `----FormBoundary${Date.now()}`;
  const safeFileName = `video_${Date.now()}.${fileExt}`;

  // 构造 multipart body
  const parts: Buffer[] = [];
  // reqtype 字段
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`));
  // time 字段（有效期）
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="time"\r\n\r\n${LITTERBOX_EXPIRY}\r\n`));
  // fileToUpload 字段
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${safeFileName}"\r\nContent-Type: video/mp4\r\n\r\n`));
  parts.push(finalBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const multipartBody = Buffer.concat(parts);

  // 释放 finalBuffer 内存
  // (multipartBody 已包含数据)

  debugLog?.({ '===上传视频到临时托管': { fileName: safeFileName, sizeMB: finalSizeMB } });

  // 使用 Node.js 原生 https 模块上传（因为 context.fetch 可能不支持 multipart）
  const uploadResult = await new Promise<string>((resolve, reject) => {
    const https = require('https');
    const urlObj = new URL(LITTERBOX_UPLOAD_URL);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length,
      },
      timeout: 120000, // 2分钟超时（大文件上传可能较慢）
    };

    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 返回的 URL 可能包含换行符，需要清理
          const publicUrl = data.trim();
          if (publicUrl.startsWith('http')) {
            resolve(publicUrl);
          } else {
            reject(new Error(`上传返回了非 URL 内容: ${data.slice(0, 200)}`));
          }
        } else {
          reject(new Error(`上传失败: HTTP ${res.statusCode}, ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err: any) => {
      reject(new Error(`上传请求失败: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('上传超时（120秒）'));
    });

    req.write(multipartBody);
    req.end();
  });

  // 清理临时文件
  try { fs.unlinkSync(finalVideoPath); } catch (_) {}
  try { if (finalVideoPath !== tmpInputPath) fs.unlinkSync(tmpInputPath); } catch (_) {}

  debugLog?.({ '===视频上传成功': { publicUrl: uploadResult } });
  return uploadResult;
}

/**
 * 批量下载飞书视频附件并上传到临时文件托管服务
 * @param attachments - 视频附件数组
 * @param rawFetch - 原始 fetch 函数（context.fetch）
 * @param maxCount - 最多处理几个附件
 * @param debugLog - 可选的日志函数
 * @returns 公网可访问的视频 URL 数组
 */
export async function batchDownloadAndUploadVideos(
  attachments: any[],
  rawFetch: (url: string, init?: any, authId?: string) => Promise<any>,
  maxCount: number,
  debugLog?: (arg: any) => void
): Promise<string[]> {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  const results: string[] = [];
  const items = attachments.slice(0, maxCount);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = cleanUrl(item.tmp_url || item.url || '');
    const fileName = item.name || `video_${i}.mp4`;

    try {
      const logKey = `===处理视频 ${i + 1}/${items.length}`;
      debugLog?.({ [logKey]: { fileName } });
      const publicUrl = await downloadAndUploadVideo(url, fileName, rawFetch, debugLog);
      results.push(publicUrl);
    } catch (e) {
      const logKey = `===视频 ${i + 1} 处理失败`;
      debugLog?.({ [logKey]: { fileName, error: String(e) } });
    }
  }

  return results;
}
