// HYPERFORMULA_MODULE may point to an installed HyperFormula package.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {HyperFormula}=require(process.env.HYPERFORMULA_MODULE||'hyperformula');
const XLSX=require('../tools/ocr/xlsx.mini.min.js');
const source=XLSX.read(fs.readFileSync(process.env.WORKBOOK_SOURCE||'samples/기록물_대조표_양식.xlsx'),{type:'buffer',cellFormula:true,sheetStubs:true});
const cases=[
 ['numeric/text years',2019,'2019','환기','가나초','실물 있음',1],
 ['different year','2019',2020,'환기','가나초','확인필요(연도다름)',0],
 ['missing keyword',2019,2019,'','가나초','확인필요(입력누락)',0],
 ['blank years','','','환기','가나초','확인필요(입력누락)',0],
 ['year normalization','2019년',' 2019 ','환기','가나초','실물 있음',1],
 ['OCR year typo',2019,'2O19','환기','가나초','확인필요(입력누락)',0],
 ['unmatched school',2019,2019,'환기','다라중','실물 없음',0],
 ['literal wildcard',2019,2019,'*','가나초','실물 없음',0],
 ['same year count',2019,2019,'환기','가나초','실물 있음',1,2020],
 ['missing school',2019,2019,'환기','','실물 없음',0],
 ['short year','19',2019,'환기','가나초','확인필요(입력누락)',0],
 ['full school name',2019,2019,'환기','가나초등학교','실물 있음',1],
];
for(const [name,hy,py,kw,school,status,count,extra]of cases)test(name,()=>{
 const sheets={};for(const name of ['보유목록','실물목록']){
  sheets[name]=Array.from({length:6},(_,r)=>Array.from({length:18},(_,c)=>{
   const cell=source.Sheets[name][XLSX.utils.encode_cell({r,c})];
   // Quote Korean sheet names for HyperFormula's parser; Excel allows them bare.
   return cell?.f?'='+cell.f.replace(/\$1001/g,'$6').replace(/\$3001/g,'$6').replace(/(보유목록|실물목록)!/g,"'$1'!"):null;
  }));
 }
 Object.assign(sheets['보유목록'][1],{0:hy,1:'가나초등학교 환기개선공사 준공도면'});
 Object.assign(sheets['실물목록'][1],{2:py,3:school,4:kw,5:'가나초 환기 준공도면'});
 if(extra)Object.assign(sheets['실물목록'][2],{2:extra,3:'가나초',4:'환기',5:'가나초 환기 준공도면'});
 const hf=HyperFormula.buildFromSheets(sheets,{licenseKey:'gpl-v3',useArrayArithmetic:true});
 assert.deepEqual(hf.getSheetValues(hf.getSheetId('보유목록'))[1].slice(5,7),[status,count]);
 if(['missing keyword','OCR year typo','missing school'].includes(name))assert.equal(hf.getSheetValues(hf.getSheetId('실물목록'))[1][10],'확인필요(입력누락)');
 hf.destroy();
});
test('location summary includes an incomplete row with missing school',()=>{
 const sheets={};for(const name of source.SheetNames){
  sheets[name]=Array.from({length:42},(_,r)=>Array.from({length:18},(_,c)=>{
   const cell=source.Sheets[name][XLSX.utils.encode_cell({r,c})];
   if(cell?.f)return '='+cell.f.replace(/\$1001/g,'$6').replace(/\$3001/g,'$6').replace(/(보유목록|실물목록|설정)!/g,"'$1'!");
   return name==='실물목록'&&r>0?null:(cell?.v??null);
  }));
 }
 Object.assign(sheets['실물목록'][1],{1:'사무실 캐비닛A',2:2019,3:null,4:'환기',5:'가나초 환기 준공도면',7:1});
 const hf=HyperFormula.buildFromSheets(sheets,{licenseKey:'gpl-v3',useArrayArithmetic:true});const values=hf.getSheetValues(hf.getSheetId('위치별요약'));
 assert.equal(values[1][1],1);assert.equal(values[1][3],1);assert.match(values[34][0],/입력누락 1줄/);hf.destroy();
});
