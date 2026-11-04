# 蛐蛐格斗 / Arcade Lab

基于克隆的 [fogolin/js-fighter](https://github.com/fogolin/js-fighter) 仓库整理的网页格斗基架。新入口使用独立编写的战斗引擎，原始 `js/game.js`、样式、素材和说明保留，方便对照学习。当前使用内置生成的原创像素示例角色与夕阳天台背景，无需额外下载素材。新增两套各 16 帧像素动作图集：走路交替迈步，出招按蓄势/出手/收招播放；与原有姿态配合使用，动作按阶段逐帧切换，不叠加残影。

## 本地开玩

需要 Python 3；测试、打包需要 Node.js 22 或更新版本。没有 npm 运行时依赖，无需 `npm install`。

```powershell
cd E:\Code\AI_Coding\cricket-fighter
npm run dev
```

打开 http://127.0.0.1:5173/ 。也可以直接运行 `python -m http.server 5173 --bind 127.0.0.1`。ES Modules 需要 HTTP 服务，不能双击 HTML 以 file:// 运行。

`npm run dev` 启动前会生成整套模块的内容版本号，本地服务禁止缓存；静态打包也生成同一版本映射，避免新角色配置配上旧战斗结算。已有旧进程可以继续服务，更新后需刷新页面；推荐重启 `npm run dev` 使用新的无缓存服务。

二技能网页回归可运行 `node tools/browser-burst-smoke.mjs`（需要本机 Chrome；可用 `CHROMIUM_PATH` 指定）。检查真实页面循环中的伤害、落地收招、范围特效及模块版本，轨迹写入 `artifacts/burst-check.json`。

## 界面流程

主界面 → 模式选择 → 角色选择 → 地图与对战设置 → VS / 战斗 → 结算。

- 地图与规则在同一页：夕照天台、午夜天台（同场景夜色）、网格训练场。
- 时间可选 30 / 60 / 90 秒或无限，获胜目标 1 / 2 / 3 回合。
- 双方共用 1 / 2 / 3 / 5 倍血量，默认 1 倍；基础生命 100，招式伤害直接按较低数值设计。战斗只显示血条。
- 结算只有返回与重新开战；返回选人保留选择，重开沿用本场配置。
- 游戏选项支持音效音量、静音、震屏、扫描线、手机按键、全屏，保存在当前浏览器。
- 练习支持待机 / 防御木桩、无限能量开关；角色图鉴先显示图片与名字，点击后查看完整招式，选人页不显示技能。
- 完整约定见 [界面说明](docs/INTERFACE.md)。

## 已实现

- AI 对 AI 自动观战、人机对战、本地双人；两名可替换像素示例角色。
- 固定 60Hz 模拟，移动、跳跃、防御、拳、脚、必杀和超杀。
- 招式前摇 / 有效帧 / 后摇、左右镜像判定框、受击硬直和击退。
- 普通拳命中后的取消接招；攻击与受击攒气、两个特殊招式免费、小技能消耗 1 点，无时间冷却、大招消耗 3 点，最多存 3 点。
- 升龙、突进、独立气功波、双波、多段爪击、地面抓取连打与抛出；大型能量弹可破防和对波。
- 可配置胜局目标和时间、平局加赛、重新开战。
- 命中停顿、粒子、震动、分层打击／技能音效、大厅/选角/结算与三张地图独立 BGM、按实际胜负播放的英语街机播报（默认开启，首次交互后播放）。
- 暂停、失焦自动暂停、判定框查看、手机多点触屏按键。

这是简化的格斗基架。画风更新包括像素角色图集、夕阳天台场景、街机 HUD、技能光弧与命中火花。素材来源和生成提示词见 `ASSET-NOTES.md`。

尚未实现方向搓招、通用投技、3v3、网络联机和完整角色动画编辑器。游戏已有蹲防、角色专属抓取技能及高低段防御判定。手机触屏控制 1P；本地双人需要键盘。

手机采用横屏界面：首次点击开始时尝试全屏并锁定横屏，不支持原生全屏的浏览器使用页面旋转。左下八方向摇杆，右下六键（上排技能一／技能二／大招，下排拳／脚／闪避），支持多指与方向组合。操作层悬浮在画面上，观战时隐藏；电脑键位不变。手机浏览器回归可运行 `node tools/browser-mobile-smoke.mjs`，使用 `GAME_URL` 指定本地服务地址。

## 设计与规则文档

- [设计总规范](docs/DESIGN-SPEC.md)：玩法目标、通用机制、数值边界、角色制作流程与验收标准；新增机制和角色以此为总约定。
- [战斗规则与玩法总览](docs/BATTLE-RULES.md)：当前实际操作、招式数值、能量、状态、打断和角色技能。
- [三级 AI 规范](docs/AI-SPEC.md) 与 [实测对比](docs/AI-COMPARISON.md)：已接入延迟感知、战术评分和有限记忆；观战双方可单独选择难度，人机只设置对手难度。复测运行 `npm run ai:benchmark -- --seeds 1000 --publish-report`。
- [角色设计与接入规范](docs/CHARACTER-SPEC.md)：角色槽位、输入约定、配置字段和角色专属技能要求。
- [角色设计稿模板](docs/templates/CHARACTER-BRIEF.md) 与 [角色配置模板](docs/templates/character.template.json)：新角色从设计到数据接入的起点。
- [地图设计与接入规范](docs/MAP-SPEC.md) 与 [地图设计稿模板](docs/templates/MAP-BRIEF.md)：新地图的主题、边界、资源、BGM、配置和验收标准。
- [贴图目录说明](docs/SPRITE-DIRECTORY.md)：按角色、通用动作、技能一/二和大招整理素材。
- [界面说明](docs/INTERFACE.md) 与 [音频说明](docs/AUDIO.md)：界面流程、音效和 BGM 约定。

## 按键

| 操作 | 1P | 2P |
| --- | --- | --- |
| 移动 | A / D | ← / → |
| 跳跃 | W | ↑ |
| 站防 / 蹲防 | S / 下＋后 | ↓ / 下＋后 |
| 拳 / 脚 | J / K | 小键盘 1 / 2 |
| 方向攻击 | 前或下＋J / K | 前或下＋小键盘 1 / 2 |
| 闪避 | L | 小键盘 3 |
| 定向闪避 | A / D＋L | ← / →＋小键盘 3 |
| 技能一 / 二 | U / I | 小键盘 4 / 5 |
| 大招 | O | 小键盘 6 |
| 暂停 | Esc | Esc |

前后根据对手所在方向判断；下方向站防，下＋后蹲防，单按后方向用于后退。下＋脚扫腿需要蹲防。下方向攻击组合优先于前方向组合。单按上立即起跳；长按攻击不会自动连发。单按闪避原地闪，方向加闪避定向移动；闪避持续 0.28 秒，冷却 0.8 秒。两种技能各消耗 1 点，大招消耗 3 点，均无时间冷却。P2 使用物理小键盘，支持 Num Lock 开关。

修改顶部设置后点击“开始对战”应用。自动观战时两侧均由本地规则 AI 控制，不调用大模型或远程接口。

## 添加自己的角色

先阅读 [角色设计与接入规范](docs/CHARACTER-SPEC.md)。设计稿用 [角色填写模板](docs/templates/CHARACTER-BRIEF.md)，完整配置从 [JSON 数据模板](docs/templates/character.template.json) 起步。游戏内招式表由配置自动生成，配置在启动时自动校验。

编辑 `js/roster.js`，复制一份角色定义，使用唯一 `id`。角色菜单会自动生成。

- `speed`、`jump`：水平速度和起跳速度，单位为像素 / 秒。
- `width`、`height`：受击框大小；`color`、`accent` 控制占位外观。
- `ai.preferredRange`：AI 希望保持的距离。苍岚偏气功控场，赤锋偏爪击擒拿；每招有用途说明与 AI 标签。
- `moves`：六个通用基础攻击槽位及 `skill`、`skill2`、`super` 三个角色技能槽位，详见角色规范。
- 每个招式配置 `startup`、`active`、`recovery`（60Hz 帧数）、`damage`、`stun`、`knockback`、`cost`、`gain` 和 `box`。
- `box` 以角色脚底中心为原点，面朝右为正 x，向上为负 y，单位为画布像素。面朝左自动镜像。
- `range` 供 AI 选择招式，不改变实际命中距离；实际攻击距离由 `box` 决定。
- `effect:'rise'` 配合 `riseVelocity` 控制跃起，`effect:'dash'` 配合 `dashSpeed` 控制突进。`groundOnly` 限制地面发动；`ai.role/weight` 决定 AI 的战术倾向。新机制需先扩展引擎。
- `cancel:['kick','specialPunch']` 指定命中后可取消接入的招式。

导入动画：把自己的横向 PNG 精灵图放在 `assets/characters/`，按下面的格式填入角色的 `sprites`。

```js
sprites: {
  idle: {
    src: './assets/characters/my-idle.png',
    frameWidth: 128,
    frameHeight: 128,
    frames: 6,
    fps: 8,
    drawWidth: 150,
    drawHeight: 150
  }
}
```

支持 `idle / walk / jump / punch / kick / specialPunch / specialKick / skill / super / dodge / hurt / guard / ko` 状态，每种状态一个横向精灵图，素材默认面朝右。缺失状态回退至 idle，图片加载失败则显示占位人形。图片不会自动生成技能，仍需配置招式的效果与判定。

内置角色使用不等尺寸动作矩形：`{src, rect:[x,y,w,h], scale:0.65, anchorX:0.5}`。`rect` 是图集裁切区域，`scale` 控制显示比例，`anchorX` 决定身体与脚底原点的水平对齐。原有等宽横向动画格式仍然支持。

## 目录

```text
index.html              新入口
js/arena.js             输入、固定步长循环、渲染、比赛生命周期
js/menu.js              界面导航、角色/地图/规则、选项与结算
js/settings.js          默认规则、配置校验、浏览器存储
js/maps.js              场景目录
js/input.js             P1/P2 物理键位、按下沿与下方向组合识别
js/animation.js         动作采样、移动距离迈步、逐帧切换
js/animation-data.js    连续动作图集与阶段映射
js/combat-world.js      飞行道具、对波与抓取时间线
js/energy-effects.js    气功波、蓄气和爪击特效
js/combat.js            Fighter、碰撞、受击与规则 AI（无 DOM 依赖）
js/roster.js            角色 / 招式 / 动画配置
js/character-schema.js  六槽位契约、资源和素材映射校验
docs/CHARACTER-SPEC.md  后续角色设计与接入规范
docs/DESIGN-SPEC.md    玩法、战斗、角色、素材和验收总规范
docs/BATTLE-RULES.md   当前战斗机制与数值
docs/MAP-SPEC.md       新地图设计、资源、BGM 和验收规范
docs/SPRITE-DIRECTORY.md 角色贴图分类与目录规则
docs/templates/        设计稿与完整角色配置模板
js/presentation.js      场景、HUD、命中特效
assets/arena/           内置像素场景
style/arena.css         响应式界面
assets/characters/      按人物 / common / skill1 / skill2 / super 分类的角色精灵图
tests/combat.test.js    核心战斗测试
tools/build.js          静态打包
tools/browser-smoke.mjs 可选浏览器验证（需要自行安装 Playwright）
.github/workflows/      main 推送自动部署，也支持手动触发
upstream.html           原项目入口
UPSTREAM-README.md      原项目说明
UPSTREAM-CNAME.txt      原作者域名的记录，不参与部署
```

## 检查与打包

```sh
npm test
npm run build
```

测试和构建都会按 `tools/asset-integrity.json` 核对全部角色贴图、场景和音效的字节数与 SHA-256，残缺资源会阻止发布。有意替换或新增素材后，先检查本地原文件，再运行 `node tools/verify-assets.js --write` 更新清单并一起提交。线上贴图请求使用与模块一致的资源版本号，避免继续命中旧的损坏缓存。

角色贴图目录和裁切规则见 [贴图目录说明](docs/SPRITE-DIRECTORY.md)。重新整理现有图集可运行 `python tools/organize_sprites.py`；它会生成两个人物的独立动作图集和 `manifest.json`。

生成的 `dist/` 包含新入口、战斗与 AI／手机控制模块、界面样式，以及打包清单中的角色、场景和音频资源，不会带入原作者素材或域名。所有运行资源使用相对路径，可部署到 GitHub Pages 的仓库子路径。

可选浏览器 QA：安装 Playwright 与 Chromium 后运行 `node tools/browser-smoke.mjs`，默认访问本地 5173。可设置 `PLAYWRIGHT_MODULE`、`CHROMIUM_PATH`、`GAME_URL`。检查完整 AI 比赛、暂停、本地按键、人机、触屏和窄屏布局，截图输出至 `artifacts/`。

## 放到 GitHub Pages

项目仓库：[Eyfon/cricket-fighter](https://github.com/Eyfon/cricket-fighter)。游戏地址：[蛐蛐格斗](https://eyfon.github.io/cricket-fighter/)。网站展示最近一次成功部署的版本。

仓库使用 GitHub Actions 部署：推送到 `main` 后，`Deploy game to GitHub Pages` 工作流会测试、构建并发布；也可以在 [Actions 页面](https://github.com/Eyfon/cricket-fighter/actions/workflows/pages.yml) 手动运行。确认对应提交的工作流成功后，再检查线上更新。

如需部署到自己的仓库，在 **Settings → Pages → Source** 选择 **GitHub Actions**，并保留此工作流。也可把 `dist/` 内容交给任意静态托管。

## 原项目来源

原仓库未发现明确 LICENSE；保留来源记录不代表已经取得原代码或素材的再发布授权。当前新游戏的打包清单不包含原游戏代码和素材。如果准备公开整个克隆仓库，应先确认上游许可。

当前战斗手感：伤害直接写入配置；普通防御承受约 25% 磨血；后摇缩短，攻击支持约 0.1 秒提前输入；小技能和大招只受点数与动作状态限制，两个特殊招式也无时间冷却。

战斗布局占满浏览器窗口，画面按原比例适配。技能详情以普攻、招式1、招式2、特技、绝招分类，不显示操作按键。

回合结束先播放冲击、倒地、KO 大字和胜利语音，再出现结算选项；整个演出约 5.2 秒，不会在最后一击时突然弹窗。音频实现与制作方式见 `docs/AUDIO.md`。

普攻硬直缩短，不再反复抬起地面目标；墙角反推、连击硬直衰减和短暂脱身保护避免持续控死。大招发动加入 0.18 秒时停、短暂收镜聚光和专属音效，不带喊招语音。详细数值及新增角色验收要求见[设计总规范第 13–14 节](docs/DESIGN-SPEC.md)。
