(function(){
  'use strict';
  const $=s=>document.querySelector(s),W=PirateWorld,STORE='penghu-voyage-v1',PREFS='penghu-parameters-v1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy=x=>JSON.parse(JSON.stringify(x));
  let game,settings=copy(PIRATE_CONFIG),saveAvailable=true,saved=null,tab='hold',selection=null,center=null,toastTimer,pan=null,mapMetrics=null,activeModal=null;
  try{const p=JSON.parse(localStorage.getItem(PREFS));if(p?.version===1)settings=p;const raw=JSON.parse(localStorage.getItem(STORE));if(raw?.version===1&&raw.state&&raw.config)saved=raw;}catch{saveAvailable=false;}
  settings.morale={...PIRATE_CONFIG.morale,...settings.morale};
  delete settings.morale.silverPerCrew;
  settings.rules.wagePerCrew=Math.round(Math.max(0,Math.min(2,settings.rules.wagePerCrew))*10)/10;
  try{game=saved?new PirateGame(saved.config,saved.state.seed,saved.state):new PirateGame(settings,Date.now());}catch{game=new PirateGame(settings,Date.now());saved=null;}
  center={x:game.s.x,y:game.s.y};selection={...center};
  const ship=new Image();ship.src=game.config.assets.ship;ship.onload=()=>drawMap();
  function persist(){try{localStorage.setItem(STORE,JSON.stringify(game.export()));}catch{saveAvailable=false;}$('#save-label').textContent=saveAvailable?'本机自动保存 · 原型 v0.2':'当前浏览器未允许存档 · 请保持页面开启';}
  function toast(message){if(!message)return;$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3600);}
  function act(fn,{locate=false}={}){const oldDay=game.s.day,oldLog=game.s.log[0];const result=fn();if(result?.message)toast(result.message);if(locate){selection={x:game.s.x,y:game.s.y};center={...selection};}render();persist();if(!result?.message&&game.s.log[0]!==oldLog)toast(game.s.log[0].text);if(game.s.event&&game.s.day!==oldDay&&innerWidth<761)$('#decision').scrollIntoView({behavior:'smooth',block:'nearest'});}
  const button=(label,action,extra='',cls='')=>`<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const signed=n=>n>0?`+${n}`:String(n);
  function render(){
    const s=game.s,stats=game.stats(),cell=game.cell(),port=game.port(),morale=game.morale(),pay=game.payroll();
    $('#turn-label').textContent=`航海第 ${s.day} 日`;
    $('#weather-label').textContent=`${s.weather} · ${s.flag?game.faction(s.flag)+'旗':'未悬挂阵营旗帜'}`;
    $('#location-label').textContent=port?`${port.name}${port.id==='penghu'?'锚地':'港'}`:cell.type==='coast'?'沿岸村落':'西太平洋 · 航行中';
    $('#position-label').textContent=`${cell.lat.toFixed(1)}° N / ${cell.lon.toFixed(1)}° E`;
    const stat=(symbol,label,value,total,detail,percent,warn=false)=>`<div class="stat ${warn?'warn':''}"><span class="stat-icon">${symbol}</span><div><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-number">${value}${total?`<small> / ${total}</small>`:''}</span></div>${percent!==null?`<div class="meter"><span style="width:${Math.max(0,Math.min(100,percent))}%"></span></div>`:''}<span class="stat-detail">${detail}</span></div></div>`;
    $('#stats').innerHTML=stat('舟','船体',s.hp,stats.maxHp,'港口维修 · 2 两 / 点',s.hp/stats.maxHp*100,s.hp<30)+stat('糧','补给',s.supplies,100,`每日消耗 ${stats.food} · 粮食可转补给`,s.supplies,s.supplies<20)+stat('銀','银两',s.silver,'',`下次工钱 ${pay.total} 两 · ${pay.daysUntil} 日后`,null,s.silver<pay.total)+stat('衆','船员',s.crew,s.crewMax,`货舱 ${game.occupied()} / ${stats.capacity} · 炮击 ${stats.damage}`,null,s.crew<6);
    $('#escort-strip').innerHTML=s.escort?`<div class="escort-bar"><div>护航中 → <strong>${esc(s.escort.destination.name)}</strong><small>剩余 ${s.escort.route.length} 格 · 抵达后 ${s.escort.reward} 两 / 关系 +15</small></div>${button('跟随商船 →','follow','', 'primary')}${button('结束护航','endEscort')}</div>`:'';
    $('#morale').classList.toggle('low',morale.value<50);
    $('#morale').innerHTML=`<div class="morale-summary"><strong>士气 ${morale.value}/100</strong><span>${morale.label} · 伤害 ${Math.round(morale.power*100)}%</span><div class="meter"><span style="width:${morale.value}%"></span></div></div><small>每人工资 ${pay.rate} 两 / ${pay.every} 日 · 0 两零士气，2 两满士气</small>${button('调整工资','wages',s.dead?'disabled':'','wage-entry')}`;
    renderDecision();
    renderQuests();renderDeck();drawMap();
    if(activeModal==='shipyard'&&$('#modal').open)openShipyard();
  }
  function renderDecision(){
    renderDecisionBody();
    const s=game.s,stats=game.stats(),morale=game.morale();
    if(s.combat)$('#decision').insertAdjacentHTML('afterbegin',`<div class="combat-player">本船船体 <strong>${s.hp}/${stats.maxHp}</strong>　船员 <strong>${s.crew}</strong>　补给 <strong>${s.supplies}</strong><br>士气 <strong>${morale.value}/100</strong> · 本轮伤害发挥 <strong>${Math.round(morale.power*100)}%</strong></div>`);
  }
  function renderDecisionBody(){
    const s=game.s,el=$('#decision');
    if(s.dead){el.innerHTML=`<p class="section-kicker">本次航程结束</p><img class="end-portrait" src="${esc(game.config.assets.portrait)}" alt="船长肖像"><h2>帆影，沉入海中。</h2><p class="body-copy">${esc(s.dead)}</p><div class="end-stats"><div>存活日数<strong>${s.day}</strong></div><div>海战胜利<strong>${s.battles}</strong></div><div>护航完成<strong>${s.delivered}</strong></div><div>筹粮任务<strong>${s.quests.grain?'已成':'未竟'}</strong></div></div>${button('重开一局，重新出海','restart','', 'primary full')}<p class="hint">新的随机种子，新的遭遇。死亡不保留财物、装备或关系。</p>`;return;}
    if(s.combat){const b=s.combat;el.innerHTML=`<p class="section-kicker">海战 · 第 ${b.round} 轮 <span class="tag danger">交战中</span></p><h2>${esc(b.enemy.name)}</h2><p class="body-copy">敌船船体 <strong>${b.enemy.hp} / ${b.maxHp}</strong> · 船员 ${b.enemy.crew}<br>你的每次行动后，敌船将立即反击。</p><div class="enemy-bar"><span style="width:${b.enemy.hp/b.maxHp*100}%"></span></div><div class="combat-notes">${b.notes.map(n=>`<div>${esc(n)}</div>`).join('')}</div><div class="combat-grid">${button('舷炮齐射<small>稳定炮击伤害</small>','combat','data-value="cannon"','primary')}${button('接舷突击<small>人多更强 · 损失船员</small>','combat','data-value="board"')}${button('机动牵制<small>小炮攻击 · 减少反击</small>','combat','data-value="maneuver"')}${button('火罐攻船<small>补给 −8 · 持续燃烧</small>','combat',`data-value="fire" ${s.supplies<8?'disabled':''}`)}</div>${button('抛弃全部货物，脱离战斗','combat','data-value="flee"','combat-flee')}`;return;}
    if(s.event){
      const e=s.event,contact=e.contact;
      let title=e.title,text=e.text,kicker='海上遭遇';
      if(e.type==='coast'){title='岸上，炊烟寥寥。';text='海边的小村落储有少许粮食，也有人愿意出海讨生活。劫掠会引来地方官府的敌意。';kicker='沿岸村落';}
      if(contact){kicker=contact.type==='merchant'?'海上遭遇 · 商船':'海上遭遇 · 舰船';text=contact.type==='merchant'?`船帆上是${game.faction(contact.faction)}的标记，货舱里装着${game.config.goods.find(g=>g.id===contact.cargo)?.name}。你可以劫货，也可以赚取护航的钱。`:`${contact.type==='navy'&&game.effectiveRep(contact.faction)>game.config.rules.hostilityThreshold?'巡船要求查验身份。':'对方已经发现你，正转向逼近。'}敌船船体 ${contact.hp}，船员 ${contact.crew}。`;}
      if(e.type==='commission')text='泉州官员提出：替水师清剿两艘海盗船，即可领赏，并以官府认可的身份继续在海上活动。';
      el.innerHTML=`<p class="section-kicker">${esc(kicker)} <span class="tag">需要决策</span></p><h2>${esc(title)}</h2><p class="body-copy">${esc(text)}</p><div class="choice-list">${game.choices().map((c,i)=>`<button class="choice ${c.danger?'danger':i===0?'primary':''}" data-action="choice" data-value="${c.id}"><span>${esc(c.label)}<span class="choice-arrow">↗</span></span><small>${esc(c.detail)}</small></button>`).join('')}</div>`;return;
    }
    const pos=selection||s,info=game.info(pos.x,pos.y),at=pos.x===s.x&&pos.y===s.y;
    if(!info)return;
    if(at&&info.type==='port'){renderPort(el,info.portData);return;}
    const names={sea:'一格海面',land:'陆地',coast:'沿岸村落',port:info.portData?.name+'港'};
    let detail=info.type==='land'?'海船无法驶入内陆。可沿着海岸寻找港口与村落。':!info.visible?'海图记载着这里的地形，但船只、疫病与市场情报都不在当前视野中。':info.contact?`已观察到：${info.contact.name}。进入这格后可以与它交涉或交战。`:'视野内暂未发现舰船。海况与暗礁仍可能在驶入时才揭晓。';
    if(info.type==='port'&&info.visible)detail=`${info.portData.flavor} ${game.canDock(info.portData)?'港口允许靠岸。':'当前身份遭港务拒绝。'}${info.plague?' 已发现疫病：靠岸将损失船员！':' 未发现疫病。'}`;
    if(info.reef)detail+=' 海图已标记暗礁，进入会损伤船体。';
    const adjacent=Math.max(Math.abs(pos.x-s.x),Math.abs(pos.y-s.y))===1;
    el.innerHTML=`<p class="section-kicker">${at?'当前船位':'海图情报'} <span class="tag">${info.visible?'视野之内':'情报未知'}</span></p><h2>${esc(names[info.type])}</h2><p class="body-copy">${esc(detail)}</p>${info.type==='port'&&info.visible?`<p class="hint">需求：${game.market(info.portData).filter(g=>g.demand).map(g=>esc(g.name)).join('、')||'日用货物'} · 粮食买价 ${game.market(info.portData)[0].buy} 两</p>`:''}${!at?button(adjacent?'驶入此格 · 1 日':'距离较远，逐格前往','move',`data-x="${pos.x}" data-y="${pos.y}" ${!game.canMove(pos.x,pos.y)?'disabled':''}`,'primary full'):info.type==='coast'?button('与村落接触','coast','','primary full'):button('选取邻格，继续航行','recenter','','primary full')}<p class="hint">${s.escort?'当前正为商船护航，请使用海图下方「跟随商船」。':'每次移动消耗补给。斜向移动同样只需 1 日。'}</p>${nearby()}`;
  }
  function nearby(){const s=game.s,labels=['西北','北','东北','西','本船','东','西南','南','东南'];let html='<div class="nearby" aria-label="选择相邻海域">';let i=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const c=game.world.get(s.x+dx,s.y+dy);html+=button(labels[i++],'select',`data-x="${s.x+dx}" data-y="${s.y+dy}" ${!c||c.type==='land'?'disabled':''}`,dx===0&&dy===0?'center':'');}return html+'</div>';}
  function renderPort(el,p){
    const s=game.s,access=game.canDock(p),plague=game.plague(p);
    el.innerHTML=`<p class="section-kicker">${p.id==='penghu'?'你的出发之地':'港口 · '+esc(game.faction(p.faction))}<span class="tag ${plague?'danger':''}">${plague?'疫病蔓延':'可见港情'}</span></p><h2>${esc(p.name)}${p.id==='penghu'?'，暂且靠岸。':'港'}</h2>${p.id==='penghu'&&s.day===1?`<div class="location-art"><img src="${esc(game.config.assets.portrait)}" alt="船长肖像"><p class="body-copy">战乱把你推向这座岛。<br>一条小船，一群等粮的同伴。<br>去海的另一边，找条生路。</p></div>`:`<p class="body-copy">${esc(p.flavor)}</p>`}${!access?`<div class="update-notice">港务拒绝补给与交易。你的有效关系为 ${game.effectiveRep(p.faction)}，需要高于 ${game.config.rules.hostilityThreshold}。${s.flag?'当前悬挂的旗帜也影响了关系。':''}</div>${button('查看旗帜与局势','relations','','full')}${nearby()}`:`${plague?'<div class="update-notice">当地有疫病，同一轮疫情只在首次靠岸时扣除船员。请留意航海日志。</div>':''}<div class="port-services">${button('修船<small>最多 +25 / 50 两</small>','service','data-value="repair"')}${button('补给<small>最多 +25 / 25 两</small>','service','data-value="supply"')}${button('招募 1 人<small>每次 5 两</small>','service',`data-value="recruit" ${s.silver<5||s.crew>=s.crewMax?'disabled':''}`)}</div>${button('<span>船坞 · 升级船体 / 火炮<small>货舱、火炮、船壳与帆装</small></span><span>→</span>','shipyard','','shipyard-entry')}<div class="trade-list">${game.market(p).map(g=>`<div class="trade-row"><div><strong>${esc(g.name)} ${g.demand?'<span class="tag">求购</span>':''}</strong><small>买 ${g.buy} / 卖 ${g.sell} 两 · 库 ${g.stock} / 持 ${s.cargo[g.id]}</small></div><div class="trade-actions"><input type="number" min="1" max="99" value="1" id="qty-${g.id}" aria-label="${esc(g.name)}交易数量"><button data-action="buy" data-value="${g.id}">买</button><button data-action="sell" data-value="${g.id}" ${s.cargo[g.id]<1?'disabled':''}>卖</button></div></div>`).join('')}</div>${p.id==='penghu'&&!s.quests.grain?button(`交付 ${game.config.rules.grainGoal} 担粮食（现有 ${s.cargo.grain}）`,'deliver',`${s.cargo.grain<game.config.rules.grainGoal?'disabled':''}`,'primary full'):''}<p class="hint">买卖、维修、招募不推进日期。离港：在海图点选相邻格。${p.id==='penghu'?'每次招募 1 人，船员上限 50 人；可在士气栏调整每人工资。':''}</p>`}`;
  }
  function renderQuests(){
    const s=game.s,grain=game.config.rules.grainGoal,q=s.quests;let content=`<h3>此行所求 <small class="tag">航程委托</small></h3><div class="quest-line"><span class="quest-icon">${q.grain?'✓':'壹'}</span><div><strong>${q.grain?'澎湖的粮仓，已续上炊烟':'为澎湖带回粮食'}</strong><small>${q.grain?'同伴加入，海路由此展开。':`运回 ${grain} 担粮食 · 奖励 8 名船员 / 70 两`}</small>${!q.grain?`<div class="quest-progress"><span style="width:${Math.min(100,s.cargo.grain/grain*100)}%"></span></div><small>货舱粮食 ${s.cargo.grain} / ${grain}</small>${button('在海图上找澎湖','find','data-value="penghu"')}`:''}</div></div>`;
    if(q.royal?.status==='aboard')content+=`<div class="quest-line"><span class="quest-icon">贰</span><div><strong>护送朱氏一家北上</strong><small>目的地：宁波 · 酬谢 180 两 / 大明 +30</small>${button('在海图上找宁波','find','data-value="ningbo"')}</div></div>`;
    else if(q.royal?.status==='done')content+='<div class="quest-line"><span class="quest-icon">✓</span><div><strong>朱氏一家已平安上岸</strong><small>这段同行，成为了你的海上人情。</small></div></div>';
    else if(q.grain&&!q.royal)content+='<div class="quest-line"><span class="quest-icon">贰</span><div><strong>更远的海路</strong><small>沿岸交锋可能带来新的同行者；与官府交好，也可到泉州寻求委任。</small></div></div>';
    if(q.commission)content+=`<div class="quest-line"><span class="quest-icon">${q.commission.done?'✓':'叁'}</span><div><strong>${q.commission.done?'水师身份：已获招抚':'平盗委任'}</strong><small>击败海盗 ${Math.min(2,q.commission.kills)} / 2 · ${q.commission.done?'委任完成，可继续自由航行':'奖励 240 两 / 大明 +35'}</small></div></div>`;
    $('#quests').innerHTML=content;
  }
  function renderDeck(){
    const s=game.s;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
    if(tab==='journal'){$('#deck-content').innerHTML=`<div class="journal">${s.log.map(l=>`<div class="journal-line ${l.type}"><time>第 ${l.day} 日</time><span>${esc(l.text)}</span></div>`).join('')}</div>`;return;}
    if(tab==='relations'){$('#deck-content').innerHTML=`<div class="relations-layout"><section><div class="subheading">船长声望 <small>关系 ≥ ${game.config.rules.flagThreshold} 可领旗 · 靠港更换</small></div>${game.config.factions.map(f=>`<div class="faction-row"><span class="faction-seal" style="background:${f.color}">${f.short}</span><div><strong>${f.name}</strong><small>港口有效关系 ${game.effectiveRep(f.id)}${s.flag===f.id?' · 正在挂旗':''}</small></div><span class="rep-score ${s.rep[f.id]<0?'negative':''}">${signed(s.rep[f.id])}</span>${button(s.flag===f.id?'已悬挂':'悬挂旗帜','flag',`data-value="${f.id}" ${!game.serviceCheck()||s.rep[f.id]<game.config.rules.flagThreshold||s.flag===f.id?'disabled':''}`)}</div>`).join('')}<div class="cargo-actions">${button('降下阵营旗帜','flag',`data-value="none" ${!s.flag||!game.serviceCheck()?'disabled':''}`)}<small>交好可领旗；挂旗才会受到盟友与敌国的连带影响。</small></div></section><section><div class="subheading">本局海上局势 <small>每 ${game.config.rules.diplomacyEvery} 日推演一次</small></div>${Object.entries(s.diplomacy).map(([k,v])=>{const[a,b]=k.split(':');return `<div class="diplomacy-row"><span>${esc(game.faction(a))} ↔ ${esc(game.faction(b))}</span><span class="tag ${v<=-25?'danger':''}">${v>=25?'通商友好':v<=-25?'敌对摩擦':'往来谨慎'} ${signed(v)}</span></div>`;}).join('')}<p class="hint">这是简化的游戏关系数值。1644 年的开局参考真实贸易背景，之后的变化是随机历史推演。原型将官府、幕府及海外商馆抽象成可交涉势力。</p></section></div>`;return;}
    const stats=game.stats();$('#deck-content').innerHTML=`<div class="hold-layout"><section><div class="subheading">货舱 <small>${game.occupied()} / ${stats.capacity} 格 · 每单位货物占 1 格</small></div><div class="goods-grid">${game.config.goods.map(g=>`<div class="good-card"><div class="good-symbol" style="color:${g.color}">${g.icon}</div><strong>${g.name}</strong><div class="count">${s.cargo[g.id]} <small>${g.unit}</small></div>${button('丢弃 1','discard',`data-value="${g.id}" ${s.cargo[g.id]<1||s.dead||s.combat?'disabled':''}`)}</div>`).join('')}</div><div class="cargo-actions">${button('用 1 担粮食补给 +10','eat',`${s.cargo.grain<1||s.supplies>=100||s.dead||s.combat?'disabled':''}`)}<small>任务粮食也会被消耗，请留足返航所需。</small></div></section><section><div class="subheading">船只改装 <small>${s.modules.length} / ${game.config.start.slots} 改装位 · 港口操作</small></div><div class="module-grid">${game.config.modules.map(m=>{const installed=s.modules.includes(m.id);return `<div class="module ${installed?'installed':''}"><div><strong>${installed?'✓ ':''}${m.name}</strong><small>${m.description}</small></div>${button(installed?'拆除':`${m.cost} 两`,installed?'uninstall':'install',`data-value="${m.id}" ${!game.serviceCheck()||(!installed&&(s.silver<m.cost||s.modules.length>=game.config.start.slots))?'disabled':''}`)}</div>`;}).join('')}</div><p class="hint">货舱、炮位、船壳和帆装共享改装位。拆除返还 40% 价格。</p></section></div>`;
  }
  function drawMap(){
    const canvas=$('#map');if(!canvas||!center)return;const rect=canvas.getBoundingClientRect();if(!rect.width)return;const dpr=Math.min(devicePixelRatio||1,2),width=rect.width,height=rect.height;canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const size=innerWidth<761?52:59,left=center.x-width/(2*size),top=center.y-height/(2*size);mapMetrics={size,left,top,width,height};ctx.fillStyle='#1b4145';ctx.fillRect(0,0,width,height);
    const sx=Math.floor(left),sy=Math.floor(top),ex=Math.ceil(left+width/size),ey=Math.ceil(top+height/size);
    for(let y=sy;y<=ey;y++)for(let x=sx;x<=ex;x++){
      const c=game.world.get(x,y),px=(x-left)*size,py=(y-top)*size,visible=game.isVisible(x,y);if(!c)continue;
      const land=c.type==='land'||c.type==='coast';ctx.fillStyle=land?(visible?'#a9ae82':'#6d806e'):(visible?'#477975':'#285459');ctx.fillRect(px,py,size,size);
      if(c.type==='coast'){ctx.fillStyle=visible?'#bdba8b':'#82947b';ctx.fillRect(px+3,py+3,size-6,size-6);}
      if(c.type==='sea'){
        ctx.strokeStyle=visible?'#8aafa14a':'#719b9330';ctx.lineWidth=.8;ctx.beginPath();const wave=(x+y)%3;ctx.moveTo(px+12,py+23+wave*4);ctx.quadraticCurveTo(px+18,py+19+wave*4,px+25,py+23+wave*4);ctx.quadraticCurveTo(px+32,py+27+wave*4,px+40,py+23+wave*4);ctx.stroke();
      }
      if(land&&c.type==='land'&&(x*7+y)%5===0){ctx.strokeStyle='#a1ad8677';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+13,py+34);ctx.lineTo(px+23,py+19);ctx.lineTo(px+32,py+34);ctx.moveTo(px+27,py+29);ctx.lineTo(px+34,py+21);ctx.lineTo(px+43,py+34);ctx.stroke();}
      ctx.strokeStyle=visible?'#c5d5b840':'#b3c2a615';ctx.lineWidth=.6;ctx.strokeRect(px,py,size,size);
      const info=game.info(x,y);
      if(c.type==='port'&&!(x===game.s.x&&y===game.s.y)){
        ctx.fillStyle=visible?'#e3cd98':'#b1b993';ctx.beginPath();ctx.arc(px+size/2,py+size/2-4,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#daceac99';ctx.beginPath();ctx.arc(px+size/2,py+size/2-4,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle=visible?'#fff1c9':'#c5cbb1';ctx.font=`${visible?'bold ':''}11px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(info.portData.name,px+size/2,py+size-8);
        if(info.plague){ctx.fillStyle='#e9a080';ctx.font='bold 13px sans-serif';ctx.fillText('!',px+size-10,py+15);}
      }else if(c.type==='coast'&&visible){ctx.fillStyle='#525f46';ctx.font='20px SimSun';ctx.textAlign='center';ctx.fillText('⌂',px+size/2,py+size/2+5);}
      if(info.reef){ctx.fillStyle='#dab784';ctx.font='17px serif';ctx.textAlign='left';ctx.fillText('△',px+5,py+18);}
      if(info.contact&&!(x===game.s.x&&y===game.s.y)){const hostile=info.contact.type==='pirate'||info.contact.type==='navy'&&game.effectiveRep(info.contact.faction)<=game.config.rules.hostilityThreshold;ctx.fillStyle=hostile?'#dd9479':'#ded3a8';ctx.beginPath();ctx.moveTo(px+20,py+29);ctx.lineTo(px+38,py+29);ctx.lineTo(px+32,py+35);ctx.lineTo(px+24,py+35);ctx.fill();ctx.beginPath();ctx.moveTo(px+29,py+10);ctx.lineTo(px+29,py+27);ctx.lineTo(px+41,py+25);ctx.fill();ctx.font='9px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(info.contact.type==='merchant'?'商船':info.contact.type==='navy'?'巡船':'海盗',px+size/2,py+size-6);}
    }
    const s=game.s,vx=(s.x-1-left)*size,vy=(s.y-1-top)*size;ctx.strokeStyle='#c9d8ae95';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.strokeRect(vx,vy,size*3,size*3);ctx.setLineDash([]);
    if(game.s.escort){ctx.strokeStyle='#e2cc9c88';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo((s.x-left+.5)*size,(s.y-top+.5)*size);for(const p of s.escort.route)ctx.lineTo((p.x-left+.5)*size,(p.y-top+.5)*size);ctx.stroke();ctx.setLineDash([]);}
    if(selection){ctx.strokeStyle='#efd093';ctx.lineWidth=2;ctx.strokeRect((selection.x-left)*size+2,(selection.y-top)*size+2,size-4,size-4);}
    const px=(s.x-left)*size,py=(s.y-top)*size;ctx.fillStyle='#eee5ae22';ctx.beginPath();ctx.arc(px+size/2,py+size/2,24,0,Math.PI*2);ctx.fill();
    if(ship.complete&&ship.naturalWidth)ctx.drawImage(ship,px+3,py-2,size-6,size-6);else{ctx.fillStyle='#f3d692';ctx.font='30px serif';ctx.textAlign='center';ctx.fillText('舟',px+size/2,py+size/2+10);}
    ctx.textAlign='center';ctx.fillStyle='#ffe2a4';ctx.font='bold 10px "Microsoft YaHei",sans-serif';ctx.fillText('本船',px+size/2,py+size-3);
    const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#102f3433');gradient.addColorStop(.18,'#102f3400');gradient.addColorStop(.8,'#102f3400');gradient.addColorStop(1,'#102f3444');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  }
  function modal(title,body,type=null){activeModal=type;$('#modal-content').innerHTML=`<div class="modal-header"><h2>${title}</h2>${button('×','close','','icon-button')}</div><div class="modal-body">${body}</div>`;if(!$('#modal').open)$('#modal').showModal();}
  function openWages(){
    const pay=game.payroll();
    modal('船员工资',`<p>当前每人每 ${pay.every} 日领取 <strong>${pay.rate} 两</strong>。保存后士气与战力立即变化，银两在下一次发薪日结算。</p><form id="wage-form"><label class="wage-label" for="wage-rate">每人每期工资（两）</label><div class="wage-controls">${button('−','wageStep','data-value="-0.5" aria-label="降低工资"')}<input id="wage-rate" type="number" min="0" max="2" step="0.1" value="${pay.rate}" inputmode="decimal" required>${button('+','wageStep','data-value="0.5" aria-label="提高工资"')}</div><p class="hint">0 两 → 0 士气，1 两 → 50 士气，2 两 → 100 士气。＋ / − 每次调整 0.5 两，也可输入一位小数。</p><div id="wage-preview" class="wage-preview" aria-live="polite"></div><div class="modal-actions">${button('保存本局工资','saveWage','','primary')}${button('取消','close')}</div></form><p class="hint">0 工资或工资不足都不会让船员辞职。士气只由设定工资决定，与持有银两无关。保存不消耗回合；工资按发薪时人数计算，总额不足一两向上取整。</p>`,'wages');
    renderWagePreview();
  }
  function renderWagePreview(){
    const input=$('#wage-rate');if(!input)return;
    const valid=input.value!==''&&input.checkValidity(),save=$('[data-action="saveWage"]');
    save.disabled=!valid||!!game.s.dead;
    if(!valid){$('#wage-preview').textContent='请输入 0～2 两，最多一位小数。';return;}
    const pay=game.payroll(Number(input.value)),morale=game.morale(pay.rate);
    $('#wage-preview').innerHTML=`<div><span>保存后的士气</span><strong>${morale.value} / 100</strong></div><div><span>攻击伤害发挥</span><strong>${Math.round(morale.power*100)}%</strong></div><div><span>按目前 ${pay.crew} 名船员</span><strong>每期共 ${pay.total} 两</strong></div><div><span>下次发薪</span><strong>第 ${pay.nextDay} 日（${pay.daysUntil} 日后）</strong></div><div><span>现有银两</span><strong>${game.s.silver} 两</strong></div>${pay.total>game.s.silver?'<p class="wage-shortfall">存银不足时只支付剩余银两，缺额记入日志；船员不会因此辞职。</p>':''}`;
  }
  function openShipyard(){
    const s=game.s,stats=game.stats(),morale=game.morale(),access=game.serviceCheck();
    const cards=['hull','guns','hold','sails'].map(id=>game.config.modules.find(m=>m.id===id)).filter(Boolean).map(m=>{
      const installed=s.modules.includes(m.id),title={hull:'升级船体',guns:'升级火炮',hold:'扩建货舱',sails:'改良帆装'}[m.id];
      const blocked=!access?'请先在友善港口靠岸':installed&&game.occupied()>stats.capacity-(m.capacity||0)?'请先腾出货舱':!installed&&s.modules.length>=game.config.start.slots?'改装位已满':!installed&&s.silver<m.cost?'银两不足':'';
      return `<article class="shipyard-upgrade ${installed?'installed':''}"><div class="subheading"><strong>${title}</strong><span class="tag">${installed?'已安装':`${m.cost} 两`}</span></div><p>${esc(m.description)}</p>${button(installed?`拆除 · 回收 ${Math.floor(m.cost*0.4)} 两`:`安装 · ${m.cost} 两`,installed?'uninstall':'install',`data-value="${m.id}" ${blocked?'disabled':''}`,installed?'full':'primary full')}${blocked?`<small class="upgrade-reason">${blocked}</small>`:''}</article>`;
    }).join('');
    modal('船坞 · 船只升级',`<div class="shipyard-overview"><strong>现银 ${s.silver} 两</strong><span>改装位 ${s.modules.length} / ${game.config.start.slots}</span><span>船体 ${s.hp} / ${stats.maxHp}</span><span>火炮基础 ${stats.baseDamage} · 当前 ${stats.damage}</span></div><p>改装提高船只基础能力；实际伤害还受工资对应的士气影响。当前士气 ${morale.value}/100，伤害发挥 ${Math.round(morale.power*100)}%。</p><div class="shipyard-grid">${cards}</div><p class="hint">船体与火炮共用改装位；每项只能安装一次。槽位满后可拆除已有装备，再选择其他改装。</p>`,'shipyard');
  }
  function openAtlas(){
    modal('西太平洋海图',`<p>地形与港口位置已知；实时情报仅限本船周围 3×3 格。点选下方港口，可在航海图上定位。</p><canvas class="atlas-canvas" id="atlas" aria-label="西太平洋全图"></canvas><div class="port-list">${game.world.ports.map(p=>button(`${esc(p.name)}<small>${esc(game.faction(p.faction))}</small>`,'find',`data-value="${p.id}"`)).join('')}</div><p class="hint">手工简化的海岸轮廓。每格约 0.4°，地理距离与每日航速均作了游戏化处理。</p>`);
    const c=$('#atlas'),r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);c.width=r.width*dpr;c.height=r.height*dpr;const ctx=c.getContext('2d');ctx.scale(dpr,dpr);const step=Math.min(r.width/W.GEO.width,r.height/W.GEO.height),ox=(r.width-W.GEO.width*step)/2,oy=(r.height-W.GEO.height*step)/2;ctx.fillStyle='#20484e';ctx.fillRect(0,0,r.width,r.height);
    for(const cell of game.world.cells){if(cell.type==='land'||cell.type==='coast'){ctx.fillStyle=cell.type==='coast'?'#9da37b':'#758974';ctx.fillRect(ox+cell.x*step,oy+cell.y*step,step+.3,step+.3);}}
    ctx.font='10px "Microsoft YaHei",sans-serif';
    for(const p of game.world.ports){const x=ox+p.x*step,y=oy+p.y*step;ctx.fillStyle=p.id==='penghu'?'#f5bd76':'#ebe0b9';ctx.beginPath();ctx.arc(x,y,p.id==='penghu'?4:2.5,0,Math.PI*2);ctx.fill();ctx.textAlign=p.id==='tayoan'||p.id==='quanzhou'||p.id==='fuzhou'?'right':'left';const dx=ctx.textAlign==='right'?-6:6,dy=p.id==='keelung'?-3:p.id==='penghu'?10:0;ctx.fillText(p.name,x+dx,y+dy);}
    ctx.fillStyle='#ffb877';ctx.beginPath();ctx.arc(ox+game.s.x*step,oy+game.s.y*step,6,0,Math.PI*2);ctx.strokeStyle='#ffb877';ctx.lineWidth=2;ctx.stroke();
  }
  function openHelp(){modal('这条海路，怎么走',`<h3>先把粮食带回家</h3><p>从澎湖出发，筹到 ${game.config.rules.grainGoal} 担粮食后返岛交付。可去西北方泉州或月港买粮，也可以在海岸与乡勇交战夺粮。第一次沿岸夺粮后，会遇见朱氏一家的虚构逃难支线。</p><ol><li>点选相邻格，再点「驶入此格」。每走一格过 1 日，允许斜向移动。电脑也可用方向键或 WASD 移动。</li><li>周围 3×3 格可观察船只与港情；暗礁要驶入后才会发现。远方只显示地理和港名。拖动海图查看远处。</li><li>遭遇出现后，先作出选择。海战中每次指令后敌人反击；战术回合不额外推进航海日。</li><li>粮食是货物，占货舱；补给是船上可直接消耗的储备。可将 1 担粮食转为 10 点补给。</li><li>港口可贸易、维修与招募。每 ${game.config.rules.wageEvery} 日发工钱。补给为零后会饿死船员，并有概率哗变。</li><li>护航时按「跟随商船」行进，到站才给奖励。中途结束与弃货逃跑都没有护航奖励。</li><li>关系达到 ${game.config.rules.flagThreshold} 可在友好港口挂旗。旗帜会带来外交便利，也可能让其他港口拒绝服务。</li></ol><h3>银两与士气</h3><p>银两用于买货、补给、修船、招募、发工钱与改装。每人工资可在士气栏调整为 0～2 两：0 两为 0 士气，1 两为 50 士气，2 两为 100 士气，中间线性变化。保存后立即更新士气与战斗力；0 士气时攻击伤害为正常的 ${Math.round(game.config.morale.minPower*100)}%，满士气时为 100%。炮击、接舷、牵制与火攻都受影响。士气由设定工资决定，与持有银两无关；0 工资或发薪时银两不足都不会让船员辞职。银两仍在发薪日按当时人数扣除，不足时只支付剩余银两并记录缺额。</p><p>所有港口每次点击只招募 1 人、花费 5 两。港口服务下方的「船坞 · 升级船体 / 火炮」可打开升级面板；原来的船舱装备页也可以操作。</p><h3>海战的取舍</h3><p>炮击稳定；接舷依赖人数并损失船员；机动降低敌方反击；火攻消耗补给并持续伤害。这些是从炮战、接舷与火攻抽象出的选择，不是历史海战复原。逃跑必定摆脱当前敌船，代价是全部货物；同行宗室仍在船上。</p><h3>生涯与历史</h3><p>船体为零、船员归零或哗变即结束本局，没有局外成长。筹粮、宗室支线和招抚委任完成后仍可自由航行。年代暂取 1644 年，郑芝龙以 NPC 出现；荷日通商是初始背景。外交数值、剧情人物与开局后的外交新闻均为游戏抽象或虚构。</p><p>大员、鸡笼、泉州、月港、福州、宁波、广州、长崎、釜山、那霸、马尼拉与会安可达。后续内容可以从配置文件扩展。</p><h3>参数与素材</h3><p>右上角齿轮可调整开局资源、事件概率、消耗与难度，并指定本地素材相对路径。保存后在新一局生效。无需联网，浏览器会自动保存本局。</p>`);}
  const fields=[
    ['morale.minPower','零士气时伤害比例',0.1,1,0.05,'0.5 表示正常伤害的 50%'],
    ['start.silver','开局银两',0,9999,1,'两'],['start.crew','开局船员',1,50,1,'人'],['start.hp','船体上限',30,300,1,'点'],['start.supplies','开局补给',1,100,1,'点'],['start.capacity','基础货舱',12,120,1,'格'],['start.slots','改装位',1,4,1,'个'],
    ['rules.supplyUse','每日基础补给消耗',1,10,1,'另加每 20 名船员消耗 1 点'],['rules.wageEvery','工资间隔',2,30,1,'日'],['rules.wagePerCrew','每人工资',0,2,0.1,'两 / 次；决定士气'],['rules.starvationLoss','缺粮每日减员',1,15,1,'人'],['rules.mutinyChance','缺粮哗变概率',0,1,0.01,'0～1，每日独立判定'],['rules.encounterChance','舰船生成概率',0,1,0.01,'0～1，首次观察海格时判定'],['rules.reefChance','暗礁密度',0,0.4,0.005,'0～0.4，开局生成'],['rules.diplomacyEvery','外交变化间隔',2,30,1,'日'],['rules.grainGoal','筹粮任务需求',3,28,1,'担'],['rules.plagueLoss','疫病减员',0,30,1,'人'],['combat.cannonBase','基础炮击伤害',3,35,1,'点'],['rules.flagThreshold','解锁旗帜所需关系',5,80,1,'声望']
  ];
  const getPath=(obj,path)=>path.split('.').reduce((o,k)=>o[k],obj);
  function putPath(obj,path,value){const ps=path.split('.'),last=ps.pop();ps.reduce((o,k)=>o[k],obj)[last]=value;}
  function openSettings(){modal('船长的参数簿',`<p>这些参数影响<strong>下一局</strong>。当前航程保持原有数值。想比较两套参数，可以使用相同的随机种子。</p><form id="settings-form"><div class="settings-grid"><label class="setting-row wide">随机种子<input id="seed-input" value="${game.s.seed}" maxlength="60"><small>相同种子与相同决策可复现一局；留空则随机。</small></label>${fields.map(([path,label,min,max,step,hint])=>`<label class="setting-row">${label}<input name="${path}" type="number" min="${min}" max="${max}" step="${step}" value="${getPath(settings,path)}" required><small>${hint}</small></label>`).join('')}<label class="setting-row wide">船只素材路径<input name="assets.ship" value="${esc(settings.assets.ship)}" placeholder="assets/ship.svg"><small>推荐透明 PNG 或 SVG，正方形图片。</small></label><label class="setting-row wide">船长肖像路径<input name="assets.portrait" value="${esc(settings.assets.portrait)}" placeholder="assets/captain.svg"><small>推荐竖幅图片；把图片放入 assets 文件夹后填写路径。</small></label></div><div class="modal-actions">${button('保存参数','saveSettings','','primary')}${button('保存并以此参数重开','applySettings')}${button('导出参数 JSON','exportSettings')}${button('恢复默认参数','defaults')}</div></form><p class="hint">网页保存的个人参数优先于 config.js。修改文件后，可使用「恢复默认参数」重新读取该文件。素材路径支持同目录与子目录文件。</p>`);}
  function readSettings(){const form=$('#settings-form');if(!form.reportValidity())return null;const result=copy(settings);for(const [path]of fields)putPath(result,path,Number(form.elements.namedItem(path).value));for(const key of ['ship','portrait']){const value=form.elements.namedItem(`assets.${key}`).value.trim();if(!value||/^(?:[a-z]+:|\/|\\)|\.\./i.test(value)){toast('请使用 assets/ship.svg 这样的本地相对路径。');return null;}result.assets[key]=value;}if(result.rules.grainGoal>result.start.capacity){toast('筹粮目标不能大于基础货舱容量。');return null;}return result;}
  function saveSettings(){const next=readSettings();if(!next)return false;settings=next;try{localStorage.setItem(PREFS,JSON.stringify(settings));}catch{toast('浏览器禁止保存参数，本次页面内仍然生效。');return true;}toast('参数已保存，下一局生效。');return true;}
  function startNew(seed){game=new PirateGame(settings,seed||Date.now());ship.src=game.config.assets.ship;selection={x:game.s.x,y:game.s.y};center={...selection};tab='hold';$('#modal').close();render();persist();window.scrollTo({top:0,behavior:'smooth'});toast('新的海路已展开。先为澎湖筹粮。');}
  function restart(){modal('重新扬帆',`<p>本局已航行 ${game.s.day} 日。重新开始会替换这台设备上的当前存档，船只、货物与声望都将归零。</p><div class="modal-actions">${button('随机开局','confirmRestart','','primary')}${button('使用相同种子重开','sameSeed')}${button('保留当前航程','close')}</div>`);}
  function findPort(id){const p=game.world.ports.find(p=>p.id===id);if(!p)return;center={x:p.x,y:p.y};selection={...center};$('#modal').close();render();$('.chart-card').scrollIntoView({behavior:'smooth',block:'start'});toast(`已定位${p.name}。查看完可点「回到船位」。`);}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;if(b.dataset.tab){tab=b.dataset.tab;renderDeck();return;}
    const a=b.dataset.action,v=b.dataset.value;if(!a)return;event.preventDefault();
    if(a==='close'){$('#modal').close();return;}if(a==='help'){openHelp();return;}if(a==='settings'){openSettings();return;}if(a==='atlas'){openAtlas();return;}if(a==='find'){findPort(v);return;}
    if(a==='shipyard'){openShipyard();return;}
    if(a==='wages'){openWages();return;}
    if(a==='wageStep'){const input=$('#wage-rate');input.value=String(Math.round(Math.max(0,Math.min(2,(Number(input.value)||0)+Number(v)))*10)/10);renderWagePreview();return;}
    if(a==='saveWage'){
      const input=$('#wage-rate');if(!input||!$('#wage-form').reportValidity())return;
      act(()=>{const result=game.setWage(Number(input.value));if(result.ok){$('#modal').close();toast('工资已保存，士气与战力已更新。');}return result;});return;
    }
    if(a==='restart'){restart();return;}if(a==='confirmRestart'){startNew();return;}if(a==='sameSeed'){startNew(game.s.seed);return;}
    if(a==='saveSettings'){saveSettings();return;}if(a==='applySettings'){const seed=$('#seed-input').value;if(saveSettings())modal('用新参数重新开始',`<p>参数已保存。继续将替换当前第 ${game.s.day} 日的存档。</p><div class="modal-actions">${button('确认并开始新一局','settingsRestart',`data-value="${esc(seed)}"`,'primary')}${button('保留当前航程','close')}</div>`);return;}
    if(a==='settingsRestart'){startNew(v);return;}
    if(a==='defaults'){settings=copy(PIRATE_CONFIG);try{localStorage.removeItem(PREFS);}catch{}openSettings();toast('已恢复 config.js 中的默认参数。');return;}
    if(a==='exportSettings'){const data=readSettings();if(!data)return;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='penghu-parameters.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);return;}
    if(a==='recenter'){center={x:game.s.x,y:game.s.y};selection={...center};render();return;}
    if(a==='select'){selection={x:Number(b.dataset.x),y:Number(b.dataset.y)};renderDecision();drawMap();return;}
    if(a==='relations'){tab='relations';renderDeck();$('.below-deck').scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(a==='move'){act(()=>game.move(Number(b.dataset.x),Number(b.dataset.y)),{locate:true});return;}
    if(a==='choice'){act(()=>game.choose(v));return;}if(a==='combat'){act(()=>game.combatAction(v));return;}
    if(a==='service'){act(()=>game.service(v));return;}if(a==='buy'||a==='sell'){const qty=Number($(`#qty-${v}`).value);act(()=>game.trade(v,qty,a));return;}
    if(a==='wait'){act(()=>game.wait());return;}if(a==='follow'){act(()=>game.followEscort(),{locate:true});return;}if(a==='endEscort'){act(()=>game.endEscort());return;}
    if(a==='eat'){act(()=>game.consumeGrain());return;}if(a==='deliver'){act(()=>game.deliverGrain());return;}if(a==='install'){act(()=>game.install(v));return;}if(a==='uninstall'){act(()=>game.uninstall(v));return;}if(a==='flag'){act(()=>game.setFlag(v));return;}if(a==='discard'){act(()=>game.discard(v));return;}
    if(a==='coast'){act(()=>{game.setEvent('coast');return{ok:true};});}
  });
  const canvas=$('#map');
  document.addEventListener('input',e=>{if(e.target.id==='wage-rate')renderWagePreview();});
  document.addEventListener('submit',e=>{if(e.target.id==='wage-form'){e.preventDefault();$('[data-action="saveWage"]').click();}});
  canvas.addEventListener('pointerdown',e=>{pan={x:e.clientX,y:e.clientY,center:{...center},moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!pan)return;const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.abs(dx)+Math.abs(dy)>6)pan.moved=true;if(pan.moved){center={x:Math.max(0,Math.min(W.GEO.width-1,pan.center.x-dx/mapMetrics.size)),y:Math.max(0,Math.min(W.GEO.height-1,pan.center.y-dy/mapMetrics.size))};drawMap();}});
  canvas.addEventListener('pointerup',e=>{if(!pan)return;const moved=pan.moved;pan=null;if(moved)return;const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/mapMetrics.size+mapMetrics.left),y=Math.floor((e.clientY-r.top)/mapMetrics.size+mapMetrics.top);if(!game.world.get(x,y))return;selection={x,y};renderDecision();drawMap();if(innerWidth<761&&!game.s.event&&!game.s.combat)$('#decision').scrollIntoView({behavior:'smooth',block:'nearest'});});
  canvas.addEventListener('pointercancel',()=>{pan=null;});
  document.addEventListener('keydown',e=>{if($('#modal').open||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;const dir={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]}[e.key];if(!dir)return;e.preventDefault();act(()=>game.move(game.s.x+dir[0],game.s.y+dir[1]),{locate:true});});
  $('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
  new ResizeObserver(()=>drawMap()).observe($('.map-wrap'));
  render();persist();
  // 提供只读快照，方便原型诊断；玩法状态仍由引擎方法更新。
  window.PenghuPrototype={snapshot:()=>game.export()};
})();
