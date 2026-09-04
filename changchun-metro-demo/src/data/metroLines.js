export const metroLines = [
  {
    lineId: 'line-01',
    name: '地铁1号线',
    shortName: '1号线',
    type: 'metro',
    color: '#e4393c',
    direction: '北环城路 ↔ 红嘴子',
    stations: [
      { stationId: 'st-01-01', name: '北环城路', x: 546, y: 130, transfer: ['line-08'] },
      { stationId: 'st-01-02', name: '庆丰路', x: 548, y: 166 },
      { stationId: 'st-01-03', name: '一匡街', x: 550, y: 202 },
      { stationId: 'st-01-04', name: '长春站北', x: 552, y: 238, transfer: ['line-04'] },
      { stationId: 'st-01-05', name: '长春站', x: 554, y: 274, transfer: ['line-03'] },
      { stationId: 'st-01-06', name: '胜利公园', x: 555, y: 310 },
      { stationId: 'st-01-07', name: '人民广场', x: 556, y: 345 },
      { stationId: 'st-01-08', name: '解放大路', x: 556, y: 380, transfer: ['line-02'] },
      { stationId: 'st-01-09', name: '东北师大', x: 555, y: 415 },
      { stationId: 'st-01-10', name: '工农广场', x: 554, y: 450, transfer: ['line-07'] },
      { stationId: 'st-01-11', name: '繁荣路', x: 553, y: 486, transfer: ['line-06'] },
      { stationId: 'st-01-12', name: '卫星广场', x: 552, y: 521, transfer: ['line-03'] },
      { stationId: 'st-01-13', name: '市政府', x: 551, y: 557 },
      { stationId: 'st-01-14', name: '华庆路', x: 550, y: 592 },
      { stationId: 'st-01-15', name: '红嘴子', x: 549, y: 628 }
    ]
  },
  {
    lineId: 'line-02',
    name: '地铁2号线',
    shortName: '2号线',
    type: 'metro',
    color: '#2f7ef0',
    direction: '汽车公园 ↔ 雾开河大街',
    stations: [
      { stationId: 'st-02-01', name: '汽车公园', x: 60, y: 352, transfer: ['line-07'] },
      { stationId: 'st-02-02', name: '捷达大路', x: 108, y: 350 },
      { stationId: 'st-02-03', name: '西湖', x: 155, y: 348 },
      { stationId: 'st-02-04', name: '双丰', x: 200, y: 345, transfer: ['line-06'] },
      { stationId: 'st-02-05', name: '长春西站', x: 245, y: 342, transfer: ['line-06'] },
      { stationId: 'st-02-06', name: '兴隆堡', x: 285, y: 339 },
      { stationId: 'st-02-07', name: '和平大街', x: 325, y: 336 },
      { stationId: 'st-02-08', name: '万福街', x: 362, y: 333 },
      { stationId: 'st-02-09', name: '景阳广场', x: 400, y: 330 },
      { stationId: 'st-02-10', name: '正阳街', x: 440, y: 327 },
      { stationId: 'st-02-11', name: '解放桥', x: 485, y: 324 },
      { stationId: 'st-02-12', name: '文化广场', x: 522, y: 332 },
      { stationId: 'st-02-13', name: '解放大路', x: 556, y: 380, transfer: ['line-01'] },
      { stationId: 'st-02-14', name: '平阳街', x: 600, y: 386 },
      { stationId: 'st-02-15', name: '南关', x: 640, y: 378 },
      { stationId: 'st-02-16', name: '吉林大路', x: 690, y: 360, transfer: ['line-04'] },
      { stationId: 'st-02-17', name: '东盛大街', x: 725, y: 350 },
      { stationId: 'st-02-18', name: '东环城路', x: 758, y: 342, transfer: ['line-07'] },
      { stationId: 'st-02-19', name: '东方广场', x: 805, y: 326 },
      { stationId: 'st-02-20', name: '窦家沟', x: 836, y: 314 },
      { stationId: 'st-02-21', name: '英凯大街', x: 864, y: 304 },
      { stationId: 'st-02-22', name: '雾开河大街', x: 882, y: 290 }
    ]
  },
  {
    lineId: 'line-03',
    name: '轻轨3号线',
    shortName: '3号线',
    type: 'light-rail',
    color: '#22b573',
    direction: '长春站 ↔ 长影世纪城',
    stations: [
      { stationId: 'st-03-01', name: '长春站', x: 554, y: 274, transfer: ['line-01'] },
      { stationId: 'st-03-02', name: '长白路', x: 505, y: 278 },
      { stationId: 'st-03-03', name: '辽宁路', x: 455, y: 284 },
      { stationId: 'st-03-04', name: '芙蓉桥', x: 405, y: 292 },
      { stationId: 'st-03-05', name: '西安桥', x: 358, y: 302 },
      { stationId: 'st-03-06', name: '南昌路', x: 318, y: 316 },
      { stationId: 'st-03-07', name: '朝阳桥', x: 300, y: 334 },
      { stationId: 'st-03-08', name: '湖西桥', x: 306, y: 362 },
      { stationId: 'st-03-09', name: '宽平桥', x: 314, y: 394, transfer: ['line-06'] },
      { stationId: 'st-03-10', name: '抚松路', x: 332, y: 424 },
      { stationId: 'st-03-11', name: '南湖广场', x: 362, y: 450 },
      { stationId: 'st-03-12', name: '辉南街', x: 390, y: 466 },
      { stationId: 'st-03-13', name: '前进西', x: 412, y: 480 },
      { stationId: 'st-03-14', name: '卫明街', x: 430, y: 488 },
      { stationId: 'st-03-15', name: '前进大街', x: 446, y: 494 },
      { stationId: 'st-03-16', name: '电台街', x: 462, y: 499 },
      { stationId: 'st-03-17', name: '硅谷大街', x: 498, y: 510 },
      { stationId: 'st-03-18', name: '吉林大学', x: 524, y: 513 },
      { stationId: 'st-03-19', name: '卫星广场', x: 552, y: 521, transfer: ['line-01'] },
      { stationId: 'st-03-20', name: '亚泰大街', x: 600, y: 524 },
      { stationId: 'st-03-21', name: '伊通河', x: 630, y: 526 },
      { stationId: 'st-03-22', name: '临河街', x: 660, y: 528 },
      { stationId: 'st-03-23', name: '职业学院', x: 714, y: 522, transfer: ['line-04'] },
      { stationId: 'st-03-24', name: '会展中心', x: 748, y: 556 },
      { stationId: 'st-03-25', name: '世纪广场', x: 786, y: 548, transfer: ['line-04'] },
      { stationId: 'st-03-26', name: '金鑫街', x: 820, y: 558 },
      { stationId: 'st-03-27', name: '博硕路', x: 848, y: 572 },
      { stationId: 'st-03-28', name: '金河街', x: 868, y: 590 },
      { stationId: 'st-03-29', name: '农博园', x: 882, y: 610 },
      { stationId: 'st-03-30', name: '净月潭公园', x: 892, y: 630 },
      { stationId: 'st-03-31', name: '紫杉路', x: 900, y: 650 },
      { stationId: 'st-03-32', name: '宝相街', x: 906, y: 670 },
      { stationId: 'st-03-33', name: '滑雪场', x: 910, y: 686 },
      { stationId: 'st-03-34', name: '长影世纪城', x: 914, y: 702, transfer: ['line-06'] }
    ]
  },
  {
    lineId: 'line-04',
    name: '轻轨4号线',
    shortName: '4号线',
    type: 'light-rail',
    color: '#9b59f6',
    direction: '长春站北 ↔ 天新路',
    stations: [
      { stationId: 'st-04-01', name: '长春站北', x: 552, y: 238, transfer: ['line-01'] },
      { stationId: 'st-04-02', name: '北亚泰大街', x: 575, y: 250 },
      { stationId: 'st-04-03', name: '伪满皇宫', x: 610, y: 254 },
      { stationId: 'st-04-04', name: '东大桥', x: 648, y: 268 },
      { stationId: 'st-04-23', name: '东新路', x: 674, y: 308 },
      { stationId: 'st-04-05', name: '吉林大路', x: 690, y: 360, transfer: ['line-02'] },
      { stationId: 'st-04-06', name: '公平路', x: 706, y: 398 },
      { stationId: 'st-04-07', name: '海口路', x: 718, y: 434 },
      { stationId: 'st-04-08', name: '浦东路', x: 728, y: 468 },
      { stationId: 'st-04-09', name: '北海路', x: 736, y: 500 },
      { stationId: 'st-04-10', name: '职业学院', x: 714, y: 522, transfer: ['line-03'] },
      { stationId: 'st-04-11', name: '世纪广场', x: 786, y: 548, transfer: ['line-03'] },
      { stationId: 'st-04-12', name: '吉林广电', x: 791, y: 568 },
      { stationId: 'st-04-13', name: '世荣路', x: 795, y: 588 },
      { stationId: 'st-04-14', name: '南环城路', x: 799, y: 608 },
      { stationId: 'st-04-15', name: '宜盛街', x: 803, y: 628 },
      { stationId: 'st-04-16', name: '天工路', x: 806, y: 648 },
      { stationId: 'st-04-17', name: '福祉大路', x: 810, y: 668, transfer: ['line-06'] },
      { stationId: 'st-04-18', name: '天青路', x: 813, y: 686 },
      { stationId: 'st-04-19', name: '亚泰足球基地', x: 815, y: 702 },
      { stationId: 'st-04-20', name: '天普路', x: 817, y: 716 },
      { stationId: 'st-04-21', name: '前十里堡', x: 818, y: 728 },
      { stationId: 'st-04-22', name: '天新路', x: 819, y: 738 }
    ]
  },
  {
    lineId: 'line-06',
    name: '地铁6号线',
    shortName: '6号线',
    type: 'metro',
    color: '#e58ab6',
    direction: '双丰 ↔ 长影世纪城',
    stations: [
      { stationId: 'st-06-01', name: '双丰', x: 200, y: 345, transfer: ['line-02'] },
      { stationId: 'st-06-02', name: '长春西站', x: 245, y: 342, transfer: ['line-02'] },
      { stationId: 'st-06-03', name: '腾跃广场', x: 254, y: 382 },
      { stationId: 'st-06-04', name: '支农大街', x: 274, y: 410 },
      { stationId: 'st-06-05', name: '宽平桥', x: 314, y: 394, transfer: ['line-03'] },
      { stationId: 'st-06-17', name: '欧亚卖场', x: 334, y: 446 },
      { stationId: 'st-06-18', name: '光谷大街', x: 352, y: 490 },
      { stationId: 'st-06-19', name: '硅谷广场', x: 384, y: 526 },
      { stationId: 'st-06-06', name: '孟家屯', x: 424, y: 546, transfer: ['line-07'] },
      { stationId: 'st-06-20', name: '百花园', x: 464, y: 556 },
      { stationId: 'st-06-21', name: '市法院', x: 500, y: 548 },
      { stationId: 'st-06-22', name: '兰桡湖公园', x: 526, y: 534 },
      { stationId: 'st-06-23', name: '轨道集团', x: 542, y: 502 },
      { stationId: 'st-06-09', name: '繁荣路', x: 553, y: 486, transfer: ['line-01'] },
      { stationId: 'st-06-24', name: '新明街', x: 602, y: 492 },
      { stationId: 'st-06-11', name: '南溪湿地', x: 694, y: 508 },
      { stationId: 'st-06-12', name: '福祉大路', x: 810, y: 668, transfer: ['line-04'] },
      { stationId: 'st-06-13', name: '吴家店', x: 842, y: 692 },
      { stationId: 'st-06-14', name: '樱花路', x: 868, y: 704 },
      { stationId: 'st-06-15', name: '省博物院', x: 894, y: 710 },
      { stationId: 'st-06-16', name: '长影世纪城', x: 914, y: 702, transfer: ['line-03'] }
    ]
  },
  {
    lineId: 'line-07',
    name: '地铁7号线',
    shortName: '7号线',
    type: 'metro',
    color: '#7d3ac1',
    direction: '汽车公园 ↔ 东环城路',
    status: '部分区段建设中',
    stations: [
      { stationId: 'st-07-01', name: '汽车公园', x: 60, y: 352, transfer: ['line-02'] },
      { stationId: 'st-07-02', name: '兴安路', x: 118, y: 368 },
      { stationId: 'st-07-03', name: '飞跃广场', x: 175, y: 386 },
      { stationId: 'st-07-04', name: '孟家屯', x: 424, y: 546, transfer: ['line-06'] },
      { stationId: 'st-07-17', name: '红旗街', x: 472, y: 514 },
      { stationId: 'st-07-08', name: '工农广场', x: 554, y: 450, transfer: ['line-01'] },
      { stationId: 'st-07-09', name: '东岭南街', x: 616, y: 432 },
      { stationId: 'st-07-10', name: '赛得广场', x: 664, y: 430 },
      { stationId: 'st-07-11', name: '威海路', x: 716, y: 426 },
      { stationId: 'st-07-12', name: '会展大街', x: 756, y: 418 },
      { stationId: 'st-07-14', name: '岭东路', x: 820, y: 396 },
      { stationId: 'st-07-15', name: '中东大市场', x: 830, y: 368 },
      { stationId: 'st-07-16', name: '东环城路', x: 758, y: 342, transfer: ['line-02'] }
    ]
  },
  {
    lineId: 'line-08',
    name: '轻轨8号线',
    shortName: '8号线',
    type: 'light-rail',
    color: '#17c3b2',
    direction: '北环城路 ↔ 地理所',
    stations: [
      { stationId: 'st-08-01', name: '北环城路', x: 546, y: 130, transfer: ['line-01'] },
      { stationId: 'st-08-12', name: '小城子街', x: 545, y: 116 },
      { stationId: 'st-08-02', name: '小南', x: 542, y: 101 },
      { stationId: 'st-08-03', name: '一二三中学', x: 537, y: 87 },
      { stationId: 'st-08-04', name: '和安街', x: 532, y: 74 },
      { stationId: 'st-08-05', name: '北湖大桥', x: 526, y: 63 },
      { stationId: 'st-08-06', name: '北湖公园', x: 518, y: 52 },
      { stationId: 'st-08-07', name: '光机路', x: 508, y: 42 },
      { stationId: 'st-08-08', name: '大学城路', x: 520, y: 30 },
      { stationId: 'st-08-09', name: '奥林匹克公园', x: 540, y: 24 },
      { stationId: 'st-08-10', name: '广通路', x: 560, y: 26 },
      { stationId: 'st-08-11', name: '地理所', x: 580, y: 34 }
    ]
  }
]

export function getLine(id) {
  return metroLines.find((l) => l.lineId === id)
}

export function getStation(stationId) {
  for (const line of metroLines) {
    const s = line.stations.find((s) => s.stationId === stationId)
    if (s) return { ...s, line, index: line.stations.indexOf(s) }
  }
  return null
}

export function getNeighbors(stationId) {
  const found = getStation(stationId)
  if (!found) return null
  const list = found.line.stations
  return {
    prev: found.index > 0 ? list[found.index - 1] : null,
    next: found.index < list.length - 1 ? list[found.index + 1] : null
  }
}

export function allStations() {
  const out = []
  for (const line of metroLines) {
    for (const s of line.stations) {
      out.push({ ...s, line, stationId: s.stationId })
    }
  }
  return out
}
