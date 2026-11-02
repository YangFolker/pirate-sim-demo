(function(root){
  'use strict';
  const W=typeof module!=='undefined'?require('./world.js'):root.PirateWorld;
  const DEFAULT=typeof module!=='undefined'?require('./config.js'):root.PIRATE_CONFIG;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const pair=(a,b)=>[a,b].sort().join(':');
  class Game {
    constructor(config=DEFAULT,seed=Date.now(),saved=null){
      this.config=clone(config);
      // 旧存档没有士气配置时补默认值，保留所有航程状态与个人数值。
      this.config.morale={...DEFAULT.morale,...config.morale};
      delete this.config.morale.silverPerCrew;
      const legacyWage=this.config.rules.wagePerCrew;
      this.config.rules.wagePerCrew=Number.isFinite(legacyWage)?Math.round(clamp(legacyWage,0,2)*10)/10:DEFAULT.rules.wagePerCrew;
      this.seed=typeof seed==='number'||/^\d+$/.test(String(seed))?Number(seed)>>>0:Array.from(String(seed)).reduce((a,c)=>Math.imul(a,31)+c.charCodeAt(0),7)>>>0;
      if(saved)this.seed=saved.seed;
      this.world=W.create(this.seed,this.config);
      this.state=saved?clone(saved):{
        version:1,seed:this.seed,rng:this.seed||1,day:1,...this.world.home,...clone(config.start),maxHp:config.start.hp,
        cargo:{grain:0,silk:0,porcelain:0,spice:0},modules:[],rep:{ming:0,japan:0,dutch:0,iberian:0},flag:null,
        diplomacy:clone(config.relations),known:{},contacts:{},markets:{},plagueVisits:{},raided:{},recruited:{},
        quests:{grain:false,royal:null,commission:null},escort:null,event:null,combat:null,dead:null,
        log:[],weather:'晴',battles:0,delivered:0,earned:0,starving:0,zhengMet:false
      };
      if(!saved){
        const s=this.state;
        this.log('崇祯十七年，战乱把你推向澎湖。岛上的粮仓快见了底。','story');
        this.log(`带回 ${config.rules.grainGoal} 担粮食。可以购买，也可以用刀与炮取得。`,'quest');
        const k=W.key(s.x+1,s.y);s.contacts[k]={id:'first-merchant',type:'merchant',faction:'dutch',cargo:'silk',amount:8,hp:40,crew:12,damage:8,name:'荷兰商船'};
        this.reveal();
      }
    }
    get s(){return this.state;}
    random(){let t=this.s.rng+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);this.s.rng>>>=0;return ((t^(t>>>14))>>>0)/4294967296;}
    int(a,b){return Math.floor(this.random()*(b-a+1))+a;}
    log(text,type='normal'){this.s.log.unshift({day:this.s.day,text,type});this.s.log=this.s.log.slice(0,100);}
    cell(){return this.world.get(this.s.x,this.s.y);}
    port(){return this.world.ports.find(p=>p.id===this.cell()?.port);}
    faction(id){return this.config.factions.find(f=>f.id===id)?.name||({home:'澎湖同伴',joseon:'朝鲜',ryukyu:'琉球',local:'当地港务',pirate:'海盗'}[id]||'无旗');}
    coastFaction(){const c=this.cell();if(c.lon>=129)return 'japan';if(c.lon>=120&&c.lon<=122.5&&c.lat<25.8&&c.lat>21.5)return 'dutch';if(c.lat<20&&c.lon>118)return 'iberian';return 'ming';}
    occupied(){return Object.values(this.s.cargo).reduce((a,b)=>a+b,0);}
    morale(rate=this.config.rules.wagePerCrew){
      const value=Math.round(clamp(rate,0,2)/2*100);
      const power=this.config.morale.minPower+(1-this.config.morale.minPower)*value/100;
      return {value,power,rate,label:value>=80?'振奋':value>=50?'稳定':value>0?'低落':'涣散'};
    }
    payroll(rate=this.config.rules.wagePerCrew){
      const every=this.config.rules.wageEvery,daysUntil=every-((this.s.day-1)%every);
      // 以十分之一两计算，避免 50 × 1.1 的浮点误差导致多扣一两。
      const total=Math.ceil(this.s.crew*Math.round(rate*10)/10);
      return {rate,total,crew:this.s.crew,every,daysUntil,nextDay:this.s.day+daysUntil};
    }
    setWage(rate){
      if(this.s.dead)return {ok:false,message:'航程已经结束，无法调整工资。'};
      if(typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>2||Math.abs(rate*10-Math.round(rate*10))>1e-8)return {ok:false,message:'每人工资需为 0～2 两，最多一位小数。'};
      rate=Math.round(rate*10)/10;
      if(rate!==this.config.rules.wagePerCrew){
        this.config.rules.wagePerCrew=rate;const pay=this.payroll();
        this.log(`每人工资调整为 ${rate} 两，士气立即变为 ${this.morale().value}/100。下次第 ${pay.nextDay} 日发薪，按目前人数共需 ${pay.total} 两。`);
      }
      return {ok:true};
    }
    stats(){const result={capacity:this.config.start.capacity,maxHp:this.config.start.hp,damage:this.config.combat.cannonBase,armor:0,food:this.config.rules.supplyUse,dodge:0};for(const id of this.s.modules){const m=this.config.modules.find(m=>m.id===id);result.capacity+=m.capacity||0;result.maxHp+=m.hp||0;result.damage+=m.damage||0;result.armor+=m.armor||0;result.food+=m.food||0;result.dodge+=m.dodge||0;}result.food=Math.max(1,result.food+Math.floor(this.s.crew/this.config.rules.crewFoodPer));result.baseDamage=result.damage;result.damage=Math.max(1,Math.round(result.baseDamage*this.morale().power));return result;}
    changeRep(faction,amount){if(faction in this.s.rep)this.s.rep[faction]=clamp(this.s.rep[faction]+amount,-100,100);}
    relation(a,b){return a===b?60:this.s.diplomacy[pair(a,b)]||0;}
    effectiveRep(faction){let r=this.s.rep[faction]||0;if(this.s.flag)r+=this.s.flag===faction?20:this.relation(this.s.flag,faction)*0.65;return Math.round(r);}
    canDock(port=this.port()){return !!port&&(port.faction==='home'||this.effectiveRep(port.faction)>this.config.rules.hostilityThreshold);}
    isVisible(x,y){return Math.max(Math.abs(x-this.s.x),Math.abs(y-this.s.y))<=1;}
    plague(port){if(port.id==='penghu')return false;return W.hash(this.seed+Math.floor((this.s.day-1)/7)*503,port.x,port.y)>0.91;}
    market(port=this.port()){
      if(!port)return null;
      if(!this.s.markets[port.id])this.s.markets[port.id]={stock:Object.fromEntries(this.config.goods.map(g=>[g.id,port.id==='penghu'&&g.id==='grain'?3:35+Math.floor(W.hash(this.seed,port.x,g.base)*30)])),lastRestock:1};
      const m=this.s.markets[port.id],cycles=Math.floor((this.s.day-m.lastRestock)/7);
      if(cycles>0){for(const g of this.config.goods)m.stock[g.id]=Math.min(90,m.stock[g.id]+cycles*(port.id==='penghu'&&g.id==='grain'?2:12));m.lastRestock+=cycles*7;}
      return this.config.goods.map((g,i)=>{const variation=0.92+W.hash(this.seed+Math.floor((this.s.day-1)/4),port.x,g.base)*0.2;const buy=Math.max(2,Math.round(g.base*port.multipliers[i]*variation));return {...g,buy,sell:Math.max(1,Math.floor(buy*0.79)),stock:m.stock[g.id],demand:port.multipliers[i]>=1.3};});
    }
    info(x,y){const c=this.world.get(x,y);if(!c)return null;const k=W.key(x,y),known=this.s.known[k],visible=this.isVisible(x,y),port=this.world.ports.find(p=>p.id===c.port);return {...c,known:!!known,visible,portData:port,contact:visible?this.s.contacts[k]:null,reef:!!known?.reef,plague:port&&visible?this.plague(port):null,lastSeen:known?.day};}
    reveal(){const s=this.s;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const c=this.world.get(s.x+dx,s.y+dy);if(!c)continue;const k=W.key(c.x,c.y);
      if(!s.known[k]){
        s.known[k]={day:s.day,reef:false};
        const nearHome=Math.max(Math.abs(c.x-this.world.home.x),Math.abs(c.y-this.world.home.y))<=1;
        if(c.type==='sea'&&!nearHome&&!(dx===0&&dy===0)&&!s.contacts[k]&&W.hash(s.seed,c.x+811,c.y+911)<this.config.rules.encounterChance){
          const h=W.hash(s.seed,c.x+12,c.y+77),type=h<0.52?'merchant':h<0.8?'pirate':'navy';
          const faction=type==='pirate'?'pirate':(c.lon>125?'japan':c.lat<24.5?'dutch':'ming');
          s.contacts[k]={id:`ship-${k}`,type,faction,cargo:type==='merchant'?(faction==='dutch'?'silk':'grain'):'grain',amount:this.int(5,12),hp:type==='merchant'?40:this.int(48,78)+Math.floor(s.day/12)*5,crew:type==='merchant'?12:this.int(16,28),damage:type==='merchant'?8:this.int(9,15),name:type==='merchant'?`${this.faction(faction)}商船`:type==='navy'?`${this.faction(faction)}巡船`:'黑帆海盗'};
        }
      }s.known[k].day=s.day;
    }}
    die(reason){this.s.dead=reason;this.s.combat=null;this.s.event=null;this.log(reason,'danger');}
    advance(){
      const s=this.s;if(s.dead)return false;s.day++;const rules=this.config.rules;
      s.supplies=Math.max(0,s.supplies-this.stats().food);
      if(s.supplies===0){s.starving++;s.crew=Math.max(0,s.crew-rules.starvationLoss);this.log(`补给耗尽，饥饿夺走 ${rules.starvationLoss} 名船员。`,'danger');if(!s.crew||this.random()<rules.mutinyChance){this.die('饥饿引发哗变。你失去了船，也失去了这段海上生涯。');return false;}}
      else s.starving=0;
      if((s.day-1)%rules.wageEvery===0){
        const wage=this.payroll().total,paid=Math.min(s.silver,wage);s.silver-=paid;
        if(paid<wage)this.log(`本期应发 ${wage} 两，实发 ${paid} 两，缺额 ${wage-paid} 两；船员不会因工资不足离开。`,'danger');
        else this.log(wage===0?'本期工资为 0 两，不扣银两，船员继续留船。':`发放船员工钱 ${wage} 两。`);
      }
      if((s.day-1)%rules.diplomacyEvery===0){
        const keys=Object.keys(s.diplomacy),k=keys[this.int(0,keys.length-1)],delta=this.random()<0.5?-this.int(18,36):this.int(18,36);
        s.diplomacy[k]=clamp(s.diplomacy[k]+delta,-80,80);const [a,b]=k.split(':');
        this.log(`【本局推演】${this.faction(a)}与${this.faction(b)}${delta<0?'交恶，关系转冷':'订立新约，关系改善'}（${s.diplomacy[k]}）。旗帜可能影响靠港。`,'world');
      }
      s.weather=['晴','薄雾','海风渐起'][this.int(0,2)];return true;
    }
    canMove(x,y){const c=this.world.get(x,y);return !this.s.dead&&!this.s.event&&!this.s.combat&&!this.s.escort&&!!c&&c.type!=='land'&&Math.max(Math.abs(x-this.s.x),Math.abs(y-this.s.y))===1;}
    move(x,y,escorting=false){
      const s=this.s,c=this.world.get(x,y);
      if(s.dead||s.event||s.combat)return {ok:false,message:'请先处理眼前的遭遇。'};
      if(s.escort&&!escorting)return {ok:false,message:'正在护航：请跟随商船，或先结束护航。'};
      if(!c||c.type==='land'||Math.max(Math.abs(x-s.x),Math.abs(y-s.y))!==1)return {ok:false,message:'每回合只能进入相邻的一格海面、海岸或港口。'};
      if(!this.advance())return {ok:true};s.x=x;s.y=y;this.reveal();
      if(c.reef){const damage=this.int(8,17);s.hp=Math.max(0,s.hp-damage);s.known[W.key(x,y)].reef=true;this.log(`船底触礁！船体 −${damage}，已将暗礁记入海图。`,'danger');if(!s.hp){this.die('暗礁撕开船底。海水吞没了最后一块甲板。');return {ok:true};}}
      this.pursue();
      if(s.escort&&s.x===s.escort.destination.x&&s.y===s.escort.destination.y){const e=s.escort;this.changeRep(e.faction,15);s.silver+=e.reward;s.earned+=e.reward;s.delivered++;this.log(`护航抵达${e.destination.name}，获得 ${e.reward} 两，${this.faction(e.faction)}关系 +15。`,'reward');s.escort=null;}
      const contact=s.contacts[W.key(x,y)];
      if(contact)this.contactEvent(contact);
      else if(c.type==='port')this.enterPort();
      else if(c.type==='coast')this.setEvent('coast');
      else this.seaEvent();
      this.reveal();return {ok:true};
    }
    pursue(){
      const s=this.s;
      for(const [k,enemy]of Object.entries(s.contacts)){
        if(enemy.type==='merchant'||enemy.type==='militia')continue;
        if(enemy.type==='navy'&&this.effectiveRep(enemy.faction)>this.config.rules.hostilityThreshold)continue;
        const [x,y]=k.split(',').map(Number),dist=Math.max(Math.abs(x-s.x),Math.abs(y-s.y));
        if(dist===0||dist>2||enemy.moved===s.day)continue;
        const nx=x+Math.sign(s.x-x),ny=y+Math.sign(s.y-y),nk=W.key(nx,ny),c=this.world.get(nx,ny);
        if(!c||c.type==='land'||c.type==='port'||s.contacts[nk])continue;
        enemy.moved=s.day;s.contacts[nk]=enemy;delete s.contacts[k];this.log(`${enemy.name}正向你的船位逼近。`,'danger');
      }
    }
    contactEvent(contact){this.s.event={type:'contact',title:contact.name,contact:clone(contact)};}
    setEvent(id){const item=this.config.events.find(e=>e.id===id);this.s.event=item?{...clone(item),type:id}:{type:id};}
    seaEvent(){
      const r=this.random();if(r<0.58)this.setEvent('calm');else if(r<0.74)this.setEvent('wreck');else if(r<0.86)this.setEvent('survivors');else if(r<0.94)this.setEvent('legend');else if(!this.s.zhengMet){this.setEvent('zheng');this.s.zhengMet=true;}else this.setEvent('calm');
    }
    enterPort(){
      const p=this.port(),s=this.s;if(!p)return;
      this.log(`抵达${p.name}。${this.canDock(p)?'可以靠岸交易与整备。':'港务拒绝向你提供服务。'}`);
      if(!this.canDock(p))return;
      if(this.plague(p)){
        const stamp=Math.floor((s.day-1)/7);if(s.plagueVisits[p.id]!==stamp){s.plagueVisits[p.id]=stamp;const lost=Math.min(s.crew,this.config.rules.plagueLoss);s.crew-=lost;this.log(`${p.name}疫病蔓延，靠港染病损失 ${lost} 名船员。`,'danger');if(!s.crew){this.die('疫病夺走了最后的船员。你的航程终止于这座港口。');return;}}
      }
      if(s.quests.royal?.status==='aboard'&&p.id==='ningbo'){
        s.quests.royal.status='done';s.silver+=180;s.earned+=180;this.changeRep('ming',30);this.log('朱氏一家在宁波平安下船。获得 180 两酬谢，大明关系 +30。','quest');
      }
      if(p.id==='quanzhou'&&s.quests.grain&&!s.quests.commission&&s.rep.ming>=15){s.event={type:'commission',title:'招抚的机会'};}
    }
    wait(){if(this.s.dead||this.s.event||this.s.combat||this.s.escort)return {ok:false,message:'先完成当前遭遇或护航。'};if(this.advance()){this.pursue();const c=this.s.contacts[W.key(this.s.x,this.s.y)];if(c)this.contactEvent(c);this.reveal();}return {ok:true};}
    addCargo(id,amount){const fit=Math.max(0,Math.min(amount,this.stats().capacity-this.occupied()));this.s.cargo[id]+=fit;if(fit<amount)this.log(`货舱装不下，留下了 ${amount-fit} 单位货物。`);return fit;}
    choices(){
      const e=this.s.event;if(!e)return [];
      if(e.type==='contact'){
        if(e.contact.type==='merchant')return [{id:'attack',label:'截船劫货',detail:`开战 · 胜利后夺取货物，${this.faction(e.contact.faction)}关系 −25`,danger:true},{id:'escort',label:'为它护航',detail:'航线随商船移动 · 抵达后关系 +15，并领取报酬'},{id:'leave',label:'各行其路',detail:'无事发生，继续自己的航程'}];
        const hostile=e.contact.type!=='navy'||this.effectiveRep(e.contact.faction)<=this.config.rules.hostilityThreshold;
        return hostile?[{id:'attack',label:'迎战',detail:'回合制交战 · 沉船即结束本局',danger:true},{id:'flee',label:'弃货脱逃',detail:'丢弃全部货物，摆脱当前敌船'}]:[{id:'salute',label:'接受查验',detail:'大方亮明身份 · 关系 +2'},{id:'attack',label:'袭击巡船',detail:'主动开战会破坏关系',danger:true},{id:'leave',label:'远远绕过',detail:'保持距离，继续航行'}];
      }
      if(e.type==='coast')return [{id:'raid',label:'上岸夺粮',detail:`与乡勇交战 · 可获得粮食，${this.faction(this.coastFaction())}关系 −12`,danger:true},{id:'recruit',label:'招募乡民',detail:'招募 1～5 人，每人 4 两'},{id:'leave',label:'离开海岸',detail:'不作停留'}];
      if(e.type==='royal')return [{id:'acceptRoyal',label:'接他们上船',detail:'送往北方宁波 · 报酬 180 两，大明关系 +30'},{id:'declineRoyal',label:'赠粮后告别',detail:'赠出最多 2 担粮，继续自己的旅程'}];
      if(e.type==='commission')return [{id:'acceptCommission',label:'接受招抚委任',detail:'击败任意 2 艘海盗船 · 奖励 240 两与水师身份'},{id:'later',label:'容我再想想',detail:'以后返回泉州仍可接取'}];
      if(e.type==='wreck')return [{id:'salvage',label:'靠近打捞',detail:'有机会得到银两或粮食，也可能撞上漂木'},{id:'leave',label:'任它漂走',detail:'平安离开'}];
      if(e.type==='survivors')return [{id:'rescue',label:'救起落水者',detail:'船员 +3，补给 −5（满员时无法接纳）'},{id:'leave',label:'留下浮木，继续航行',detail:'保持当前人员与补给'}];
      if(e.type==='legend')return [{id:'offering',label:'投粮祈求平安',detail:'消耗 1 担粮，可能获得海中馈赠'},{id:'leave',label:'收帆慢行',detail:'黑影消失在船后，不再追寻'}];
      if(e.type==='zheng')return [{id:'zhengTrade',label:'替郑氏传递消息',detail:'结下海上人情 · 大明关系 +10，获得 30 两盘缠'},{id:'leave',label:'拱手作别',detail:'日后海上再会'}];
      return [{id:'leave',label:'继续航程',detail:'查看海图，选择下一格'}];
    }
    choose(id){
      const s=this.s,e=s.event;if(s.dead||!e||!this.choices().some(c=>c.id===id))return {ok:false,message:'当前无法作出这项选择。'};
      const k=W.key(s.x,s.y);
      if(id==='attack'){
        if(e.contact.type==='merchant'||e.contact.type==='navy'){const penalty=e.contact.type==='merchant'?-25:-30;this.changeRep(e.contact.faction,penalty);this.log(`向${e.contact.name}开火，${this.faction(e.contact.faction)}关系 ${penalty}。`,'danger');}
        this.startCombat(e.contact);return {ok:true};
      }
      if(id==='flee')return this.flee();
      if(id==='escort'){
        if(s.escort)return {ok:false,message:'已有一艘商船正在等待护航，请先完成当前委托。'};
        const ports=this.world.ports.filter(p=>p.faction===e.contact.faction&&Math.max(Math.abs(p.x-s.x),Math.abs(p.y-s.y))>=1);
        ports.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y));const dest=ports[0]||this.world.ports.find(p=>p.id==='quanzhou');const route=W.path(this.world,s,dest);
        if(!route.length)return {ok:false,message:'这艘船暂时没有可达的护航目的地。'};
        s.escort={faction:e.contact.faction,destination:{id:dest.id,name:dest.name,x:dest.x,y:dest.y},route,reward:45+route.length*5};delete s.contacts[k];
        this.log(`开始护送${e.contact.name}前往${dest.name}。抵达后才会结算关系与报酬。`,'quest');
      }
      if(id==='salute'){this.changeRep(e.contact.faction,2);delete s.contacts[k];this.log('巡船查验后放行。');}
      if(id==='leave'&&e.type==='contact')delete s.contacts[k];
      if(id==='raid'){
        if(s.raided[k]&&s.day-s.raided[k]<12){s.event=null;return {ok:false,message:'这片海岸刚被劫掠过，12 日内没有更多粮食。'};}
        const faction=this.coastFaction();this.changeRep(faction,-12);this.startCombat({name:'守粮乡勇',type:'militia',faction,hp:28,crew:12,damage:6,cargo:'grain',amount:this.config.rules.grainGoal+2});return {ok:true};
      }
      if(id==='recruit'){
        if(s.recruited[k]&&s.day-s.recruited[k]<7)return {ok:false,message:'此地暂时没有新的乡民愿意出海，7 日后再试。'};
        const n=Math.min(this.int(1,5),Math.floor(s.silver/4),s.crewMax-s.crew);if(!n)return {ok:false,message:'银两不足或船员已满。'};s.silver-=n*4;s.crew+=n;s.recruited[k]=s.day;this.log(`招募 ${n} 名乡民，花费 ${n*4} 两。`,'reward');
      }
      if(id==='acceptRoyal'){s.quests.royal={status:'aboard'};this.log('朱氏一家登船，托你将他们送往宁波。此支线为架空故事。','quest');}
      if(id==='declineRoyal'){s.cargo.grain=Math.max(0,s.cargo.grain-2);s.quests.royal={status:'declined'};}
      if(id==='acceptCommission'){s.quests.commission={kills:0,done:false};this.log('接受泉州委任：击败 2 艘海盗船。','quest');}
      if(id==='salvage'){const roll=this.random();if(roll<0.25){s.hp=Math.max(0,s.hp-12);this.log('打捞时撞上漂木，船体 −12。','danger');if(!s.hp)this.die('打捞残骸时船底破裂，你的船成了新的残骸。');}else if(roll<0.6){const n=this.addCargo('grain',5);this.log(`打捞到 ${n} 担粮食。`,'reward');}else{const n=this.int(15,35);s.silver+=n;s.earned+=n;this.log(`从木箱中捞出 ${n} 两银子。`,'reward');}}
      if(id==='rescue'){const n=Math.min(3,s.crewMax-s.crew);if(!n)return {ok:false,message:'船员已满，无法再容纳乘员。'};s.crew+=n;s.supplies=Math.max(0,s.supplies-5);this.log(`救起 ${n} 名落水者。`,'reward');}
      if(id==='offering'){if(s.cargo.grain<1)return {ok:false,message:'货舱里没有可供祭海的粮食。'};s.cargo.grain--;if(this.random()<0.65){s.silver+=35;s.earned+=35;this.log('巨影离去，一只装着 35 两银子的旧匣浮上水面。','reward');}else this.log('一担粮食消失在浪中，海面恢复了平静。');}
      if(id==='zhengTrade'){this.changeRep('ming',10);s.silver+=30;s.earned+=30;this.log('与郑氏结下人情，大明关系 +10。','reward');}
      s.event=null;return {ok:true};
    }
    startCombat(enemy){this.s.event=null;this.s.combat={enemy:clone(enemy),maxHp:enemy.hp,round:1,fire:0,defend:false,notes:['战斗开始。每次行动后，敌船都会反击。']};}
    combatAction(action){
      const s=this.s,b=s.combat;if(!b||s.dead)return {ok:false,message:'当前不在战斗中。'};
      if(action==='flee')return this.flee();
      if(!['cannon','board','maneuver','fire'].includes(action))return {ok:false,message:'未知战斗指令。'};
      const stats=this.stats(),morale=this.morale(),hit=base=>Math.max(1,Math.round(base*morale.power));let damage=0,defend=false,notes=[];
      if(morale.value<100)notes.push(`士气 ${morale.value}/100，本轮伤害按 ${Math.round(morale.power*100)}% 发挥。`);
      if(action==='cannon'){damage=hit(this.int(Math.max(1,stats.baseDamage-3),stats.baseDamage+4));notes.push(`舷炮齐射，造成 ${damage} 点伤害。`);}
      if(action==='board'){
        damage=hit(Math.max(4,Math.floor(s.crew*this.config.combat.boardCrewFactor)-Math.floor(b.enemy.crew*0.16)+this.int(-2,3)));
        const loss=this.int(1,Math.max(2,Math.ceil(b.enemy.crew/8)));s.crew=Math.max(0,s.crew-loss);notes.push(`接舷突击，造成 ${damage} 点伤害，损失 ${loss} 名船员。`);
        if(!s.crew){this.die('最后一名船员倒在接舷战中。船已无人操纵。');return {ok:true};}
      }
      if(action==='maneuver'){defend=true;damage=hit(this.int(3,6));notes.push(`调整帆位并以小炮牵制，造成 ${damage} 点伤害，本轮反击减半。`);}
      if(action==='fire'){if(s.supplies<8)return {ok:false,message:'火攻需要至少 8 点补给。'};s.supplies-=8;damage=hit(5);b.fire=3;notes.push(`投出火罐，消耗 8 点补给，造成 ${damage} 点伤害并燃烧 3 轮。`);}
      if(b.fire>0){const burn=hit(this.config.combat.fireDamage);damage+=burn;b.fire--;notes.push(`敌船火势造成 ${burn} 点伤害。`);}
      b.enemy.hp=Math.max(0,b.enemy.hp-damage);
      if(!b.enemy.hp){this.winCombat();return {ok:true};}
      let incoming=this.int(Math.max(2,b.enemy.damage-2),b.enemy.damage+3);
      if(defend)incoming=Math.ceil(incoming*(0.5-stats.dodge));incoming=Math.max(1,incoming-stats.armor);s.hp=Math.max(0,s.hp-incoming);notes.push(`敌方还击，船体 −${incoming}。`);b.round++;b.notes=notes;
      if(!s.hp)this.die(`你的船在与${b.enemy.name}的交战中沉没。`);
      return {ok:true};
    }
    winCombat(){
      const s=this.s,e=s.combat.enemy,k=W.key(s.x,s.y);s.combat=null;delete s.contacts[k];s.battles++;
      const silver=e.type==='militia'?8:this.int(25,60),cargo=this.addCargo(e.cargo||'grain',e.amount||6);s.silver+=silver;s.earned+=silver;
      this.log(`战胜${e.name}：获得 ${silver} 两与 ${cargo} 单位${this.config.goods.find(g=>g.id===e.cargo)?.name||'粮食'}。`,'reward');
      if(e.type==='pirate'){this.changeRep('ming',8);const q=s.quests.commission;if(q&&!q.done){q.kills++;if(q.kills>=2){q.done=true;s.silver+=240;s.earned+=240;this.changeRep('ming',35);this.log('平盗委任完成。获赏 240 两，并获水师身份；大明关系 +35。','quest');}}}
      if(e.type==='militia'){s.raided[k]=s.day;if(e.faction==='ming'&&!s.quests.royal)s.event={type:'royal',title:'岸边的朱氏一家',text:'乡间兵乱未息。一家自称明室宗亲的逃难者赶到岸边，恳求你送他们北上宁波。锦衣已沾满泥，怀里还抱着一个孩子。'};}
      else s.event={type:'victory',title:'战利品已装船',text:`你击败了${e.name}，得到 ${silver} 两银子与 ${cargo} 单位货物。水手收起绳索，等候下一道命令。`};
    }
    flee(){
      const s=this.s;if(s.dead||(!s.combat&&s.event?.type!=='contact'))return {ok:false,message:'当前没有需要摆脱的敌船。'};
      const amount=this.occupied();for(const id of Object.keys(s.cargo))s.cargo[id]=0;delete s.contacts[W.key(s.x,s.y)];s.combat=null;s.event=null;
      this.log(`抛弃全部 ${amount} 单位货物，趁轻船快帆摆脱敌人。`,'danger');
      if(s.escort){s.escort=null;this.log('护航中断，未获得报酬或关系奖励。');}return {ok:true};
    }
    followEscort(){const e=this.s.escort;if(!e)return {ok:false,message:'当前没有护航委托。'};if(this.s.event||this.s.combat)return {ok:false,message:'请先处理眼前的遭遇。'};const next=e.route[0];if(!next)return {ok:false,message:'护航路线已结束。'};const r=this.move(next.x,next.y,true);if(r.ok&&this.s.escort)this.s.escort.route.shift();return r;}
    endEscort(){if(!this.s.escort)return {ok:false,message:'当前没有护航。'};if(this.s.combat||this.s.event)return {ok:false,message:'先处理当前遭遇。'};this.s.escort=null;this.log('你提前结束了护航，没有获得关系或银两奖励。');return {ok:true};}
    serviceCheck(){return !this.s.dead&&!this.s.event&&!this.s.combat&&this.canDock();}
    trade(id,qty,mode){
      if(!this.serviceCheck())return {ok:false,message:'需要在可停靠的港口完成当前事件后交易。'};
      qty=Math.floor(Number(qty));if(!Number.isFinite(qty)||qty<1)return {ok:false,message:'交易数量必须大于零。'};
      const p=this.port(),item=this.market(p).find(g=>g.id===id);if(!item||!['buy','sell'].includes(mode))return {ok:false,message:'未知货物或交易方式。'};
      if(mode==='buy'){
        if(qty>item.stock||qty+this.occupied()>this.stats().capacity||qty*item.buy>this.s.silver)return {ok:false,message:'银两、货舱或港口库存不足。'};
        this.s.silver-=qty*item.buy;this.s.cargo[id]+=qty;this.s.markets[p.id].stock[id]-=qty;this.log(`在${p.name}买入 ${qty} ${item.unit}${item.name}，花费 ${qty*item.buy} 两。`);
      }else{
        if(qty>this.s.cargo[id])return {ok:false,message:'船舱内没有这么多货物。'};this.s.cargo[id]-=qty;this.s.silver+=qty*item.sell;this.s.earned+=qty*item.sell;this.s.markets[p.id].stock[id]+=qty;this.log(`在${p.name}售出 ${qty} ${item.unit}${item.name}，获得 ${qty*item.sell} 两。`,'reward');
      }return {ok:true};
    }
    service(action){
      if(!this.serviceCheck())return {ok:false,message:'需要先在友善港口靠岸，并处理当前事件。'};
      const s=this.s;
      if(action==='repair'){const n=Math.min(25,this.stats().maxHp-s.hp,Math.floor(s.silver/2));if(n<=0)return {ok:false,message:'船体完好或银两不足。'};s.hp+=n;s.silver-=n*2;this.log(`修补船体 ${n} 点，花费 ${n*2} 两。`);}
      else if(action==='supply'){const n=Math.min(25,100-s.supplies,s.silver);if(n<=0)return {ok:false,message:'补给已满或银两不足。'};s.supplies+=n;s.silver-=n;this.log(`补给 +${n}，花费 ${n} 两。`);}
      else if(action==='recruit'){if(s.crew>=s.crewMax)return {ok:false,message:'船员已满，无法继续招募。'};if(s.silver<5)return {ok:false,message:'招募 1 名船员需要 5 两。'};s.crew++;s.silver-=5;this.log('招募 1 名船员，花费 5 两。');}
      else return {ok:false,message:'未知港口服务。'};
      return {ok:true};
    }
    consumeGrain(){if(this.s.dead||this.s.combat)return {ok:false,message:'当前无法补充粮食。'};if(this.s.cargo.grain<1||this.s.supplies>=100)return {ok:false,message:'需要 1 担粮食，且补给未满。'};this.s.cargo.grain--;this.s.supplies=Math.min(100,this.s.supplies+10);this.log('消耗 1 担货舱粮食，补给 +10。');return {ok:true};}
    deliverGrain(){const s=this.s;if(!this.serviceCheck()||this.port()?.id!=='penghu')return {ok:false,message:'请回到澎湖交粮。'};if(s.quests.grain)return {ok:false,message:'筹粮任务已完成。'};const n=this.config.rules.grainGoal;if(s.cargo.grain<n)return {ok:false,message:`需要带回 ${n} 担粮食。`};s.cargo.grain-=n;s.quests.grain=true;const joined=Math.min(8,s.crewMax-s.crew);s.crew+=joined;s.silver+=70;s.earned+=70;this.changeRep('ming',10);this.log(`交付 ${n} 担粮食，澎湖渡过饥荒。${joined} 名同伴加入，获得 70 两，大明关系 +10。`,'quest');return {ok:true};}
    install(id){if(!this.serviceCheck())return {ok:false,message:'只能在友善港口改装船只。'};const m=this.config.modules.find(m=>m.id===id);if(!m)return {ok:false,message:'未知装备。'};if(this.s.modules.includes(id))return {ok:false,message:'已经安装了这件装备。'};if(this.s.modules.length>=this.config.start.slots)return {ok:false,message:'改装位已满，需要先拆除一件装备。'};if(this.s.silver<m.cost)return {ok:false,message:'银两不足。'};this.s.silver-=m.cost;this.s.modules.push(id);if(m.hp)this.s.hp+=m.hp;this.log(`安装「${m.name}」，花费 ${m.cost} 两。`,'reward');return {ok:true};}
    uninstall(id){if(!this.serviceCheck())return {ok:false,message:'只能在友善港口拆除装备。'};const m=this.config.modules.find(m=>m.id===id);if(!m||!this.s.modules.includes(id))return {ok:false,message:'尚未安装。'};if(this.occupied()>this.stats().capacity-(m.capacity||0))return {ok:false,message:'拆除后货舱不足，请先卖出或丢弃货物。'};this.s.modules=this.s.modules.filter(x=>x!==id);this.s.hp=Math.min(this.s.hp,this.stats().maxHp);this.s.silver+=Math.floor(m.cost*0.4);this.log(`拆除「${m.name}」，回收 ${Math.floor(m.cost*0.4)} 两。`);return {ok:true};}
    setFlag(id){if(!this.serviceCheck())return {ok:false,message:'请在可停靠的港口更换旗帜。'};if(id!=='none'&&!(id in this.s.rep))return {ok:false,message:'未知旗帜。'};if(id!=='none'&&this.s.rep[id]<this.config.rules.flagThreshold)return {ok:false,message:`关系达到 ${this.config.rules.flagThreshold} 后才能取得这面旗帜。`};this.s.flag=id==='none'?null:id;this.log(`更换旗帜：${id==='none'?'无旗':this.faction(id)}。`);return {ok:true};}
    discard(id){if(this.s.dead||this.s.combat||!this.config.goods.some(g=>g.id===id)||this.s.cargo[id]<1)return {ok:false,message:'当前无法丢弃这件货物。'};this.s.cargo[id]--;this.log(`丢弃 1 单位${this.config.goods.find(g=>g.id===id).name}。`);return {ok:true};}
    export(){return clone({version:1,config:this.config,state:this.s});}
  }
  root.PirateGame=Game;
  if(typeof module!=='undefined')module.exports=Game;
})(typeof globalThis!=='undefined'?globalThis:this);
