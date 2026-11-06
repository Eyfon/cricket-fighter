# 角色贴图目录

角色资源现在按“人物 → 动作类别 → 动作图集”组织：

```text
assets/characters/
├── canglan/
│   ├── common/
│   │   ├── idle.png
│   │   ├── walk.png
│   │   ├── jump.png
│   │   ├── punch.png
│   │   ├── kick.png
│   │   ├── forward-punch.png
│   │   ├── forward-kick.png
│   │   ├── down-punch.png
│   │   ├── down-kick.png
│   │   ├── guard.png
│   │   ├── crouch-guard.png
│   │   ├── hurt.png
│   │   ├── knockdown.png
│   │   └── ko.png
│   ├── skill1/atlas.png
│   ├── skill2/atlas.png
│   ├── super/atlas.png
│   └── manifest.json
└── chifeng/
    └── 同样的结构
```

每张动作 PNG 内仍然可以有多帧。例如 `skill1/atlas.png` 是技能一的完整动画帧，不是只有一个姿势；`manifest.json` 记录 `src` 和每帧的 `rect`。这样新增角色时只复制自己的目录，不需要把所有人物动作混在一张总图里。

`tools/organize_sprites.py` 是可重复执行的整理脚本。它从当前旧图集裁切出新目录，使用透明 PNG 和安全边距。旧的根目录图集暂时保留，作为现有运行映射的兼容资源；新目录是后续切换 `roster.js` 和 `animation-data.js` 的正式资源层。

当前分类：

- `common`：待机、行走、跳跃、防御、蹲防、受击、倒地、KO，以及拳脚和方向攻击。
- `skill1`：角色技能一。
- `skill2`：角色技能二。
- `super`：角色大招。
- `manifest.json`：人物动作清单与裁切坐标。

不要直接把整张旧图集当作新角色动作文件使用。新增动作应先裁切到对应人物目录，再在 manifest 和动画映射中登记。

### 奶娃

```text
assets/characters/naiwa/
├─ common/atlas.png
├─ skill1/atlas.png      # 回眸一击
├─ skill2/atlas.png      # 捧腹大笑
├─ super/atlas.png       # 奶蛋天降
└─ manifest.json
```

奶娃的图集使用同一角色比例和 320×320 网格。圆形奶蛋、范围震荡和升空表现由 Canvas 特效层绘制，角色图集只保留人物本体，避免特效跨格和裁切串边。
