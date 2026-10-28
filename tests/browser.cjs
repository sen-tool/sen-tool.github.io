// npm/playwright must be available. CHROMIUM_EXECUTABLE may point to a local browser.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('playwright');
let server,browser,base;
before(async()=>{
 const root=path.resolve('.');
 server=require('node:http').createServer((req,res)=>{
  let file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));if(file===root+'/')file+='index.html';
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');
  fs.readFile(file,(e,b)=>{res.statusCode=e?404:200;res.end(e?'missing':b);});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r));});
async function record(){
 const c=await browser.newContext();await c.addInitScript(()=>localStorage.setItem('seomu.recordPhoto.v1',JSON.stringify([{id:1,loc:'캐비닛A',year:'2019',school:'가나초',kw:'환기',title:'2019 가나초 환기 준공도면',kind:'준공도면',qty:1,orig:'사본',memo:'',conf:100,hand:{}}])));
 const p=await c.newPage();await p.goto(base+'/tools/record-photo.html');return {c,p};
}
test('editing keeps the next-cell focus and manual conflict can be reset',async()=>{
 const {c,p}=await record();
 await p.locator('[data-k=loc]').fill('캐비닛B');await p.locator('[data-k=loc]').press('Tab');
 assert.equal(await p.evaluate(()=>document.activeElement.dataset.k),'year');
 await p.locator('[data-k=year]').fill('2020');await p.locator('[data-k=year]').press('Tab');
 assert.match(await p.locator('.check-note').innerText(),/직접 고친 값과 제목이 다름/);
 p.once('dialog',d=>d.accept());await p.locator('[data-op=reset]').click();
 assert.equal(await p.locator('[data-k=year]').inputValue(),'2019');await c.close();
});
test('record export has nine columns and clipboard failure is reported',async()=>{
 const {c,p}=await record();
 await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true});document.execCommand=()=>false;});
 await p.locator('#copyBtn').click();await p.waitForFunction(()=>document.querySelector('#copyMsg').textContent.includes('복사하지 못했어요'));
 const wait=p.waitForEvent('download');await p.locator('#xlsxBtn').click();const dl=await wait;
 const XLSX=require('../tools/ocr/xlsx.mini.min.js');const w=XLSX.read(fs.readFileSync(await dl.path()),{type:'buffer'});
 const rows=XLSX.utils.sheet_to_json(w.Sheets['실물목록'],{header:1});assert.equal(rows[0].length,9);assert.equal(rows[1][1],2019);assert.equal(rows[1][2],'가나초');
 await c.close();
});
test('switching tools cancels the previous sample injection',async()=>{
 const c=await browser.newContext();const p=await c.newPage();let release,seen;
 const gate=new Promise(r=>release=r),started=new Promise(r=>seen=r);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/samples/*',async route=>{seen();await gate;await route.continue().catch(()=>{});});
 await p.goto(base+'/#overtime-meal');await p.frameLocator('#viewer-frame').locator('#file').waitFor({state:'attached'});await p.locator('.try-btn').click();await started;
 await p.evaluate(()=>location.hash='overtime-missing');await p.frameLocator('#viewer-frame').locator('#f1').waitFor({state:'attached'});release();await p.waitForTimeout(500);
 assert.equal(await p.frameLocator('#viewer-frame').locator('#f1').evaluate(e=>e.files.length),0);assert.deepEqual(errors,[]);await c.close();
});
