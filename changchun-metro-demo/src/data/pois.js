import { metroLines } from './metroLines.js'

export const poiCategories = [
  { id: 'history', name: '历史文化', color: '#d4a556' },
  { id: 'nature', name: '自然风光', color: '#4ade80' },
  { id: 'art', name: '艺术文化', color: '#c084fc' },
  { id: 'commerce', name: '商业休闲', color: '#38bdf8' },
  { id: 'family', name: '亲子乐园', color: '#fb7185' },
  { id: 'citymark', name: '城市地标', color: '#fbbf24' }
]

export function getCategory(id) {
  return poiCategories.find((c) => c.id === id) || poiCategories[0]
}

export const pois = [
  {
    poiId: 'poi-001',
    name: '伪满皇宫博物院',
    category: 'history',
    districtId: 'district-kuancheng',
    stationIds: ['st-04-03'],
    x: 614, y: 244,
    duration: '2-3小时',
    tickets: '成人票 70元，需提前预约',
    openTime: '8:30-16:50（周一闭馆）',
    summary: '中国现存较完整的宫殿遗址之一，见证东北十四年沦陷历史。',
    detail: '伪满皇宫博物院建立在清朝末代皇帝爱新觉罗·溥仪充当伪满洲国傀儡皇帝时的宫廷旧址上，是集宫廷遗址、历史文物陈列于一体的遗址型博物馆。缉熙楼、勤民楼、同德殿等建筑保存完好，陈列大量历史实物与影像资料，是理解长春近代史最重要的一站。',
    tags: ['国家5A级景区', '全国重点文保', '爱国主义教育'],
    food: [],
    stationGuide: { station: 'st-04-03', exit: '轻轨4号线伪满皇宫站即达', walk: '出站步行约300米' },
    hot: true
  },
  {
    poiId: 'poi-002',
    name: '净月潭国家森林公园',
    category: 'nature',
    districtId: 'district-jingyue',
    stationIds: ['st-03-30', 'st-03-33'],
    x: 896, y: 642,
    duration: '半天',
    tickets: '门票 30元',
    openTime: '8:00-17:00',
    summary: '亚洲最大人工林海环绕一泓碧水，长春人的城市后花园。',
    detail: '净月潭因形似弯月而得名，与台湾日月潭互为姊妹潭。景区拥有近百平方公里的森林与水面，四季皆宜：春踏青、夏避暑、秋赏叶、冬玩雪，瓦萨国际滑雪节每年在此举行，滑雪场站直达雪场入口。适合骑行环潭、乘船游湖或登山远眺。',
    tags: ['国家5A级景区', '森林氧吧', '四季皆宜'],
    food: [],
    stationGuide: { station: 'st-03-28', exit: '轻轨3号线净月潭公园站', walk: '正门步行约15分钟；滑雪场站直达雪场' },
    hot: true
  },
  {
    poiId: 'poi-003',
    name: '长影世纪城',
    category: 'family',
    districtId: 'district-jingyue',
    stationIds: ['st-03-34', 'st-06-16'],
    x: 908, y: 694,
    duration: '半天',
    tickets: '通票 198元',
    openTime: '9:00-17:00（季节浮动）',
    summary: '中国首家电影主题公园，特效大片体验一票通玩。',
    detail: '长影世纪城依托长春电影制片厂的电影工业底蕴打造，集 4D 特效、巨幕影院、实景演出与影视体验项目于一体，被称为"东方好莱坞"。轻轨3号线与6号线在终点站长影世纪城站交汇，适合亲子与年轻人游玩，冬季另有冰雪体验项目。',
    tags: ['电影主题', '特效体验', '亲子友好'],
    food: [],
    stationGuide: { station: 'st-03-32', exit: '轻轨3/6号线长影世纪城站终点即达', walk: '出站步行约300米' },
    hot: true
  },
  {
    poiId: 'poi-004',
    name: '长春世界雕塑园',
    category: 'art',
    districtId: 'district-nanguan',
    stationIds: ['st-01-11', 'st-06-09'],
    x: 570, y: 492,
    duration: '2-3小时',
    tickets: '公园免费，展馆联票约 30元',
    openTime: '8:00-17:00（冬季至16:30）',
    summary: '汇集五大洲雕塑作品的城市艺术公园，罗丹真品值得专程前往。',
    detail: '长春世界雕塑园是国家5A级景区，园内陈列来自两百多个国家和地区的雕塑作品，罗丹的思想者真品即收藏于此。人工湖、绿地与雕塑交融，秋季金色杨林环绕湖岸尤为出片。1号线与6号线在繁荣路站交汇双线可达。',
    tags: ['国家5A级景区', '户外雕塑', '罗丹真品'],
    food: [],
    stationGuide: { station: 'st-01-11', exit: '地铁1/6号线繁荣路站', walk: '约400米，步行6分钟' },
    hot: true
  },
  {
    poiId: 'poi-005',
    name: '南湖公园',
    category: 'nature',
    districtId: 'district-chaoyang',
    stationIds: ['st-03-11', 'st-07-07'],
    x: 382, y: 452,
    duration: '2-3小时',
    tickets: '免费',
    openTime: '全天开放',
    summary: '全国第二大市内公园，夏划船冬滑冰的长春记忆。',
    detail: '南湖公园水面面积占全园三分之一，湖畔垂柳与白桦是长春四季的代表画面。冬季湖面成为天然冰场，夏季可乘船游湖，四亭桥、湖心岛是经典机位。公园北门衔接新民大街历史街区，适合串联游览。',
    tags: ['免费', '城市湖泊', '四季皆宜'],
    food: [],
    stationGuide: { station: 'st-03-11', exit: '轻轨3/7号线南湖广场站', walk: '约350米，步行5分钟' },
    hot: false
  },
  {
    poiId: 'poi-006',
    name: '这有山',
    category: 'commerce',
    districtId: 'district-chaoyang',
    stationIds: ['st-01-09', 'st-01-10'],
    x: 524, y: 420,
    duration: '2-4小时',
    tickets: '免费进入，项目单独消费',
    openTime: '10:30-22:00',
    summary: '把"山"搬进商场的室内文商旅综合体，夜游打卡顶流。',
    detail: '这有山以室内山丘小镇为概念，盘山步道串联小吃、文创、书店、剧场与观景台，山顶问蟾亭可俯瞰整个空间。开业以来成为长春年轻人夜生活与游客打卡的双重地标，建议傍晚前往，顺路体验红旗街商圈。',
    tags: ['网红打卡', '室内小镇', '夜游'],
    food: ['山中小吃集合', '文创茶饮', '新派东北菜'],
    stationGuide: { station: 'st-01-09', exit: '地铁1号线东北师大站 D口', walk: '约500米，步行8分钟' },
    hot: true
  },
  {
    poiId: 'poi-007',
    name: '桂林路商圈',
    category: 'commerce',
    districtId: 'district-chaoyang',
    stationIds: ['st-01-10'],
    x: 580, y: 418,
    duration: '2-3小时',
    tickets: '免费',
    openTime: '全天，夜市至22:00后',
    summary: '老牌美食街区，烧烤、锅包肉与朝鲜族风味的主战场。',
    detail: '桂林路由胡同巷弄构成，汇聚东北烧烤、冷面、锅包肉与新式咖啡小店，是本地人从小吃到大的"深夜食堂"。傍晚人气最旺，与同志街、红旗街形成大商圈动线。',
    tags: ['美食街区', '夜市', '本地烟火气'],
    food: ['朝鲜族冷面', '锅包肉', '东北烧烤', '老昌春饼'],
    stationGuide: { station: 'st-01-10', exit: '地铁1号线工农广场站 A口', walk: '约400米，步行6分钟' },
    hot: false
  },
  {
    poiId: 'poi-008',
    name: '文化广场',
    category: 'citymark',
    districtId: 'district-chaoyang',
    stationIds: ['st-02-12'],
    x: 530, y: 348,
    duration: '1-2小时',
    tickets: '免费',
    openTime: '全天开放',
    summary: '长春的城市客厅，地质宫与蓝天白鸽构成经典画面。',
    detail: '文化广场北倚伪满时期留下的地质宫主楼，中轴对称的广场设计开阔大气，放风筝、喂鸽子是本地人的日常。广场南侧衔接新民大街历史建筑群，适合作为老城漫步的起点。',
    tags: ['城市客厅', '免费', '历史建筑背景'],
    food: [],
    stationGuide: { station: 'st-02-12', exit: '地铁2号线文化广场站 A口', walk: '约150米，步行2分钟' },
    hot: false
  },
  {
    poiId: 'poi-009',
    name: '新民大街历史建筑群',
    category: 'history',
    districtId: 'district-chaoyang',
    stationIds: ['st-02-12', 'st-02-13'],
    x: 516, y: 342,
    duration: '1-2小时',
    tickets: '免费（部分场馆需预约）',
    openTime: '街区全天开放',
    summary: '伪满时期"官厅街"，一条大街读懂半部长春近代史。',
    detail: '新民大街全长约1500米，两侧保留伪满国务院、军事部等历史建筑，风格庄重独特。如今多为医院与高校使用，梧桐掩映下的老建筑适合慢行细读，与地质宫、文化广场形成完整动线。',
    tags: ['历史街区', '建筑摄影', '免费'],
    food: [],
    stationGuide: { station: 'st-02-12', exit: '地铁2号线文化广场站 B口南行', walk: '街区起点约200米' },
    hot: false
  },
  {
    poiId: 'poi-010',
    name: '长春动植物公园',
    category: 'family',
    districtId: 'district-nanguan',
    stationIds: ['st-01-12'],
    x: 568, y: 532,
    duration: '半天',
    tickets: '门票 30元，熊猫馆另计',
    openTime: '8:00-17:00（夜场季节性开放）',
    summary: '卫星广场旁的老牌动物园，大熊猫与"西游记主题"夜游出圈。',
    detail: '长春动植物公园始建于1938年，园内动物种类丰富，近年以国宝大熊猫和沉浸式西游主题夜游爆红。园区绿化率高，适合亲子半日游，可与人民广场、桂林路串联。',
    tags: ['亲子友好', '大熊猫', '主题夜游'],
    food: [],
    stationGuide: { station: 'st-01-12', exit: '地铁1号线卫星广场站 B口东北行', walk: '约250米，步行4分钟' },
    hot: true
  },
  {
    poiId: 'poi-011',
    name: '长影旧址博物馆',
    category: 'art',
    districtId: 'district-chaoyang',
    stationIds: ['st-03-09', 'st-06-05'],
    x: 332, y: 386,
    duration: '2小时',
    tickets: '门票 90元（含讲解）',
    openTime: '9:00-17:00（周一闭馆）',
    summary: '"新中国电影摇篮"的原厂旧址，胶片时代的完整记忆。',
    detail: '长春电影制片厂是新中国电影的摇篮，旧址博物馆保留了原始摄影棚、混录棚与道具库，陈列大量经典影片的手稿与器材。电影艺术馆与摄影棚片区可分组参观，影迷不可错过，出馆后可乘54路有轨电车体验老长春风情。',
    tags: ['电影摇篮', '工业遗址', '博物馆'],
    food: [],
    stationGuide: { station: 'st-03-09', exit: '轻轨3/6号线宽平桥站北行', walk: '约300米，步行4分钟' },
    hot: false
  },
  {
    poiId: 'poi-012',
    name: '红旗街商圈',
    category: 'commerce',
    districtId: 'district-chaoyang',
    stationIds: ['st-07-07', 'st-03-11'],
    x: 470, y: 432,
    duration: '2-4小时',
    tickets: '免费',
    openTime: '商场 10:00-21:30',
    summary: '长春最具烟火气的老牌商圈，购物美食一站集齐。',
    detail: '红旗街汇集大型商场、老字号餐饮与潮流小店，54路有轨电车穿街而过构成独特画面。与这有山、长影旧址博物馆相邻，是朝阳区citywalk的核心节点。',
    tags: ['商圈', '有轨电车', '美食'],
    food: ['老韩头豆腐串', '长春酱骨', '鼎丰真糕点'],
    stationGuide: { station: 'st-07-07', exit: '地铁7号线南湖广场站', walk: '约350米，步行5分钟' },
    hot: false
  },
  {
    poiId: 'poi-013',
    name: '吉林省博物院',
    category: 'art',
    districtId: 'district-jingyue',
    stationIds: ['st-06-15'],
    x: 900, y: 672,
    duration: '2-3小时',
    tickets: '免费，需预约',
    openTime: '9:00-16:30（周一闭馆）',
    summary: '东北三省馆藏重镇，高句丽与渤海国文物值得细看。',
    detail: '吉林省博物院新馆位于净月开发区，6 号线省博物院站直达。馆藏历代书画、东北民族文物与近现代革命文物，尤以高句丽、渤海国时期遗存和东北抗联史料最具特色。与长影世纪城、净月潭可组成净月一日游。',
    tags: ['免费', '省级大馆', '需预约'],
    food: [],
    stationGuide: { station: 'st-06-15', exit: '地铁6号线省博物院站即达', walk: '出站步行约200米' },
    hot: false
  },
  {
    poiId: 'poi-014',
    name: '长春公园',
    category: 'nature',
    districtId: 'district-lvyuan',
    stationIds: ['st-02-07'],
    x: 296, y: 362,
    duration: '1-2小时',
    tickets: '免费',
    openTime: '全天开放',
    summary: '郁金香花海闻名全市，春季赏花首选。',
    detail: '长春公园以郁金香主题花展著称，每年五月数十万株郁金香同时开放。园内玫瑰园、药用植物园与台地花园分区明确，四季有景，是绿园区居民的后花园。',
    tags: ['免费', '花卉主题', '春季限定'],
    food: [],
    stationGuide: { station: 'st-02-08', exit: '地铁2号线和平大街站 B口南行', walk: '约450米，步行7分钟' },
    hot: false
  },
  {
    poiId: 'poi-015',
    name: '儿童公园',
    category: 'family',
    districtId: 'district-chaoyang',
    stationIds: ['st-01-08'],
    x: 538, y: 386,
    duration: '1-2小时',
    tickets: '免费（园内项目另计）',
    openTime: '全天开放',
    summary: '解放大路旁的老牌公园，牡丹与游乐设施陪伴几代长春孩子。',
    detail: '儿童公园紧邻人民大街，春季牡丹花展是招牌，园内保留传统游乐设施与沙池。面积不大但位置极佳，适合与人民广场、桂林路组成轻松的半日动线。',
    tags: ['免费', '亲子友好', '牡丹花展'],
    food: [],
    stationGuide: { station: 'st-01-08', exit: '地铁1号线解放大路站 B口南侧', walk: '约350米，步行5分钟' },
    hot: false
  },
  {
    poiId: 'poi-016',
    name: '胜利公园',
    category: 'citymark',
    districtId: 'district-kuancheng',
    stationIds: ['st-01-06'],
    x: 574, y: 304,
    duration: '1小时',
    tickets: '免费（园内项目另计）',
    openTime: '全天开放',
    summary: '长春站南门第一公园，百年历史的城市地标。',
    detail: '胜利公园始建于1915年，是长春最早的公园之一，正门与长春站遥遥相望。园内湖景、摩天轮与雪雕（冬季）构成站前经典画面，适合抵达长春后的第一站。',
    tags: ['百年公园', '免费', '站前地标'],
    food: [],
    stationGuide: { station: 'st-01-06', exit: '地铁1号线胜利公园站 A口即达', walk: '约250米' },
    hot: false
  },
  {
    poiId: 'poi-017',
    name: '南溪湿地公园',
    category: 'nature',
    districtId: 'district-nanguan',
    stationIds: ['st-06-11'],
    x: 704, y: 516,
    duration: '2小时',
    tickets: '免费',
    openTime: '全天开放',
    summary: '伊通河畔的城市湿地，木栈道与芦苇荡的宝藏散步地。',
    detail: '南溪湿地公园沿伊通河延展，水系、芦苇与木栈道构成城市中的自然飞地，白鹭等水鸟常驻。6 号线南溪湿地站直达，傍晚灯光亮起后适合骑行与夜跑，是本地人推荐度上升最快的新晋休闲地。',
    tags: ['免费', '湿地公园', '骑行友好'],
    food: [],
    stationGuide: { station: 'st-06-11', exit: '地铁6号线南溪湿地站即达', walk: '出站步行约200米' },
    hot: false
  },
  {
    poiId: 'poi-018',
    name: '长春国际汽车公园',
    category: 'nature',
    districtId: 'district-lvyuan',
    stationIds: ['st-02-01', 'st-07-01'],
    x: 78, y: 362,
    duration: '2小时',
    tickets: '免费',
    openTime: '全天开放',
    summary: '以汽车文化为主题的湖畔公园，2/7号线西端起点直达。',
    detail: '长春国际汽车公园围绕汽车工业主题布置雕塑与展陈，湖面开阔绿道成环，与一汽厂区历史相呼应。游客较少、空间开阔，适合喜欢安静散步与工业文化主题的旅行者。',
    tags: ['免费', '汽车文化', '小众'],
    food: [],
    stationGuide: { station: 'st-02-01', exit: '地铁2/7号线汽车公园站 A口即达', walk: '约250米，步行4分钟' },
    hot: false
  },
  {
    poiId: 'poi-019',
    name: '北湖国家湿地公园',
    category: 'nature',
    districtId: 'district-kuancheng',
    stationIds: ['st-08-06'],
    x: 510, y: 48,
    duration: '半天',
    tickets: '免费（园内交通另计）',
    openTime: '8:00-17:30',
    summary: '长春北部的湖沼湿地，轻轨8号线直达的芦花观赏地。',
    detail: '北湖国家湿地公园以大面积水域和湿地植被著称，秋季芦花飞雪是长春摄影圈的年度盛事。轻轨8号线北湖公园站下车即达园区，园内可乘观光车、骑行或乘船，适合安排半天远离市区的自然之旅。',
    tags: ['免费', '湿地公园', '秋季限定'],
    food: [],
    stationGuide: { station: 'st-08-06', exit: '轻轨8号线北湖公园站', walk: '出站步行约400米' },
    hot: false
  },
  {
    poiId: 'poi-020',
    name: '长拖1968文创园',
    category: 'art',
    districtId: 'district-erdao',
    stationIds: ['st-02-17'],
    x: 748, y: 326,
    duration: '1-2小时',
    tickets: '免费',
    openTime: '10:00-21:00',
    summary: '老拖拉机厂厂房改造的文创街区，工业风出片地。',
    detail: '长拖1968由原长春拖拉机厂厂区改造而来，红砖厂房、巨型桁架与现代餐饮、展览、市集碰撞出强烈的年代感。夜间灯光下尤具氛围，是二道区城市更新的代表作。',
    tags: ['工业风', '文创市集', '夜景'],
    food: [],
    stationGuide: { station: 'st-02-17', exit: '地铁2号线东盛大街站 B口东行', walk: '约350米，步行5分钟' },
    hot: true
  },
  {
    poiId: 'poi-021',
    name: '东北民族民俗博物馆',
    category: 'history',
    districtId: 'district-jingyue',
    stationIds: ['st-03-25', 'st-04-11'],
    x: 790, y: 566,
    duration: '1-2小时',
    tickets: '免费',
    openTime: '9:00-16:30（周一闭馆）',
    summary: '东北亚民族与民俗的集中呈现，世纪广场旁的文化宝藏。',
    detail: '东北民族民俗博物馆毗邻世纪广场，系统展示东北地区满族、蒙古族、朝鲜族等民族的民俗文物与生活场景，四合院式展馆本身就是一道风景。与长春国际会展中心相邻，适合与净月线串联游览。',
    tags: ['免费', '民俗文化', '室内展馆'],
    food: [],
    stationGuide: { station: 'st-03-23', exit: '轻轨3/4号线世纪广场站', walk: '约250米，步行4分钟' },
    hot: false
  },
  {
    poiId: 'poi-022',
    name: '长春国际会展中心',
    category: 'citymark',
    districtId: 'district-jingyue',
    stationIds: ['st-03-24'],
    x: 756, y: 570,
    duration: '1-2小时',
    tickets: '免费（展会期间以主办方为准）',
    openTime: '依展会安排',
    summary: '东北大型会展综合体，车展、农博会等年度盛会举办地。',
    detail: '长春国际会展中心位于伊通河东岸，是长春国际车展、农博会等大型展会的举办地。无展会时外观与广场亦适合打卡，与世纪广场商圈、南溪湿地形成东部动线。',
    tags: ['会展地标', '年度盛会', '轻轨直达'],
    food: [],
    stationGuide: { station: 'st-03-22', exit: '轻轨3号线会展中心站', walk: '出站步行约200米' },
    hot: false
  },
  {
    poiId: 'poi-023',
    name: '伊通河沿岸风光带',
    category: 'nature',
    districtId: 'district-nanguan',
    stationIds: ['st-03-21'],
    x: 642, y: 538,
    duration: '1-2小时',
    tickets: '免费',
    openTime: '全天开放',
    summary: '贯穿长春的母亲河，滨水绿道串起城市风景线。',
    detail: '伊通河是长春的母亲河，沿岸绿道、桥梁与夜景灯光带构成城市休闲主轴。轻轨3号线伊通河站下车即达河岸，从南溪湿地到北大桥可骑行或漫步，黄昏时分尤美。',
    tags: ['免费', '滨水绿道', '夜景'],
    food: [],
    stationGuide: { station: 'st-03-19', exit: '轻轨3号线伊通河站即达', walk: '出站步行约200米' },
    hot: false
  }
]

export function getPoi(id) {
  return pois.find((p) => p.poiId === id)
}

export function poisByStation(stationId) {
  return pois.filter((p) => p.stationIds.includes(stationId))
}

export function poisByLine(lineId) {
  return pois.filter((p) => p.stationIds.some((sid) => {
    for (const line of metroLines) {
      if (line.stations.some((s) => s.stationId === sid)) return line.lineId === lineId
    }
    return false
  }))
}

export function poisByDistrict(districtId) {
  return pois.filter((p) => p.districtId === districtId)
}

export function relatedPois(poi, count = 3) {
  return pois
    .filter((p) => p.poiId !== poi.poiId)
    .map((p) => ({
      poi: p,
      score: (p.districtId === poi.districtId ? 2 : 0) + (p.category === poi.category ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.poi)
}
