# 平台索引

> Data snapshot: v1.0.0 · 2026-07-26

## 水面平台

- [USS Long Beach (CGN-9)](USS_LONG_BEACH_CGN9.md)
- [USS Lake Champlain (CG-57)](USS_LAKE_CHAMPLAIN_CG57.md)
- [Moskva](MOSKVA.md)

## 空中平台

- [F-14A Tomcat](F14A_TOMCAT.md)
- [A-6E Intruder](A6E_INTRUDER.md)
- [Tu-16K Badger-G](TU16K_BADGER_G.md)
- [MiG-29A Fulcrum-A](MIG29A_FULCRUM.md)
- [E-2C Hawkeye](E2C_HAWKEYE.md)
- [Tu-126 Moss](TU126_MOSS.md)

## 平台在系统中的差异

| 平台 | 主要任务 | 关键机制 | 典型验证问题 |
|---|---|---|---|
| CGN-9 | 编队指挥、区域防空 | Mk 10/Mk 41、照射通道、Link 11 | 旗舰是否经过实体发射回路？ |
| CG-57 | Aegis 区域防空、编队射手 | 独立 SPY/火控、前后 Mk 41 | 附属舰是否拥有自己的航迹和 owner？ |
| Moskva | 苏联水面打击与防御 | 苏联 C2、反舰齐射 | 是否错误复用了 NATO 数据链？ |
| F-14A | CAP、远程截击 | Phoenix 两阶段制导、加力与编队 | 是否在合理发射区建立能量优势？ |
| A-6E | 低空反舰 | 航路点、Harpoon、脱离 | 导弹是否从真实挂点释放？ |
| Tu-16K | 远程反舰突击 | KSR-5、编队释放、有限规避 | 是否在舰队防区外形成发射条件？ |
| MiG-29A | 前线截击 | R-27R 照射、R-73 红外、加力 | GCI cue 是否仍经过本机航迹？ |
| E-2C / Tu-126 | AEW 与指挥提示 | 扫描、航迹质量、网络延迟 | 提示是否被误当成直接开火权？ |

所有平台均是独立实体：位置、速度、传感器、弹药、损伤和任务状态不存放在“舰队总血量”或“编队总弹药”中。
