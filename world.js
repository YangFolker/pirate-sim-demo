(function (root) {
  'use strict';
  const GEO = { minLon: 107, maxLon: 142, minLat: 5, maxLat: 41, step: 0.4, width: 88, height: 91 };
  // 手绘低分辨率海岸轮廓，保留主要地理相对位置，不作为导航地图。
  const LAND = [
    [[107,41],[124,41],[121.6,39.8],[121,39],[122.6,37.8],[122.4,36.9],[120.1,36],[119.3,34.8],[120.9,32.5],[121.8,31],[121.2,29],[121.6,28.3],[120.5,27],[119.6,26],[118.5,24.6],[116.6,23],[114.2,22.5],[112.5,21.7],[110.4,21.2],[110.2,20.2],[109.8,21.4],[108,21.5],[107,21]],
    [[124,41],[130.9,41],[129.4,39],[129.5,37],[129.4,35.4],[128.5,34.6],[126.5,34.5],[126.1,36],[126.7,37.7],[125.1,38.5],[124,40]],
    [[130,31],[131.4,31.4],[131.9,32.8],[131,33.9],[129.6,33.4],[129.8,32.4]],
    [[130.6,34.1],[132,34],[134.5,34.5],[135.1,33.5],[136.8,34.4],[138.3,34.7],[139.8,35.2],[140.9,36.3],[141.7,39.5],[140.9,41],[139.9,40.7],[139.5,38.3],[137.1,37.3],[136,35.8],[134,35.6],[132,35.5]],
    [[132,33.1],[133.1,32.8],[134.7,33.6],[134.3,34.3],[132.7,34.1]],
    [[121.6,25.3],[122,25],[121.8,24],[121,22.2],[120.7,21.8],[120.2,22.5],[120.1,23.7],[120.7,24.7]],
    [[109,20.1],[110.7,20],[111.2,19.5],[110.5,18.2],[109.2,18.1],[108.6,19.2]],
    [[107,21],[108,21.5],[106.8,20],[106,19],[108.4,16.2],[109.3,13],[109.2,11.4],[106.7,8.7],[104.8,9.3],[104.5,11],[103,12],[101,13],[100,12],[101,6],[107,5]],
    [[120.6,18.6],[121.9,18.4],[122.4,17],[121.7,15.7],[122.6,14],[124,12.8],[123.5,12.6],[121.6,14.2],[120.5,14.4],[119.9,16.3]],
    [[124.2,11.3],[125.4,11.5],[125.8,10.4],[125.3,9.6],[124.4,10]],
    [[122.1,11.8],[123.2,11.4],[123.6,9.1],[122.3,9],[122,10.4]],
    [[125.2,9.7],[126.3,8.9],[126.6,7],[125.7,5.8],[124.5,6.1],[123.4,7.5],[122,6.8],[121.8,8],[123,8.7],[124.5,8.4]],
    [[119.3,5],[117,7.1],[115.4,6.7],[113,4.8],[111,3],[118,1]],
    [[119.3,11.5],[118.7,10.2],[117.2,8],[117.1,9],[118.2,10.6]]
  ];
  const PORTS = [
    { id:'penghu', name:'澎湖', lon:119.6, lat:23.6, faction:'home', flavor:'风浪里的家。缺粮的岛民，仍在等你的船。', multipliers:[1.7,1.1,1.05,1.2] },
    { id:'quanzhou', name:'泉州', lon:118.8, lat:24.8, faction:'ming', flavor:'刺桐旧港，米行与绸庄挤满临海街巷。', multipliers:[0.65,0.72,0.8,1.4] },
    { id:'yuegang', name:'月港', lon:118.0, lat:24.4, faction:'ming', flavor:'闽南商船往来之地，海商的消息比风还快。', multipliers:[0.8,0.8,0.65,1.25] },
    { id:'fuzhou', name:'福州', lon:119.6, lat:26, faction:'ming', flavor:'闽江口的水师注视着每一面陌生旗帜。', multipliers:[0.75,0.9,0.85,1.45] },
    { id:'tayoan', name:'大员', lon:120.0, lat:23.0, faction:'dutch', flavor:'热兰遮城外，货栈收进各地的生丝与砂糖。', multipliers:[1.0,1.45,1.35,0.85] },
    { id:'keelung', name:'鸡笼', lon:121.6, lat:25.2, faction:'dutch', flavor:'北部海湾中的据点，商馆正在收购粮食。', multipliers:[1.35,1.35,1.2,0.95] },
    { id:'guangzhou', name:'广州', lon:113.6, lat:22.4, faction:'ming', flavor:'珠江入海，南来北往的货物在此汇聚。', multipliers:[0.85,0.75,0.75,1.1] },
    { id:'ningbo', name:'宁波', lon:121.6, lat:29.6, faction:'ming', flavor:'浙东海口，北上旅途的一处避风港。', multipliers:[0.9,0.75,0.85,1.5] },
    { id:'nagasaki', name:'长崎', lon:129.6, lat:32.6, faction:'japan', flavor:'出岛商馆外，入港手续由当地奉行查验。', multipliers:[1.15,1.75,1.55,1.25] },
    { id:'busan', name:'釜山', lon:129.2, lat:35.0, faction:'joseon', flavor:'朝鲜南岸港湾。原型将地方补给与贸易作了简化。', multipliers:[0.95,1.5,1.35,1.6] },
    { id:'naha', name:'那霸', lon:127.6, lat:26.2, faction:'ryukyu', flavor:'琉球群岛的中转海港，帆影来自四面八方。', multipliers:[1.2,1.45,1.3,1.15] },
    { id:'manila', name:'马尼拉', lon:120.8, lat:14.6, faction:'iberian', flavor:'吕宋的银币与中国货物在码头上交换。', multipliers:[0.75,1.7,1.5,0.7] },
    { id:'hoian', name:'会安', lon:108.4, lat:16.0, faction:'local', flavor:'南洋商埠，香料与粮食的价格都很诱人。', multipliers:[0.7,1.4,1.2,0.6] }
  ];
  const xy = (lon,lat) => ({ x:Math.round((lon-GEO.minLon)/GEO.step), y:Math.round((GEO.maxLat-lat)/GEO.step) });
  const key = (x,y) => `${x},${y}`;
  const inPoly = (x,y,p) => { let inside=false; for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y)) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside; };
  const hash = (seed,x,y) => {let h=(seed ^ Math.imul(x+1009,374761393) ^ Math.imul(y+9176,668265263))>>>0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  function create(seed,config){
    const cells=[];
    for(let y=0;y<GEO.height;y++)for(let x=0;x<GEO.width;x++){
      const lon=GEO.minLon+x*GEO.step,lat=GEO.maxLat-y*GEO.step;
      const land=LAND.some(p=>inPoly(lon,lat,p));cells.push({x,y,lon,lat,type:land?'land':'sea',reef:!land&&hash(seed,x,y)<config.rules.reefChance});
    }
    const get=(x,y)=> x>=0&&y>=0&&x<GEO.width&&y<GEO.height?cells[y*GEO.width+x]:null;
    for(const c of cells) if(c.type==='land'&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>get(c.x+dx,c.y+dy)?.type==='sea'))c.coastal=true;
    for(const c of cells)if(c.coastal)c.type='coast';
    for(const p of PORTS){const pos=xy(p.lon,p.lat),c=get(pos.x,pos.y);Object.assign(c,{type:'port',port:p.id,reef:false});}
    const home=xy(119.6,23.6);Object.assign(get(home.x,home.y),{type:'port',port:'penghu',reef:false});
    // 澎湖周边保持可航行，出门两格内就能试到商船与海岸。
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const c=get(home.x+dx,home.y+dy);if(c&&!c.port){c.type='sea';c.reef=false;}}
    return {cells,get,home,ports:PORTS.map(p=>({...p,...xy(p.lon,p.lat)}))};
  }
  function path(world,from,to){
    const start=key(from.x,from.y),target=key(to.x,to.y),queue=[from],prev=new Map([[start,null]]);let at=0;
    while(at<queue.length){const c=queue[at++];if(key(c.x,c.y)===target)break;
      for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]){const n=world.get(c.x+dx,c.y+dy);if(!n||n.type==='land'||prev.has(key(n.x,n.y)))continue;prev.set(key(n.x,n.y),c);queue.push({x:n.x,y:n.y});}}
    if(!prev.has(target))return [];const route=[];let c=to;while(key(c.x,c.y)!==start){route.push({x:c.x,y:c.y});c=prev.get(key(c.x,c.y));}return route.reverse();
  }
  root.PirateWorld={GEO,PORTS,LAND,xy,key,hash,create,path};
  if(typeof module!=='undefined')module.exports=root.PirateWorld;
})(typeof globalThis!=='undefined'?globalThis:this);
