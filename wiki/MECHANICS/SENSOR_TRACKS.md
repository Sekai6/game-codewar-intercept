# 传感器与航迹

> Data snapshot: v1.0.0 · 2026-07-26

## 运行方式

传感器按自身扫描周期工作。有效距离由标称距离、目标 RCS 四次方根、雷达地平线、系统健康和 ECM 共同决定；成功扫描产生带位置/速度误差的 `Track`，而不是把目标真值复制给 AI。航迹质量随时间老化，不确定度增加，过期后删除。

## 武器级门槛

`weaponQuality` 需要足够新鲜的三维位置、速度、高度和分类质量，并通过射程、视场、照射或主动搜索器条件。Link 11/16、ESM 和苏联 GCI 可以提供 cue，但不会绕过射手舰火控复核。

## 源码与验证

- 实现：[src/air/sensors.ts](../../src/air/sensors.ts)、[src/ships/sensor-runtime.ts](../../src/ships/sensor-runtime.ts)
- 验证：`npm run verify:air-sensors`、`npm run verify:track-source-ids`

## 为什么目标会晚出现

掠海高度造成的雷达地平线阴影、扫描周期和 ECM 可能共同压缩预警窗口；这不是生成器把目标瞬移进场。扫描成功后仍有分类不确定性，低质量航迹可以用于搜索和排序，却不能自动满足所有导弹的火控门槛。

## 航迹生命周期

```text
未发现 -> 测量成功 -> tentative -> weapon-quality
                    |             |
                    v             v
                误差/老化       共享给编队
                    |
                 drop/失联
```

数据链共享会增加延迟和不确定度；本舰传感器恢复后才重新形成有机航迹。Link 11/16 的价值是预警和排序，而不是凭空创造发射权限。
