# 遥测与 Tacview

每次作战都会产生结构化事件：传感器测量、航迹更新、数据链传输、武器选择、合法发射、导引阶段、拦截判定、损伤、离场和任务结果。

导出层同时服务 HUD、AAR、统计分析和 ACMI/Tacview。ACMI 使用真实实体轨迹，不创建虚假武器实体；CEC、EMCON、航迹质量、导弹中段链路和通信窗口作为对象属性与事件写入。

相关代码：`src/aar/`、`src/cec/observability.ts`、`src/aar/acmi-exporter.ts`。
