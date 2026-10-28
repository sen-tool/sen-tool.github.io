const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
test('offline bundle includes the record comparison template',()=>{
  const block=html.match(/var BUNDLE = (\[[^]*?\]);/)[1];
  const files=vm.runInNewContext(block);
  assert.ok(files.includes('samples/기록물_대조표_양식.xlsx'));
  for(const file of files) assert.ok(fs.existsSync(file),file);
});
test('all inline scripts compile and all local assets resolve',()=>{
  const path=require('node:path');
  for(const file of ['index.html',...fs.readdirSync('tools').filter(n=>n.endsWith('.html')).map(n=>'tools/'+n)]) {
    const s=fs.readFileSync(file,'utf8');
    for(const m of s.matchAll(/<script\b[^>]*>([^]*?)<\/script>/gi)) new vm.Script(m[1],{filename:file});
    for(const m of s.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
      const link=m[1]; if(/^(https?:|data:|blob:|#|mailto:)/.test(link)||/[{}<>'"]/.test(link))continue;
      const local=link.split(/[?#]/)[0];if(local)assert.ok(fs.existsSync(path.resolve(path.dirname(file),local)),file+': '+local);
    }
  }
});
test('sample fetch timeout releases the button and prevents injection',async()=>{
  let now=0, timer, injected=0;
  const btn={disabled:false},msg={textContent:''};
  const input={dispatchEvent(){injected++;}};
  const frame={getAttribute(){return 'tools/test.html';},contentDocument:{readyState:'complete',querySelector(){return input;}},contentWindow:{File:class{},DataTransfer:class{constructor(){this.items={add(){}};this.files=[];}},Event:class{},document:{querySelector(){return input;}}}};
  const ctx={SAMPLES:{test:{steps:[['#file',['fixture.xlsx']]]}},sampleRun:0,sampleAbort:null,document:{getElementById(){return frame;}},location:{hash:'#test'},Date:{now(){return now;}},AbortController,
    setTimeout(fn){timer=fn;return 1;},clearTimeout(){},wait(){return Promise.resolve();},Promise,
    fetch(url,opts){return new Promise((resolve,reject)=>{if(opts?.signal)opts.signal.addEventListener('abort',()=>reject(new Error('aborted')));});}};
  vm.createContext(ctx);vm.runInContext(html.match(/    function runSample\([^]*?\n    \}/)[0],ctx);
  ctx.runSample('test',btn,msg);await new Promise(setImmediate);now=21000;if(timer)timer();await new Promise(setImmediate);
  assert.equal(btn.disabled,false);assert.equal(injected,0);assert.match(msg.textContent,/못했어요/);
});
