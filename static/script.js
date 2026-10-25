document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        text: document.getElementById('text-input'),
        effect: document.getElementById('effect-select'),
        theme: document.getElementById('theme-select'),
        color: document.getElementById('color-input'),
        colorPicker: document.getElementById('color-picker'),
        font: document.getElementById('font-select'),
        width: document.getElementById('width-input'),
        fontSize: document.getElementById('fontsize-input'),
        frames: document.getElementById('frames-input'),
        delay: document.getElementById('delay-input'),
        wrap: document.getElementById('wrap-input'),

        widthVal: document.getElementById('width-val'),
        fontSizeVal: document.getElementById('fontsize-val'),
        framesVal: document.getElementById('frames-val'),
        delayVal: document.getElementById('delay-val'),

        preview: document.getElementById('gif-preview'),
        errorMsg: document.getElementById('preview-error'),
        loading: document.getElementById('loading'),
        urlInput: document.getElementById('url-input'),
        downloadBtn: document.getElementById('download-btn'),
        copyBtn: document.getElementById('copy-btn')
    };

    let debounceTimer;

    // 从后端拉取字体列表填充下拉（1/2/3... 对应接口 font=N）
    fetch('/fonts')
        .then((r) => r.json())
        .then((data) => {
            const select = elements.font;
            (data.fonts || []).forEach((f) => {
                const opt = document.createElement('option');
                opt.value = String(f.index);
                opt.textContent = `${f.index}. ${f.name.replace(/\.(ttf|otf|ttc)$/i, '')}`;
                select.appendChild(opt);
            });
        })
        .catch(() => { /* 字体列表加载失败则仅保留"随机字体" */ });

    // 更新滑块数值显示
    elements.width.addEventListener('input', (e) => elements.widthVal.textContent = e.target.value);
    elements.fontSize.addEventListener('input', (e) => elements.fontSizeVal.textContent = e.target.value);
    elements.frames.addEventListener('input', (e) => elements.framesVal.textContent = e.target.value);
    elements.delay.addEventListener('input', (e) => elements.delayVal.textContent = e.target.value);

    // 调色盘 ↔ 文本框 双向联动
    // 调色盘选色 → 同步到文本框（hex），并触发预览更新
    elements.colorPicker.addEventListener('input', (e) => {
        elements.color.value = e.target.value;
        triggerUpdate();
    });
    // 文本框输入合法 Hex → 反向同步调色盘（颜色名如 cyan 则不同步，只作为文本框值）
    elements.color.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const m = val.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
        if (m) {
            let hex = m[1];
            if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
            elements.colorPicker.value = `#${hex.toLowerCase()}`;
        }
    });

    // 主更新函数
    function updatePreview() {
        elements.loading.classList.add('active');

        const params = new URLSearchParams();
        params.append('text', elements.text.value || 'Hello');
        params.append('width_pixels', elements.width.value);
        params.append('font_size', elements.fontSize.value);
        params.append('frame_count', elements.frames.value);
        params.append('delay', elements.delay.value);
        params.append('theme', elements.theme.value);

        if (elements.font.value) {
            params.append('font', elements.font.value);
        }

        if (elements.wrap.checked) {
            params.append('wrap', 'true');
        }

        // 处理颜色/特效逻辑
        let colorParam = elements.color.value.trim();
        const effect = elements.effect.value;

        if (effect === 'static') {
            // 纯静态：显式指定 mode=static，可叠加自定义颜色
            params.append('mode', 'static');
            if (colorParam) {
                params.append('color', colorParam);
            }
        } else if (effect === 'scroll') {
            // 滚动：默认行为，无需额外参数；有自定义颜色则传颜色
            if (colorParam) {
                params.append('color', colorParam);
            }
        } else if (effect) {
            if (effect === 'breathing' && colorParam.includes(':')) {
                // 用户手动输入了呼吸灯参数，直接使用或添加前缀
                if (!colorParam.startsWith('breathing:')) {
                    colorParam = `breathing:${colorParam}`;
                }
                params.append('color', colorParam);
            } else if (effect === 'breathing') {
                // 如果未指定颜色，使用默认呼吸灯效果
                params.append('color', 'breathing:#ff0000:#0000ff');
            } else {
                // 其他特效如 wave, bounce, neon, rainbow_flow
                params.append('color', effect);
            }
        } else if (colorParam) {
            params.append('color', colorParam);
        }

        const url = `/generate?${params.toString()}`;
        elements.urlInput.value = window.location.origin + url;

        // 加载图片
        const img = new Image();
        img.onload = () => {
            elements.preview.src = url;
            elements.loading.classList.remove('active');
            if (elements.errorMsg) elements.errorMsg.style.display = 'none';
        };
        img.onerror = async () => {
            elements.loading.classList.remove('active');
            // 请求失败时向后端拿具体错误信息并展示，而不是静默空白
            let msg = 'GIF 生成失败';
            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    msg = 'GIF 加载失败（图片解析错误）';
                } else {
                    const data = await resp.json().catch(() => null);
                    if (data && data.detail) msg = `生成失败：${data.detail}`;
                    else msg = `请求失败（HTTP ${resp.status}）`;
                }
            } catch (e) {
                msg = '无法连接到服务（请确认服务已启动）';
            }
            elements.preview.removeAttribute('src');
            if (elements.errorMsg) {
                elements.errorMsg.textContent = msg;
                elements.errorMsg.style.display = 'block';
            }
        };
        img.src = url;
    }

    // 防抖更新
    function triggerUpdate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updatePreview, 800); // 800ms 防抖
    }

    // 绑定事件监听器
    const inputs = [
        elements.text, elements.effect, elements.theme,
        elements.color, elements.font, elements.width,
        elements.fontSize, elements.frames,
        elements.delay, elements.wrap
    ];

    inputs.forEach(input => {
        input.addEventListener('input', triggerUpdate);
        input.addEventListener('change', triggerUpdate); // 针对 select/checkbox
    });

    // 下载按钮
    elements.downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = elements.preview.src;
        link.download = 'neon_text.gif';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 复制 URL 按钮
    elements.copyBtn.addEventListener('click', () => {
        elements.urlInput.select();
        document.execCommand('copy');
        const originalText = elements.copyBtn.textContent;
        elements.copyBtn.textContent = '已复制!';
        setTimeout(() => elements.copyBtn.textContent = originalText, 2000);
    });

    // 初始加载
    updatePreview();
});
