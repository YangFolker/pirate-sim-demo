const test=require('node:test');
const assert=require('node:assert/strict');
const Game=require('../engine.js'),DEFAULT=require('../config.js'),W=require('../world.js');
const config=()=>JSON.parse(JSON.stringify(DEFAULT));
const make=(seed=1644)=>new Game(config(),seed);
const clearEvent=g=>{if(g.s.event){const choices=g.choices();const choice=choices.find(c=>c.id==='leave')||choices.find(c=>c.id==='salute')||choices.find(c=>c.id==='flee');assert.ok(choice,`No peaceful choice for ${g.s.event.type}`);g.choose(choice.id);}};
function sail(g,to){const route=W.path(g.world,g.s,to);assert.ok(route.length);for(const step of route){clearEvent(g);assert.ok(g.move(step.x,step.y).ok);assert.equal(g.s.dead,null);}clearEvent(g);}

test('geography: every named port is reachable from Penghu',()=>{const g=make();for(const p of g.world.ports.filter(p=>p.id!=='penghu'))assert.ok(W.path(g.world,g.s,p).length,`${p.name} is isolated`);});
test('an entire peaceful grain voyage can be bought, shipped and delivered',()=>{const c=config();c.rules.encounterChance=0;c.rules.reefChance=0;const g=new Game(c,27);const home={...g.s};sail(g,g.world.ports.find(p=>p.id==='quanzhou'));assert.ok(g.trade('grain',12,'buy').ok);assert.equal(g.s.cargo.grain,12);sail(g,home);const crew=g.s.crew;assert.ok(g.deliverGrain().ok);assert.equal(g.s.quests.grain,true);assert.equal(g.s.cargo.grain,0);assert.equal(g.s.crew,crew+8);assert.equal(g.deliverGrain().ok,false);});
test('movement is one adjacent navigable tile, with one day and supply cost',()=>{const g=make(),p={...g.s},food=g.stats().food;assert.equal(g.move(p.x+3,p.y).ok,false);assert.equal(g.s.day,1);assert.ok(g.move(p.x+1,p.y).ok);assert.equal(g.s.day,2);assert.equal(g.s.supplies,p.supplies-food);assert.equal(g.move(p.x+2,p.y).ok,false);});
test('ship intelligence is restricted to 3x3 and reefs remain hidden until entered',()=>{const g=make(),x=g.s.x,y=g.s.y-1,c=g.world.get(x,y);c.reef=true;assert.equal(g.info(x,y).reef,false);assert.equal(g.info(g.s.x+2,g.s.y).visible,false);const hp=g.s.hp;g.move(x,y);assert.ok(g.s.hp<hp);assert.equal(g.info(x,y).reef,true);assert.ok(Object.keys(g.s.known).length>=9);});
test('escort grants nothing until destination, locks free movement, then rewards once',()=>{const c=config();c.rules.encounterChance=0;c.rules.reefChance=0;const g=new Game(c,99);g.move(g.s.x+1,g.s.y);assert.equal(g.s.event.contact.type,'merchant');g.choose('escort');const rep=g.s.rep.dutch,silver=g.s.silver;assert.equal(rep,0);assert.equal(g.s.silver,silver);assert.equal(g.move(g.s.x+1,g.s.y).ok,false);const reward=g.s.escort.reward;let limit=30;while(g.s.escort&&limit-->0){clearEvent(g);g.followEscort();}assert.ok(limit>0);assert.equal(g.s.rep.dutch,15);assert.equal(g.s.delivered,1);assert.ok(g.s.silver>=silver+reward-30);assert.equal(g.port().faction,'dutch');});
test('abandoning escort earns no faction reputation',()=>{const g=make();g.move(g.s.x+1,g.s.y);g.choose('escort');assert.ok(g.endEscort().ok);assert.equal(g.s.rep.dutch,0);assert.equal(g.s.delivered,0);});
test('flee discards ALL goods and aborts escort',()=>{const g=make();g.s.cargo={grain:8,silk:2,porcelain:3,spice:1};g.s.escort={route:[],faction:'dutch'};g.startCombat({name:'强敌',type:'pirate',hp:200,crew:80,damage:30});assert.ok(g.combatAction('flee').ok);assert.equal(g.occupied(),0);assert.equal(g.s.escort,null);assert.equal(g.s.combat,null);assert.equal(g.s.dead,null);});
test('combat victory loads prizes, and lethal counterfire permanently ends a run',()=>{const g=make();g.startCombat({name:'商船',type:'merchant',faction:'dutch',hp:1,crew:5,damage:3,cargo:'silk',amount:4});g.combatAction('cannon');assert.equal(g.s.cargo.silk,4);assert.equal(g.s.battles,1);g.s.event=null;g.s.hp=1;g.startCombat({name:'重舰',type:'pirate',hp:1000,crew:100,damage:100});g.combatAction('cannon');assert.ok(g.s.dead);assert.equal(g.service('repair').ok,false);assert.equal(g.move(g.s.x+1,g.s.y).ok,false);});
test('coastal raid offers fictional royal mission and Ningbo delivery pays once',()=>{const g=make();g.startCombat({name:'乡勇',type:'militia',faction:'ming',hp:1,crew:3,damage:1,cargo:'grain',amount:14});g.combatAction('cannon');assert.equal(g.s.event.type,'royal');g.choose('acceptRoyal');const p=g.world.ports.find(p=>p.id==='ningbo');Object.assign(g.s,{x:p.x,y:p.y});const before=g.s.silver;g.enterPort();assert.equal(g.s.quests.royal.status,'done');assert.equal(g.s.silver,before+180);g.enterPort();assert.equal(g.s.silver,before+180);});
test('a flag exposes the player to its foreign enemies, friendship alone does not',()=>{const g=make();g.s.rep.dutch=50;g.s.diplomacy['dutch:ming']=-60;const ming=g.world.ports.find(p=>p.id==='quanzhou');assert.equal(g.canDock(ming),true);assert.ok(g.setFlag('dutch').ok);assert.equal(g.canDock(ming),false);assert.ok(g.setFlag('none').ok);assert.equal(g.canDock(ming),true);});
test('nearby hostile vessels actively approach and eventually intercept',()=>{const g=make(),x=g.s.x+2,y=g.s.y;g.world.get(x,y).type='sea';g.s.contacts[W.key(x,y)]={name:'追击者',type:'pirate',hp:70,crew:20,damage:10};delete g.s.contacts[W.key(g.s.x+1,g.s.y)];g.s.day++;g.pursue();assert.equal(g.s.contacts[W.key(g.s.x+1,g.s.y)].name,'追击者');});
test('starvation and mutiny are terminal; wages deduct on schedule',()=>{const c=config();c.rules.mutinyChance=1;const g=new Game(c,11);g.s.supplies=1;g.wait();assert.ok(g.s.dead.includes('哗变'));const h=make();h.s.day=DEFAULT.rules.wageEvery;const coins=h.s.silver;h.advance();assert.equal(h.s.silver,coins-h.s.crew);});
test('plague applies once per outbreak and cannot kill already lost crew twice',()=>{const g=make();let p;for(let i=0;i<100&&!p;i++){g.s.day=1+i*7;p=g.world.ports.find(p=>g.plague(p));}assert.ok(p);Object.assign(g.s,{x:p.x,y:p.y,crew:30});g.enterPort();assert.equal(g.s.crew,20);g.enterPort();assert.equal(g.s.crew,20);});
test('modifications compete for slots; a full enlarged hold cannot be removed',()=>{const g=make();g.s.silver=2000;assert.ok(g.install('hold').ok);assert.ok(g.install('guns').ok);assert.ok(g.install('hull').ok);assert.equal(g.install('sails').ok,false);g.s.cargo.grain=40;assert.equal(g.uninstall('hold').ok,false);g.s.cargo.grain=0;assert.ok(g.uninstall('hold').ok);assert.equal(g.stats().capacity,DEFAULT.start.capacity);});
test('trade never permits negative quantities, overspending, overflow or overselling',()=>{const g=make(),before=g.s.silver;for(const qty of [-1,0,NaN,Infinity,999])assert.equal(g.trade('grain',qty,'buy').ok,false);assert.equal(g.s.silver,before);assert.equal(g.trade('silk',1,'sell').ok,false);assert.ok(g.trade('grain',1,'buy').ok);assert.ok(g.trade('grain',1,'sell').ok);assert.ok(g.s.silver<before);});
test('supply conversion consumes quest grain and respects the 100 cap',()=>{const g=make();g.s.cargo.grain=3;g.s.supplies=96;g.consumeGrain();assert.equal(g.s.supplies,100);assert.equal(g.s.cargo.grain,2);assert.equal(g.consumeGrain().ok,false);});
test('seeded histories are deterministic and saved combat resumes identically',()=>{const a=make(712),b=make(712);for(let i=0;i<16;i++){a.advance();b.advance();}assert.deepEqual(a.s,b.s);a.startCombat({name:'海盗',type:'pirate',hp:90,crew:30,damage:10,cargo:'grain',amount:5});a.combatAction('fire');const snapshot=a.export(),restored=new Game(snapshot.config,snapshot.state.seed,snapshot.state);a.combatAction('maneuver');restored.combatAction('maneuver');assert.deepEqual(a.s,restored.s);});
test('commission grants reward only after two victories against pirates',()=>{const g=make();g.s.quests.commission={kills:0,done:false};for(let i=0;i<2;i++){g.s.event=null;g.startCombat({name:'海盗',type:'pirate',hp:1,crew:1,damage:1,cargo:'grain',amount:1});g.combatAction('cannon');}assert.equal(g.s.quests.commission.done,true);assert.equal(g.s.quests.commission.kills,2);assert.ok(g.s.rep.ming>=35);});
test('numeric seeds entered through the parameter form reproduce the same run',()=>{assert.deepEqual(make(1644).s,make('1644').s);});
test('opening waters have only one tutorial merchant',()=>{const g=make();assert.equal(Object.values(g.s.contacts).length,1);assert.equal(Object.values(g.s.contacts)[0].type,'merchant');});
test('each port recruitment click hires exactly one sailor for five silver',()=>{
  for(const port of ['penghu','quanzhou']){
    const g=make(),p=g.world.ports.find(p=>p.id===port);Object.assign(g.s,{x:p.x,y:p.y});
    const before={crew:g.s.crew,silver:g.s.silver,day:g.s.day};
    for(let i=1;i<=3;i++){assert.ok(g.service('recruit').ok);assert.equal(g.s.crew,before.crew+i);assert.equal(g.s.silver,before.silver-5*i);assert.equal(g.s.day,before.day);}
  }
});
test('recruitment cannot overspend or exceed the crew limit',()=>{
  const g=make();g.s.silver=4;const crew=g.s.crew;
  assert.equal(g.service('recruit').ok,false);assert.equal(g.s.silver,4);assert.equal(g.s.crew,crew);
  g.s.silver=5;g.s.crew=g.s.crewMax-1;assert.ok(g.service('recruit').ok);assert.equal(g.s.silver,0);assert.equal(g.s.crew,g.s.crewMax);
  g.s.silver=100;assert.equal(g.service('recruit').ok,false);assert.equal(g.s.silver,100);
});
test('morale scales linearly with wages regardless of cash and crew count',()=>{
  const g=make();
  for(const [rate,value,power] of [[0,0,.5],[.5,25,.625],[1,50,.75],[1.5,75,.875],[2,100,1]]){
    assert.ok(g.setWage(rate).ok);
    for(const [silver,crew] of [[0,16],[40,20],[400,50]]){
      g.s.silver=silver;g.s.crew=crew;
      assert.equal(g.morale().value,value);assert.equal(g.morale().power,power);
    }
  }
});

test('low morale reduces actual damage for all four battle actions',()=>{
  for(const action of ['cannon','board','maneuver','fire']){
    const rich=make(100),poor=make(100);rich.setWage(2);poor.setWage(0);
    for(const g of [rich,poor])g.startCombat({name:'测试敌船',type:'pirate',hp:1000,crew:12,damage:1});
    rich.combatAction(action);poor.combatAction(action);
    const full=1000-rich.s.combat.enemy.hp,low=1000-poor.s.combat.enemy.hp;
    assert.ok(low>0&&low<full,`${action}: ${low} should be below ${full}`);
    assert.equal(rich.s.hp,poor.s.hp,'enemy damage does not gain an extra morale penalty');
  }
});
test('recruitment, trading, upgrades and payday do not alter wage-based morale',()=>{
  const g=make();g.s.silver=1000;g.setWage(1.5);const value=g.morale().value;
  assert.ok(g.service('recruit').ok);assert.equal(g.morale().value,value);
  g.s.cargo.silk=1;assert.ok(g.trade('silk',1,'sell').ok);assert.equal(g.morale().value,value);
  assert.ok(g.install('guns').ok);assert.equal(g.morale().value,value);
  g.s.day=g.config.rules.wageEvery;g.advance();assert.equal(g.morale().value,value);
});

test('legacy morale and out-of-range wages migrate without resetting the voyage',()=>{
  const g=make();g.s.day=23;g.s.silver=0;g.s.crew=34;g.s.modules=['guns'];g.config.rules.supplyUse=4;
  for(const legacyRate of [undefined,0,1,2.3,5]){
    const snapshot=g.export();snapshot.config.rules.wagePerCrew=legacyRate;
    snapshot.config.morale={silverPerCrew:9,minPower:.6};
    const restored=new Game(snapshot.config,snapshot.state.seed,snapshot.state);
    assert.deepEqual(restored.s,snapshot.state);assert.deepEqual(restored.config.morale,{minPower:.6});
    assert.equal(restored.config.rules.supplyUse,4);
    assert.equal(restored.payroll().rate,legacyRate===undefined?1:Math.min(2,legacyRate));
    assert.equal(restored.morale().value,restored.payroll().rate*50);
    assert.equal(restored.stats().baseDamage,19);
  }
  const snapshot=g.export();delete snapshot.config.morale;
  const restored=new Game(snapshot.config,snapshot.state.seed,snapshot.state);
  assert.deepEqual(restored.config.morale,DEFAULT.morale);assert.deepEqual(restored.s,snapshot.state);
  assert.equal(restored.stats().damage,14);
});

test('hull and cannon upgrades change the matching ship stats and are not stackable',()=>{
  const g=make();g.s.silver=1000;g.setWage(2);const before=g.stats();
  assert.ok(g.install('hull').ok);assert.equal(g.stats().maxHp,before.maxHp+30);assert.equal(g.s.hp,130);assert.equal(g.stats().armor,2);
  assert.ok(g.install('guns').ok);assert.equal(g.stats().damage,before.damage+8);assert.equal(g.s.silver,795);
  assert.equal(g.install('guns').ok,false);assert.equal(g.s.silver,795);
});
test('changing wages updates morale immediately without spending or changing payday',()=>{
  const g=make();g.s.day=3;const before=JSON.parse(JSON.stringify(g.s));
  assert.ok(g.setWage(2).ok);assert.equal(g.s.silver,before.silver);assert.equal(g.s.day,3);assert.equal(g.s.crew,before.crew);
  assert.equal(g.morale().value,100);assert.equal(g.morale().power,1);
  assert.equal(g.payroll().nextDay,7);assert.equal(g.payroll().daysUntil,4);assert.equal(g.payroll().total,32);
  assert.ok(g.setWage(.5).ok);assert.equal(g.morale().value,25);assert.equal(g.payroll().nextDay,7);assert.equal(g.payroll().total,8);
});

test('the next payday uses the saved current rate and the crew count at payment',()=>{
  const g=make();g.setWage(1.5);g.service('recruit');g.s.day=5;
  const money=g.s.silver;g.advance();assert.equal(g.s.silver,money);
  assert.equal(g.payroll().total,26);g.advance();assert.equal(g.s.silver,money-26);assert.equal(g.payroll().nextDay,13);
});
test('payroll rounds fractional silver up without floating-point overcharging',()=>{
  const g=make();g.s.crew=50;g.setWage(1.1);assert.equal(g.payroll().total,55);
  g.s.day=6;const coins=g.s.silver;g.advance();assert.equal(g.s.silver,coins-55);
  g.s.crew=25;g.setWage(.5);assert.equal(g.payroll().total,13);
  g.setWage(0);assert.equal(g.payroll().total,0);
});
test('wage adjustments persist in saved voyages but not in new-game defaults',()=>{
  const initial=config(),g=new Game(initial,99);g.s.day=9;g.setWage(1.7);const save=g.export();
  const restored=new Game(save.config,save.state.seed,save.state);
  assert.equal(restored.payroll().rate,1.7);assert.equal(restored.morale().value,85);assert.equal(restored.payroll().nextDay,13);assert.deepEqual(restored.s,g.s);
  assert.equal(new Game(initial,99).payroll().rate,DEFAULT.rules.wagePerCrew);
});
test('invalid or post-game wage changes leave the saved rate unchanged',()=>{
  const g=make();for(const rate of [-1,2.1,2.5,5,5.1,Infinity,NaN,'2',null,1.23]){
    assert.equal(g.setWage(rate).ok,false);assert.equal(g.payroll().rate,1);
  }
  g.die('测试结束');assert.equal(g.setWage(2).ok,false);assert.equal(g.payroll().rate,1);
});
test('insufficient payroll spends available silver without resignations or negative cash',()=>{
  const g=make();g.s.silver=10;g.setWage(2);assert.equal(g.payroll().total,32);g.s.day=6;g.advance();
  assert.equal(g.s.silver,0);assert.equal(g.s.crew,16);assert.equal(g.s.dead,null);
  assert.equal(g.payroll().rate,2);assert.equal(g.morale().value,100);
  assert.ok(g.s.log.some(entry=>entry.text.includes('应发 32 两，实发 10 两，缺额 22 两')));
});
test('zero wages never dismiss sailors over multiple paydays',()=>{
  const g=make();g.s.silver=0;g.setWage(0);const crew=g.s.crew;
  for(let day=0;day<18;day++){
    g.s.supplies=100;assert.ok(g.advance());
    assert.equal(g.s.silver,0);assert.equal(g.s.crew,crew);assert.equal(g.s.dead,null);
    assert.equal(g.morale().value,0);assert.equal(g.morale().power,.5);
  }
  assert.equal(g.s.log.filter(entry=>entry.text.includes('本期工资为 0 两')).length,3);
});
