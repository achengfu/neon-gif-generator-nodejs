// gif-generator.js
// DoutuAPI-Neon-GIF-Generator 的 Node.js 移植版（对应原项目 gif_generator.py）
// 渲染：@napi-rs/canvas（Skia，免编译原生依赖，支持中文字体）
// 编码：gifenc（纯 JS GIF 编码器）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
// 注意：gifenc 是 CommonJS 包（Node 忽略其 module 字段，走 main），
// 命名导出无法被 cjs-module-lexer 静态识别，必须用默认导入再解构
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { parseColor } from './lib/color-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, 'fonts');

// --- 全局配置（与原项目一致） ---
export const BASE_LINE_HEIGHT = 100;
export const FONT_RATIO = 0.86;

// --- 字体管理：随机从 fonts/ 目录加载一个字体，等价于原项目 get_random_font_from_folder ---
let fontsReady = false;
const fontAliases = [];
const fontNames = []; // 与 fontAliases 一一对应，用于 /fonts 接口和 font=N 数字映射

export function loadFonts() {
  if (fontsReady) return fontAliases;
  let files = [];
  if (fs.existsSync(FONT_DIR)) {
    files = fs
      .readdirSync(FONT_DIR)
      .filter((f) => /\.(ttf|otf|ttc)$/i.test(f))
      .sort() // 按文件名稳定排序，保证 font=N 的数字映射固定
      .map((f) => path.join(FONT_DIR, f));
  }
  // fonts 目录为空时的系统兜底字体（类似原项目 load_font 的 fallback_fonts）
  if (files.length === 0) {
    const fallbacks = [
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      'C:\\Windows\\Fonts\\msyh.ttc',
      '/System/Library/Fonts/PingFang.ttc',
    ];
    for (const f of fallbacks) {
      if (fs.existsSync(f)) {
        files = [f];
        break;
      }
    }
  }
  files.forEach((file, i) => {
    const alias = `neonfont${i}`;
    try {
      GlobalFonts.registerFromPath(file, alias);
      fontAliases.push(alias);
      fontNames.push(path.basename(file));
    } catch {
      // 字体注册失败则跳过
    }
  });
  fontsReady = true;
  return fontAliases;
}

// 字体列表（1-based 索引，供 GET /fonts 与前端下拉使用）
export function getFontList() {
  loadFonts();
  return fontNames.map((name, i) => ({ index: i + 1, name, alias: fontAliases[i] }));
}

// 选取字体：fontIndex 0/缺省 = 随机；N = 按文件名排序后的第 N 个字体（1-based）
function pickFont(fontIndex = 0) {
  const aliases = loadFonts();
  if (aliases.length === 0) return null;
  if (Number.isInteger(fontIndex) && fontIndex > 0 && fontIndex <= aliases.length) {
    return aliases[fontIndex - 1];
  }
  return aliases[Math.floor(Math.random() * aliases.length)];
}

// --- 基础工具 ---
function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function interpolateColor(c1, c2, progress) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * progress),
    Math.round(c1[1] + (c2[1] - c1[1]) * progress),
    Math.round(c1[2] + (c2[2] - c1[2]) * progress),
    255,
  ];
}

const rgba = (c) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;

// 按像素宽度换行（等价于原项目 split_text_by_pixel_width）
function splitTextByPixelWidth(text, fontSpec, maxWidth, measureCtx) {
  measureCtx.font = fontSpec;
  const lines = [];
  let currentLine = '';
  for (const char of text) {
    const testLine = currentLine + char;
    if (measureCtx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        lines.push(char);
        currentLine = '';
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// 静态彩虹渐变底图（等价于 create_rainbow_gradient / 彩虹流动中的逐帧渐变）
function makeRainbowCanvas(width, height, phaseShift = 0) {
  const grad = createCanvas(width, height);
  const gctx = grad.getContext('2d');
  const imgData = gctx.createImageData(width, height);
  const data = imgData.data;
  for (let x = 0; x < width; x++) {
    const hue = ((x / Math.max(width, 1)) + phaseShift) % 1.0;
    const [r, g, b] = hsvToRgb(hue, 1.0, 1.0);
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  gctx.putImageData(imgData, 0, 0);
  return grad;
}

// ==========================================
// 主生成函数（等价于原项目 generate_gif_bytes）
// ==========================================
export function generateGifBytes({
  text,
  frameCount = 20,
  delay = 100,
  textColorParam = null,
  widthPixels = 240,
  theme = 'transparent',
  autoWrap = false,
  layoutMode = 'auto', // 布局模式：'auto'(默认，与原版一致) | 'static'(强制静态) | 'scroll'(强制滚动，仅单行纯色场景生效)
  fontIndex = 0, // 字体索引：0/缺省 = 随机；N = fonts 目录按文件名排序后的第 N 个字体（1-based）
  fontSizePx = 86, // 字体大小（像素），默认 86px 即原版字号；行高随字号等比缩放
}) {
  if (!text || String(text).length === 0) return null;
  let frameCountFinal = frameCount;

  // 1. 确定背景
  let bgColor;
  let defaultText;
  if (theme === 'light') {
    bgColor = [255, 255, 255, 255];
    defaultText = [0, 0, 0];
  } else if (theme === 'dark') {
    bgColor = [0, 0, 0, 255];
    defaultText = [255, 255, 255];
  } else {
    bgColor = [0, 0, 0, 0];
    defaultText = [255, 255, 255];
  }

  // 2. 解析颜色模式（等价于原项目的特效参数解析）
  let mode = 'solid';
  let solidColor = [...defaultText, 255];
  let breathColors = [];
  let effectType = null;

  const colorParam = textColorParam ? String(textColorParam) : '';
  if (colorParam) {
    if (colorParam === 'rainbow') {
      mode = 'rainbow';
    } else if (colorParam === 'rainbow_flow') {
      mode = 'rainbow_flow';
      if (frameCountFinal < 10) frameCountFinal = 20;
    } else if (colorParam === 'wave') {
      effectType = 'wave';
      if (frameCountFinal < 10) frameCountFinal = 20;
    } else if (colorParam === 'bounce') {
      effectType = 'bounce';
      if (frameCountFinal < 10) frameCountFinal = 20;
    } else if (colorParam === 'neon') {
      effectType = 'neon';
      if (frameCountFinal < 10) frameCountFinal = 20;
    } else if (colorParam.startsWith('breathing:')) {
      if (frameCountFinal < 20) frameCountFinal = 20;
      const parts = colorParam.split(':');
      if (parts.length === 3) {
        const c1 = parseColor(parts[1]);
        const c2 = parseColor(parts[2]);
        if (c1 && c2) {
          breathColors = [c1, c2];
          mode = 'breathing';
        }
      }
    } else {
      const c = parseColor(colorParam);
      if (c) solidColor = [...c, 255];
    }
  }

  // 3. 字体与换行处理
  const fontFamily = pickFont(fontIndex);
  const fontSize = Math.round(fontSizePx);
  const fontSpec = fontFamily ? `${fontSize}px ${fontFamily}` : `${fontSize}px sans-serif`;
  // 行高随字号等比缩放：默认 86px → 行高 100（与原版一致）
  const lineHeightScale = fontSize / (BASE_LINE_HEIGHT * FONT_RATIO);
  const lineHeight = Math.round(BASE_LINE_HEIGHT * lineHeightScale);
  const basePadding = effectType === 'bounce' || effectType === 'wave' ? 40 : 0;
  const verticalPadding = Math.round(basePadding * lineHeightScale);

  const measureCtx = createCanvas(1, 1).getContext('2d');

  const inputText = text.split(/\s+/).join(' ');
  let textLines;
  if (autoWrap) {
    const safeWidth = widthPixels - 20;
    textLines = splitTextByPixelWidth(inputText, fontSpec, safeWidth, measureCtx);
  } else {
    textLines = [inputText];
  }
  const totalLines = textLines.length;
  const canvasHeight = totalLines * lineHeight + verticalPadding * 2;

  // --- 绘制辅助函数（闭包持有 fontSpec / autoWrap / verticalPadding / lineHeight，与原项目一致） ---
  function drawTextStandard(ctx, lines, color, offsetX = 0, offsetY = 0) {
    ctx.font = fontSpec;
    ctx.fillStyle = rgba(color);
    ctx.textBaseline = 'middle';
    for (let idx = 0; idx < lines.length; idx++) {
      const lineBaseY = idx * lineHeight + lineHeight / 2 + verticalPadding;
      if (autoWrap) {
        ctx.textAlign = 'center';
        ctx.fillText(lines[idx], widthPixels / 2 + offsetX, lineBaseY + offsetY);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(lines[idx], offsetX, lineBaseY + offsetY);
      }
    }
  }

  function drawTextWave(ctx, lines, color, frameIdx, totalFrames) {
    const amplitude = 10;
    const frequency = 0.5;
    const speed = 2 * Math.PI;
    const phase = (frameIdx / totalFrames) * speed;
    ctx.font = fontSpec;
    ctx.fillStyle = rgba(color);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineBaseY = lineIdx * lineHeight + lineHeight / 2 + verticalPadding;
      const lineWidth = ctx.measureText(line).width;
      const startX = (widthPixels - lineWidth) / 2;
      let currentX = startX;
      for (const char of line) {
        const charWidth = ctx.measureText(char).width;
        const xFactor = (currentX - startX) / 100;
        const yOffset = Math.sin(xFactor * frequency + phase) * amplitude;
        ctx.fillText(char, currentX, lineBaseY + yOffset);
        currentX += charWidth;
      }
    }
  }

  // 彩虹流动：文字遮罩 + 逐帧相位移动的彩虹渐变，用 destination-in 合成（等价于 PIL 的 mask 贴图）
  function drawRainbowFlowLayer(frameIdx, totalFrames) {
    const maskCanvas = createCanvas(widthPixels, canvasHeight);
    const mctx = maskCanvas.getContext('2d');
    mctx.font = fontSpec;
    mctx.fillStyle = '#ffffff';
    mctx.textBaseline = 'middle';
    for (let idx = 0; idx < textLines.length; idx++) {
      const lineBaseY = idx * lineHeight + lineHeight / 2 + verticalPadding;
      if (autoWrap) {
        mctx.textAlign = 'center';
        mctx.fillText(textLines[idx], widthPixels / 2, lineBaseY);
      } else {
        mctx.textAlign = 'left';
        mctx.fillText(textLines[idx], 0, lineBaseY);
      }
    }
    const phaseShift = frameIdx / totalFrames;
    const gradCanvas = makeRainbowCanvas(widthPixels, canvasHeight, phaseShift);
    const gctx = gradCanvas.getContext('2d');
    gctx.globalCompositeOperation = 'destination-in';
    gctx.drawImage(maskCanvas, 0, 0);
    return gradCanvas;
  }

  const images = [];

  // --- 核心生成循环 ---
  let isStaticLayout =
    autoWrap ||
    effectType === 'wave' ||
    effectType === 'bounce' ||
    effectType === 'neon' ||
    mode === 'breathing' ||
    mode === 'rainbow_flow';
  // 修正：非换行 + 纯色 + 无特效 → 滚动布局（与原项目一致）
  if (!autoWrap && mode === 'solid' && !effectType) isStaticLayout = false;
  // layoutMode 覆盖：显式指定静态/滚动（scroll 仅在单行纯色场景生效，否则回退静态）
  if (layoutMode === 'static') {
    isStaticLayout = true;
  } else if (layoutMode === 'scroll') {
    if (!autoWrap && mode === 'solid' && !effectType) isStaticLayout = false;
    else isStaticLayout = true;
  }

  if (isStaticLayout) {
    const loopFrames = frameCountFinal;
    for (let i = 0; i < loopFrames; i++) {
      const canvas = createCanvas(widthPixels, canvasHeight);
      const ctx = canvas.getContext('2d');
      if (bgColor[3] === 255) {
        ctx.fillStyle = rgba(bgColor);
        ctx.fillRect(0, 0, widthPixels, canvasHeight);
      }

      // 1. 计算颜色
      let currentColor = solidColor;
      if (mode === 'breathing') {
        const progress = loopFrames > 1 ? Math.sin((i / (loopFrames - 1)) * Math.PI) : 0;
        currentColor = interpolateColor(breathColors[0], breathColors[1], progress);
      } else if (effectType === 'neon') {
        const [r, g, b] = hsvToRgb(i / loopFrames, 1.0, 1.0);
        currentColor = [r, g, b, 255];
        // 霓虹重影：先画偏移 2px 的暗色阴影（alpha=100，等价于 PIL 的 shadow_color）
        const shadowColor = [Math.round((r * 100) / 255), Math.round((g * 100) / 255), Math.round((b * 100) / 255), 100];
        drawTextStandard(ctx, textLines, shadowColor, 2, 2);
      }

      // 2. 弹跳偏移（取整到整数像素，等价于 PIL 的整数栅格化，
      //    避免 Skia 亚像素光栅化把相邻帧渲染成完全相同的像素而被去重误删）
      let offsetY = 0;
      if (effectType === 'bounce') {
        const progress = (i / loopFrames) * 2 * Math.PI;
        offsetY = Math.round(-Math.abs(Math.sin(progress)) * 20 + 20);
      }

      // 3. 绘制
      if (mode === 'rainbow_flow') {
        const layer = drawRainbowFlowLayer(i, loopFrames);
        ctx.drawImage(layer, 0, 0);
      } else if (effectType === 'wave') {
        drawTextWave(ctx, textLines, currentColor, i, loopFrames);
      } else {
        drawTextStandard(ctx, textLines, currentColor, 0, offsetY);
      }
      images.push(canvas);
    }
  } else {
    // 场景 B: 滚动（等价于原项目 Scrolling 分支）
    const line = textLines[0];
    measureCtx.font = fontSpec;
    const textW = measureCtx.measureText(line).width;
    const startX = widthPixels;
    const totalDistance = widthPixels + textW;
    const scrollFrames = Math.max(frameCountFinal, 2); // 防除零：frameCount=1 时退化为单帧
    const step = totalDistance / (scrollFrames - 1);

    for (let i = 0; i < scrollFrames; i++) {
      const canvas = createCanvas(widthPixels, canvasHeight);
      const ctx = canvas.getContext('2d');
      if (bgColor[3] === 255) {
        ctx.fillStyle = rgba(bgColor);
        ctx.fillRect(0, 0, widthPixels, canvasHeight);
      }
      const currX = startX - step * i;

      if (mode === 'rainbow') {
        // 滚动彩虹：文字遮罩 + 静态彩虹渐变
        const maskCanvas = createCanvas(widthPixels, canvasHeight);
        const mctx = maskCanvas.getContext('2d');
        mctx.font = fontSpec;
        mctx.textBaseline = 'middle';
        mctx.textAlign = 'left';
        mctx.fillStyle = '#ffffff';
        mctx.fillText(line, currX, lineHeight / 2);
        const gradCanvas = makeRainbowCanvas(widthPixels, canvasHeight, 0);
        const gctx = gradCanvas.getContext('2d');
        gctx.globalCompositeOperation = 'destination-in';
        gctx.drawImage(maskCanvas, 0, 0);
        ctx.drawImage(gradCanvas, 0, 0);
      } else {
        ctx.font = fontSpec;
        ctx.fillStyle = rgba(solidColor);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(line, currX, lineHeight / 2);
      }
      images.push(canvas);
    }
  }

  if (images.length === 0) return null;

  // --- GIF 编码（等价于原项目 images[0].save(...)） ---
  return encodeGif(images, widthPixels, canvasHeight, delay, theme);
}

function encodeGif(images, width, height, delay, theme) {
  const gif = GIFEncoder();
  const transparentTheme = theme === 'transparent';
  // 透明主题必须用 rgba4444 才能让量化器感知 alpha；
  // 不透明主题用 rgb565（6-5-5 位深，色彩质量更好）
  const qFormat = transparentTheme ? 'rgba4444' : 'rgb565';
  let prevRgba = null;

  for (let i = 0; i < images.length; i++) {
    const ctx = images[i].getContext('2d');
    const rgbaData = ctx.getImageData(0, 0, width, height).data;

    if (transparentTheme) {
      // 透明主题：alpha 二值化（>128 → 255，否则 0），等价于原项目 process_alpha_threshold
      for (let o = 3; o < rgbaData.length; o += 4) {
        rgbaData[o] = rgbaData[o] > 128 ? 255 : 0;
      }
    }

    // 与原版 Pillow 一致：相邻完全相同的帧只保留一帧
    // （静态/换行 GIF 会塌缩成单帧，体积可缩小 90%+；动态帧不受影响）
    if (
      prevRgba &&
      Buffer.compare(
        Buffer.from(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
        Buffer.from(prevRgba)
      ) === 0
    ) {
      continue;
    }
    prevRgba = new Uint8Array(rgbaData);

    // quantize 返回调色板；透明像素经 oneBitAlpha+clearAlpha 归一到唯一的 [0,0,0,0] 项
    const palette = quantize(rgbaData, 256, {
      format: qFormat,
      oneBitAlpha: transparentTheme,
      clearAlpha: transparentTheme,
      clearAlphaThreshold: 0,
      clearAlphaColor: 0x00,
    });
    // applyPalette 生成每个像素的调色板索引；rgba4444 模式下按 RGBA 距离匹配
    const index = applyPalette(rgbaData, palette, qFormat);

    let transparentIndex = -1;
    if (transparentTheme) {
      transparentIndex = palette.findIndex((p) => p.length >= 4 && p[3] === 0);
    }

    gif.writeFrame(index, width, height, {
      palette,
      delay: images.length > 1 ? delay : 1000,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      dispose: 2,
      repeat: 0,
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}
