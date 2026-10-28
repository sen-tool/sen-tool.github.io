const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('tools/record-photo.html', 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('var PARSE ='), html.indexOf('/* ===== 글자 인식')), ctx);
function fn(name) {
  const match = html.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));
  assert.ok(match, name+' exists'); vm.runInContext(match[0], ctx); return ctx[name];
}
test('normal OCR title splits into matching fields', () => {
  assert.equal(ctx.PARSE.all('2019 가나초 급식실 환기 준공도면').kw, '환기');
});
test('two digit years stay unresolved rather than guessing 2099', () => {
  assert.equal(ctx.PARSE.all('99년 가나초 환기 준공도면').year, '');
  assert.equal(ctx.PARSE.all('99년 가나초 환기 준공도면').school, '가나초');
});
test('missing keyword is included in review even at high OCR confidence', () => {
  const needsCheck = fn('needsCheck');
  assert.equal(needsCheck({conf:100, year:'2019', school:'가나초', kw:'', title:'2019 가나초 LEO 준공도면', hand:{}}), true);
});
test('invalid and missing years require review', () => {
  const needsCheck = fn('needsCheck');
  for (const year of ['', '2O19', '99', '2019.5']) assert.equal(needsCheck({conf:100, year, school:'가나초', kw:'환기', title:'가나초 환기', hand:{}}), true);
});
test('manual override conflicts are visible while values are preserved', () => {
  fn('fillAuto'); const needsCheck = fn('needsCheck');
  const r = {conf:100,title:'2020 다라중 방수 준공도면',year:'2019',school:'가나초',kw:'환기',kind:'준공도면',hand:{year:true,school:true,kw:true}};
  ctx.fillAuto(r); assert.equal(r.year,'2019'); assert.equal(needsCheck(r),true);
});
test('output uses nine B-J values and a numeric four-digit year', () => {
  const out = fn('out'); const a = out({loc:'캐비닛A',year:'2019',school:'가나초',kw:'환기',title:'철',kind:'준공도면',qty:1,orig:'사본',memo:'메모'});
  assert.equal(a.length,9); assert.equal(a[1],2019); assert.equal(a[8],'메모');
});
