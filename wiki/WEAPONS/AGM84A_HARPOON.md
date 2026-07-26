# AGM-84A Harpoon

> Data snapshot: v1.0.0 · 2026-07-26

A-6E 的反舰武器。中段按惯性/航迹推进，末端主动搜索器进入视场后搜索舰船；掠海高度、搜索质量、ECM 和诱饵共同影响命中。实现入口：`src/anti-ship-guidance.ts`、`src/models/air-weapons.ts`。

## 飞行与末端行为

导弹从 A-6E 挂点分离后进入稳定巡航，接近目标区时降低高度并开启主动雷达搜索。目标的最后已知位置、航迹误差和搜索器视场决定能否在正确海区捕获；ECM、SRBOC 和舰船机动会参与竞争。直接掠海能压缩舰载 SAM/CIWS 的反应时间，若场景/型号配置允许跃升，末段高度和俯冲几何会相应改变。

验证：`npm run verify:anti-ship-guidance`、`npm run verify:air-asm-ecm`、`npm run verify:air-strike-defense`。
