// server.js
// DoutuAPI-Neon-GIF-Generator 的 Node.js 移植版（对应原项目 main.py）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { generateGifBytes, getFontList } from './gif-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 8000;

// 静态资源（原项目前端，API 完全兼容，无需改动）
app.use('/static', express.static(path.join(__dirname, 'static')));

// 兜底：原版 index.html 里是相对路径 style.css / script.js（在根路径下解析为 404，
// 导致样式和 script.js 加载失败、预览 GIF 不出图——原版 Python 项目同样有此问题）。
// 这里把根路径别名也接上，即使浏览器缓存了旧 HTML 也能正常工作
app.get('/style.css', (_req, res) => res.sendFile(path.join(__dirname, 'static', 'style.css')));
app.get('/script.js', (_req, res) => res.sendFile(path.join(__dirname, 'static', 'script.js')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// 字体列表：GET /fonts → { fonts: [{ index, name }] }，index 从 1 开始（供前端下拉与 font=N 参数使用）
app.get('/fonts', (_req, res) => {
  res.json({ fonts: getFontList() });
});

// 生成 GIF，参数与原项目 FastAPI 接口一致；额外支持 mode=auto|static|scroll、font=N
app.get('/generate', (req, res) => {
  const { text, frame_count, delay, color, width_pixels, theme, wrap, mode, font, font_size } = req.query;

  // 校验（对齐原接口 Query 约束）
  if (text === undefined || String(text).length === 0) {
    return res.status(400).json({ detail: 'text is required (min_length=1)' });
  }
  const frameCount = frame_count === undefined ? 20 : Number(frame_count);
  const delayMs = delay === undefined ? 100 : Number(delay);
  // 默认宽度 240px（微信表情 GIF 常用尺寸）
  const width = width_pixels === undefined ? 240 : Number(width_pixels);
  const themeVal = theme === undefined ? 'transparent' : String(theme);
  const autoWrap = wrap === 'true' || wrap === '1' || wrap === true;
  const layoutMode = mode === undefined ? 'auto' : String(mode);
  // font：缺省 = 0（随机）；正整数 = 字体序号（1-based）
  const fontIndex = font === undefined || font === '' ? 0 : Number(font);
  // font_size：字体大小（像素），默认 86px（原版字号）
  const fontSize = font_size === undefined || font_size === '' ? 86 : Number(font_size);
  const fontCount = getFontList().length;

  if (!Number.isInteger(frameCount) || frameCount < 1) {
    return res.status(400).json({ detail: 'frame_count must be an integer >= 1' });
  }
  if (!Number.isInteger(delayMs) || delayMs < 20) {
    return res.status(400).json({ detail: 'delay must be an integer >= 20' });
  }
  if (!Number.isInteger(width) || width < 1 || width > 5000) {
    return res.status(400).json({ detail: 'width_pixels must be an integer in [1, 5000]' });
  }
  if (!['transparent', 'dark', 'light'].includes(themeVal)) {
    return res.status(400).json({ detail: 'theme must be one of: transparent, dark, light' });
  }
  if (!['auto', 'static', 'scroll'].includes(layoutMode)) {
    return res.status(400).json({ detail: 'mode must be one of: auto, static, scroll' });
  }
  if (!Number.isInteger(fontIndex) || fontIndex < 0) {
    return res.status(400).json({ detail: 'font must be an integer >= 0 (0 = random)' });
  }
  if (fontIndex > fontCount) {
    return res.status(400).json({ detail: `font must be in [0, ${fontCount}], got ${fontIndex}` });
  }
  if (!Number.isInteger(fontSize) || fontSize < 10 || fontSize > 500) {
    return res.status(400).json({ detail: 'font_size must be an integer in [10, 500]' });
  }

  try {
    const gifBuffer = generateGifBytes({
      text: String(text),
      frameCount,
      delay: delayMs,
      textColorParam: color === undefined ? null : String(color),
      widthPixels: width,
      theme: themeVal,
      autoWrap,
      layoutMode,
      fontIndex,
      fontSizePx: fontSize,
    });

    if (!gifBuffer) {
      return res.status(400).json({ detail: 'Failed.' });
    }
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store');
    res.send(gifBuffer);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ detail: 'Server Error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Neon GIF Generator (Node.js) running at http://127.0.0.1:${PORT}`);
});
