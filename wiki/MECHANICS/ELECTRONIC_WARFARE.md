# 电子战与诱饵

> Data snapshot: v1.0.0 · 2026-07-26

ECM 是平台发射的主动电磁干扰，会降低雷达探测/航迹质量并影响雷达导引头，距离足够近后存在烧穿。箔条是带位置、速度、寿命和信号强度的雷达诱饵；热焰弹只对红外导引有效。舰艇 SRBOC 与飞机投放程序都必须产生独立诱饵实体，不能只把命中率全局相减。

实现入口：[src/radar-countermeasures.ts](../../src/radar-countermeasures.ts)、[src/air/countermeasure-program.ts](../../src/air/countermeasure-program.ts)。验证：`npm run verify:air-countermeasures`、`npm run verify:air-asm-ecm`、`npm run verify:ship-electronic-warfare`。
