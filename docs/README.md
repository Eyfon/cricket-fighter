# 蛐蛐乱斗文档与规范体系

本文档是项目规范的唯一入口。新增角色、地图、机制、素材或界面时，先从这里找到对应规范，再修改代码和资源。

## 规范优先级

当代码、配置和说明出现冲突时，按下面顺序处理：

1. 当前运行时代码与自动化测试：说明实际已经实现的行为。
2. 数据 schema 与配置：说明角色、地图和设置允许使用的字段和值。
3. 领域规范：说明设计边界、制作要求和验收标准。
4. 示例、旧版本记录和素材说明：只用于参考，不能覆盖前三项。

发现冲突时，先修正代码或配置，再同步更新文档；不要只改文字掩盖未实现的功能。

## 文档地图

| 领域 | 主文档 | 负责内容 | 关联入口 |
| --- | --- | --- | --- |
| 总体设计 | [DESIGN-SPEC](./DESIGN-SPEC.md) | 目标、流程、共通机制、数值边界、开发阶段和总验收 | 所有领域规范 |
| 战斗玩法 | [BATTLE-RULES](./BATTLE-RULES.md) | 键位、回合、能量、伤害、状态、打断、角色现状 | `js/combat.js`、`js/combat-world.js` |
| 角色 | [CHARACTER-SPEC](./CHARACTER-SPEC.md) | 角色槽位、技能字段、动作状态、抗性和接入要求 | [角色设计稿](./templates/CHARACTER-BRIEF.md)、[角色配置模板](./templates/character.template.json) |
| 地图 | [MAP-SPEC](./MAP-SPEC.md) | 边界、视觉层、资源、BGM、manifest 和地图验收 | [地图设计稿](./templates/MAP-BRIEF.md)、`js/maps.js` |
| AI | [AI-SPEC](./AI-SPEC.md) | 简单、正常、困难的决策差异和测试方法 | [AI 对比](./AI-COMPARISON.md)、`js/ai.js` |
| 界面 | [INTERFACE](./INTERFACE.md) | 菜单流程、手机横屏、设置、选角和结算 | `index.html`、`style/` |
| 音频 | [AUDIO](./AUDIO.md) | BGM、动作音效、播报和音频状态切换 | `js/audio.js` |
| 贴图 | [SPRITE-DIRECTORY](./SPRITE-DIRECTORY.md) | 按角色和动作分类、裁切、manifest 和防串边 | [贴图记录](./SPRITE-V3.md)、[V4](./SPRITE-V4.md)、[V5](./SPRITE-V5.md) |

素材迭代记录不能替代主规范。AI 实验结果也不能替代 AI 行为规范。

## 新内容的标准流程

### 新角色

1. 阅读 [CHARACTER-SPEC](./CHARACTER-SPEC.md)、[BATTLE-RULES](./BATTLE-RULES.md) 和 [角色设计稿](./templates/CHARACTER-BRIEF.md)。
2. 先写角色定位、基础动作、技能意图、命中效果和数值，再填写 JSON 配置。
3. 为 `punch`、`kick`、`forwardPunch`、`forwardKick`、`specialPunch`、`specialKick`、`skill`、`skill2`、`super` 提供完整定义。
4. 按 [SPRITE-DIRECTORY](./SPRITE-DIRECTORY.md) 建立角色目录，逐帧记录裁切矩形、脚底基准和动作状态。
5. 接入 `js/roster.js`，运行 schema 校验、单元测试、构建和浏览器 smoke。
6. 同步更新角色图鉴、[BATTLE-RULES](./BATTLE-RULES.md) 的角色表和必要的 AI 偏好。

### 新地图

1. 阅读 [MAP-SPEC](./MAP-SPEC.md) 和 [地图设计稿](./templates/MAP-BRIEF.md)。
2. 确认 `id`、主题、视觉层、缩略图、地面高度、左右边界、BGM 和 renderer。
3. 将资源放入 `assets/arena/<map-id>/`，并在 `js/maps.js` 注册。
4. 验证角色落点、边界、投射物、HUD、不同横屏比例和地图音乐切换。
5. 同步地图选择页、界面文档和地图清单，运行完整测试。

### 新机制

1. 在 [DESIGN-SPEC](./DESIGN-SPEC.md) 写清目的、输入、状态变化、打断关系、资源消耗和边界情况。
2. 在 [BATTLE-RULES](./BATTLE-RULES.md) 写清玩家可观察到的行为和数值。
3. 先补测试，再修改引擎、配置和表现层。
4. 若影响 AI、动画、音频或手机控制，同步更新对应领域文档。
5. 删除过期描述，避免同一机制在不同文档中出现两套规则。

## 交付验收

每次涉及玩法或内容的变更，至少完成：

- `npm test`
- `npm run build`
- 与变更领域对应的浏览器 smoke；界面或手机变更运行 `tools/browser-menu-smoke.mjs` 和 `tools/browser-mobile-smoke.mjs`
- 资源路径、模块版本和控制台错误检查
- 16:9、19.5:9 横屏和窄屏回归；手机触控检查长按、滑动、多指和浏览器默认手势
- 文档、配置、图鉴和 README 的名称、键位、数值保持一致

完成后在对应文档的清单中勾选已验证项目，并在提交说明中写明测试结果。未实现的功能必须标为“未实现”，不能写成已经支持。

## 文件命名与版本记录

- 规范文档使用全大写短横线文件名，例如 `CHARACTER-SPEC.md`。
- 设计模板放在 `docs/templates/`，模板只描述填写格式，不记录某个具体角色的最终状态。
- 贴图按 `assets/characters/<character>/common`、`skill1`、`skill2`、`super` 分类；地图按 `assets/arena/<map-id>/` 分类。
- 重大规则变化应在主规范顶部更新版本号或日期，并在提交信息中说明迁移影响。
- 旧的素材生成记录保留用于追溯；如果记录与当前代码不同，以当前配置、测试和主规范为准。

## 当前基线

- 项目名称：蛐蛐乱斗
- 模拟：固定 60Hz，静态网页，无后端依赖
- 默认生命：双方 100，血量倍率默认 1 倍，可调 1/2/3/5 倍
- 资源：能量条每满 100 转为 1 点，最多 3 点；技能消耗 1 点，大招消耗 3 点，无额外技能冷却
- 输入：P1 使用 WASD + J/K/L/U/I/O，P2 使用方向键 + 小键盘 1/2/3/4/5/6，暂停使用 Esc
- 手机：横屏优先，默认摇杆和六键，支持十字键切换
