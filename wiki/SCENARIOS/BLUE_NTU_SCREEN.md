# 默认 NTU 防空场景

> 场景 ID：`blue-ntu-screen`；配置：`src/scenarios/surface-scenarios.ts`、`src/scenarios/`。

## 内容
USS Long Beach (CGN-9) 与 USS Lake Champlain (CG-57) 组成蓝方防空幕，面对 Moskva 及 P-15/P-500/P-700/Kh-22 等分层来袭威胁。初始单位、位置、弹药和交战开关由场景目录提供，不写在 `main.ts`。

## 验收路径
雷达扫描生成航迹 -> 舰队图/Link 共享 -> 本舰授权交战 -> Mk 10/Mk 41 发射架动画、实体离舰、弹药扣减 -> SM-2/CIWS 拦截或命中。以 launcher event、导弹出生位置和 ACMI 为证据；HUD 文本不能替代实体事件。

运行 `npm run verify:surface-scenarios`，再用 `npm run verify:docs` 检查文档链接。

