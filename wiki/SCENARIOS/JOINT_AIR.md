# 联合空战场景

> 场景 ID：`joint-air-combat`；配置入口：`src/air/scenarios.ts` 与 `src/air/catalog.ts`。

默认生成 F-14A CAP、Tu-16K KSR-5、A-6E Harpoon、MiG-29A、E-2C 与 Tu-126，并接入舰载防空。飞机由独立实体执行三维动力学、OODA、传感器、武器和干扰弹逻辑。

预期闭环：F-14 发现并截击 Tu-16K；Tu-16K 从中心线挂点释放 KSR-5 后脱离；A-6E 低空释放 AGM-84A；舰载 SAM 通过本舰 launcher runtime 交战；存活实体继续机动。运行 `npm run verify:joint-air`，用 AAR/ACMI 检查每个实体事件。

