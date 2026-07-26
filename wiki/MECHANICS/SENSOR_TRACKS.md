# 传感器与航迹

> Data snapshot: v1.0.0 · 2026-07-26

## 运行方式

传感器按自身扫描周期工作。有效距离由标称距离、目标 RCS 四次方根、雷达地平线、系统健康和 ECM 共同决定；成功扫描产生带位置/速度误差的 `Track`，而不是把目标真值复制给 AI。航迹质量随时间老化，不确定度增加，过期后删除。

## 武器级门槛

`weaponQuality` 需要足够新鲜的三维位置、速度、高度和分类质量，并通过射程、视场、照射或主动搜索器条件。Link 11/16、ESM 和苏联 GCI 可以提供 cue，但不会绕过射手舰火控复核。

## 源码与验证

- 实现：[src/air/sensors.ts](../../src/air/sensors.ts)、[src/ships/sensor-runtime.ts](../../src/ships/sensor-runtime.ts)
- 验证：`npm run verify:air-sensors`、`npm run verify:track-source-ids`
