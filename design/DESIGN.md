# 设计说明 · 算仪

> 本文记录官网视觉的来源、规则与设计源资产的再生成方法。改视觉之前先读这一页。

## 概念

计然是《史记·货殖列传》里「既算支出，也算收入」的谋士。站点围绕一件虚构的计量仪器展开——
**算仪**：算盘与浑仪的合体。

- **Token 流**：59 道螺旋流，对应支持矩阵的 59 行（工具 + 供应商）。流在外缘几乎是径向的，
  靠近核心才卷起来——「从各处来，到一处去」。
- **计数环**（ecliptic，半径 2.0）：Token 穿过它的那一刻被「计入」，由骨白变为朱砂；
  之后在环内成为渐暗的余烬，最终没入墨核。这是整站唯一的强调色出现的理由。
- **三重浑仪环 + 算珠**：算珠按算盘逻辑拨动——已计的一侧成簇，每隔几秒拨过去一颗，拨满后整串退回。
- **墨核**：所有数字最终汇聚的地方。没有发光、没有 logo，只是一滴墨。

章节序号用账簿上的大写数字（壹贰叁肆伍陆柒），既是中文排版细节，也呼应「计」。

## 色彩

与 `design/instrument.json` 的 `palette` 同源，CSS 变量见 `src/styles/global.css`。

| 名 | 值 | 用途 |
| --- | --- | --- |
| 墨 ink | `#09090a` | 底色；不是纯黑，保留一点温度 |
| 骨白 bone | `#ece6da` | 正文与未计入的 Token |
| 朱砂 cinnabar | `#e5432a` | **只**用于「被计入」：计数带、算珠、章节序号、当前状态 |
| 黄铜 brass | `#b8955a` | 刻度与环，仪器的金属部分 |
| 青玉 jade | `#8fc7b2` | 少量的「健康 / 实时」状态（credits、在线设备） |

产品自身的图标是蓝色的刻度环加一点。站点没有沿用蓝色，而是沿用了**几何**：标识是同一个开口刻度环，
加一根指针刻线和一颗朱砂算珠（`src/components/Mark.astro`、`public/favicon.svg`）。

## 字体

| 角色 | 字体 | 说明 |
| --- | --- | --- |
| 展示（拉丁） | Instrument Serif | 窄而高的衬线，标题与工具名 |
| 展示（中文） | Noto Serif SC 400/600 | 按 unicode-range 分片，浏览器只下载用到的字 |
| 正文 | Instrument Sans + 系统中文黑体 | |
| 数字与标签 | JetBrains Mono | 等宽数字、零带斜杠，像仪表读数 |

全部自托管（`@fontsource`），不请求第三方字体服务。中文标题使用 `word-break: keep-all`，只在标点处断行；
较长的标题在合适位置插入 `​` 作为断点。

## 动效原则

- 首屏场景是位置 = f(种子, 时间) 的纯函数（`src/scripts/hero/shaders.ts`），无 GPGPU 状态，WebGL1 也能跑。
- 先上屏文字与 Blender 静帧，空闲时再加载 three；任何失败都停在静帧上。
- `prefers-reduced-motion: reduce` 时不启动 WebGL，所有过渡缩为瞬时。
- 首屏滚出后停止渲染；标签页隐藏时停止渲染；前 90 帧过慢则粒子减半、像素比降为 1。
- 计数器是演示值，所以带「~」——与产品「`~` 就是估算」的规则一致。章节里的小仪表同样标注「示意数据」。

## 设计源资产

| 文件 | 作用 |
| --- | --- |
| `design/instrument.json` | 算仪的几何与配色——Blender 与 Three.js 共用的唯一定义 |
| `design/blender/build_instrument.py` | 在 Blender 5.2 中按 spec 生成算仪与冻结的一帧 Token 流（与着色器同一公式） |
| `design/blender/jiran_instrument.blend` | 上述脚本生成的场景（含灯光与相机） |
| `design/tools/media.mjs` | 由 Blender 渲染母版生成站点图片、社交卡片与 apple-touch-icon |
| `src/assets/renders/*.webp` | 渲染母版的高质量 WebP；构建时由 Astro 再生成多尺寸 |

### 重新渲染

1. 在 Blender 5.2 中运行：
   `blender -b -P design/blender/build_instrument.py -- --spec design/instrument.json`
   然后调用 `light_and_camera()` 与 `render()`。三张母版的机位：

   | 母版 | 尺寸 | `light_and_camera` 参数 |
   | --- | --- | --- |
   | `og-base.png` | 2400×1260 | `distance=9.6, elevation=27, lens=50, target=(-0.9, 0, -0.2)` |
   | `tall-base.png` | 1200×1800 | `distance=11.5, elevation=48, azimuth=-10, lens=50` |
   | `macro-base.png` | 1600×1600 | 85mm、f/1.6，对准计数环上的算珠簇（见 .blend 中的相机） |

   Cycles，160 samples + 降噪，AgX。Token 点云 140 000 个。
2. `pnpm media <母版目录> .` 生成 `src/assets/renders/`、`public/og/`、`public/apple-touch-icon.png`。

改 `instrument.json` 后两边都要重新生成：重新渲染静帧，站点场景则自动跟随。
