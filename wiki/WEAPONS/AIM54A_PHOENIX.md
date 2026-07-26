# AIM-54A Phoenix

> Data snapshot: v1.0.0 · 2026-07-26

远程空空导弹。发射后使用 F-14 航迹/数据链进行中段更新，进入主动搜索器包线后自主捕获；捕获前不能读取敌机真值。导引、过载和燃料参数位于 `src/air/catalog.ts` 与 `src/air/guidance.ts`。验证：`npm run verify:air-guidance`。

## 交战链

发射条件包含航迹质量、目标距离/方位、发射机能量和挂点库存。中段按预测拦截点飞行并接受允许的数据链更新；末端主动头在有限视场内搜索。远射时目标机动会扩大预测误差，导弹爬升/转弯也会消耗能量，所以名义射程不能直接当作有效击杀距离。

复盘应检查 `midcourse -> active-search -> acquired/lost -> terminal` 阶段、F-14 是否仍能提供更新、Tu-16K 是否使用 ECM，以及导弹在末端是否仍有足够速度和过载。
