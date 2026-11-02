/* 可直接修改的数据文件；常用数值也能在游戏右上角「参数与素材」中调整。 */
(function (root) {
  const CONFIG = {
    version: 1,
    title: '澎湖海路',
    startYear: 1644,
    start: { hp: 100, supplies: 85, silver: 150, crew: 16, capacity: 28, crewMax: 50, slots: 3 },
    rules: { supplyUse: 2, crewFoodPer: 20, wageEvery: 6, wagePerCrew: 1, starvationLoss: 3, mutinyChance: 0.12, encounterChance: 0.42, reefChance: 0.065, diplomacyEvery: 8, grainGoal: 12, plagueLoss: 10, flagThreshold: 25, hostilityThreshold: -25 },
    assets: { ship: 'assets/ship.svg', portrait: 'assets/captain.svg' },
    goods: [
      { id: 'grain', name: '粮食', unit: '担', base: 9, icon: '穀', color: '#c9a552', description: '运回澎湖交付，也可在船舱中转为补给。' },
      { id: 'silk', name: '丝绸', unit: '匹', base: 31, icon: '帛', color: '#c77d70', description: '福建出产，海外港口往往愿出高价。' },
      { id: 'porcelain', name: '瓷器', unit: '箱', base: 23, icon: '瓷', color: '#82aba4', description: '沿海收购，向南方港口贩运。' },
      { id: 'spice', name: '香料', unit: '箱', base: 27, icon: '香', color: '#a69b6b', description: '南洋货物，在北方需求较高。' }
    ],
    factions: [
      { id: 'ming', name: '大明', short: '明', color: '#be6953' },
      { id: 'japan', name: '德川幕府', short: '日', color: '#c6b692' },
      { id: 'dutch', name: '荷兰商馆', short: '荷', color: '#d49a52' },
      { id: 'iberian', name: '西班牙商馆', short: '西', color: '#9b89ab' }
    ],
    relations: { 'dutch:japan': 40, 'dutch:ming': -15, 'iberian:ming': 10, 'dutch:iberian': -45, 'japan:ming': -5, 'iberian:japan': -40 },
    modules: [
      { id: 'hold', name: '扩建货舱', cost: 85, description: '货舱 +16，逃跑时弃货损失更大。', capacity: 16 },
      { id: 'guns', name: '增设舷炮', cost: 110, description: '炮击伤害 +8，占用一个改装位。', damage: 8 },
      { id: 'hull', name: '加固船壳', cost: 95, description: '船体上限 +30，受到伤害 −2。', hp: 30, armor: 2 },
      { id: 'sails', name: '轻帆索具', cost: 80, description: '每日补给消耗 −1，战斗机动更有效。', food: -1, dodge: 0.2 }
    ],
    morale: { minPower: 0.5 },
    combat: { cannonBase: 11, boardCrewFactor: 0.75, enemyBase: 10, fireDamage: 7 },
    events: [
      { id: 'calm', title: '风平浪静', text: '海面只有帆影和浪纹。今天平安无事，前路仍在雾中。' },
      { id: 'wreck', title: '漂来的残骸', text: '浪间浮着木箱与断桅。水手等着你决定是否打捞。' },
      { id: 'survivors', title: '海上的求救声', text: '三名落水者攀着翻覆的小舟。带上他们会增加口粮与工资开销。' },
      { id: 'legend', title: '深水下的影子', text: '船底掠过巨大的黑影。老水手说，那是海中龙王在巡游。' },
      { id: 'zheng', title: '郑氏的船', text: '一艘悬着郑氏旗号的海船靠近。管事替郑芝龙传话：海上买卖，最重信义。' }
    ]
  };
  root.PIRATE_CONFIG = CONFIG;
  if (typeof module !== 'undefined') module.exports = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
