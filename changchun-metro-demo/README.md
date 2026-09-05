# 长春地铁文旅四层联动平台

以 Three.js + React 构建的沉浸式城市文旅原型：通过「城市 3D 总览 → 地铁空间 → 景点内容 → 2D 关系总览」四层递进视角，讲述长春「分区 - 线路 - 景点」的空间关系。

产品需求见仓库根目录《长春地铁文旅四层联动平台-产品需求文档.md》。

## 技术栈

- **React 19 + Zustand**：应用层与全局状态（层级、选中对象、URL 同步）
- **Three.js**：第一层（城市 3D）与第二层（地铁空间）场景
- **Vite**：构建与开发服务；3D 层按需懒加载（Three.js 独立 chunk）
- **oxlint**：代码检查

## 启动

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物在 dist/
npm run preview
```

## 质量检查

```bash
npm run lint          # oxlint
npm run check:data    # 数据一致性校验（换乘共点、引用有效性）
python scripts/acceptance.py   # MVP 验收（需 dev server 运行中，pip install playwright）
```

验收脚本覆盖 PRD 3.2 节三条典型任务链路（区域→地铁→景点→详情 / 线路→2D 保留上下文 / 景点→跳转地铁站），提交前建议跑一遍。

## 目录结构

```
src/
├── App.jsx              # 四层视图容器（3D 层懒加载）
├── store/useStore.js    # 全局状态 + URL 查询参数同步
├── layers/              # 四个层级视图
│   ├── CityLayer.jsx    #   1. 城市 3D 总览（CityScene）
│   ├── MetroLayer.jsx   #   2. 地铁空间（MetroScene）
│   ├── PoiLayer.jsx     #   3. 景点内容（2D + 筛选 + 底部卡片带）
│   └── MapLayer.jsx     #   4. 2D 关系总览（图层开关）
├── three/               # Three.js 场景（CityScene / MetroScene）
├── components/          # 通用组件（TopNav 搜索/分享、PoiDrawer、City2DMap、图例…）
└── data/                # 数据层（JSON 为数据源，JS 为 API 封装）
    ├── districts.json / metro-lines.json / pois.json / themes.json
    ├── media.json       # 媒体资源清单（状态与路径约定）
    └── media.js         # getMedia()：按约定路径生成媒体结构
```

## 数据约定

- 四层数据通过**统一 ID** 关联：`districtId` / `lineId` / `stationId` / `poiId`。
- 换乘站两条线路的坐标必须**完全一致**，且 `transfer` 字段双向回指（`npm run check:data` 校验）。
- POI 通过 `stationIds` 关联地铁站（驱动「本站周边」筛选与站点详情推荐）。
- 媒体资源：`media.json` 中将 `status` 改为 `ready` 并提供真实路径即生效；缺省按
  `public/media/pois/<poiId>/cover.jpg | intro.mp4 | panorama.jpg` 约定取图，未就绪时显示占位。

## 协作约定

- `store` 是唯一状态源；跨组件的状态需求先加到 `useStore`，不要用 setState 隐式注入。
- 数据文件是契约：改 JSON 结构需同步更新 `data/*.js` 封装层并跑 `check:data`。
- 提交前跑 `npm run lint` + `npm run build` + 验收脚本。
