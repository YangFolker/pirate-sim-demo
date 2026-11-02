// 本地静态服务器：只提供原型资源，不暴露工作目录中的其他文件。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const allowed = new Set(['index.html','style.css','app.js','config.js','world.js','engine.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';}catch{res.writeHead(400).end();return;}
  const full=path.resolve(root,name),relative=path.relative(root,full),normalized=relative.replace(/\\/g,'/');
  const asset=normalized.startsWith('assets/')&&/^\.(svg|png|jpg|jpeg|webp)$/i.test(path.extname(full));
  if(relative.startsWith('..')||path.isAbsolute(relative)||(!allowed.has(normalized)&&!asset)){res.writeHead(404).end('Not found');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  fs.readFile(full,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);});
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is already in use. Open http://localhost:${port}`:e.message);process.exitCode=1;});
server.listen(port,'0.0.0.0',()=>{
  console.log(`Penghu prototype: http://localhost:${port}`);
  for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)console.log(`Same-Wi-Fi phone: http://${n.address}:${port}`);
  console.log('Keep this window open while playing. Ctrl+C stops the server.');
});
