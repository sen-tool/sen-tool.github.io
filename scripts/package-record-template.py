"""Apply Artifact Tool-authored formula templates while preserving native XLSX parts.

Usage: python scripts/package-record-template.py ARTIFACT_DRAFT.xlsx TARGET.xlsx
The draft contains row 2 formula masters; native validations, comments, styles,
conditional formatting and sheet order remain in the original target package.
"""
import copy
import re
import sys
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as E

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
E.register_namespace('', NS)
E.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
def q(name): return '{'+NS+'}'+name
def strings(z):
    if 'xl/sharedStrings.xml' not in z.namelist(): return []
    return [''.join(t.text or '' for t in si.iter(q('t'))) for si in E.fromstring(z.read('xl/sharedStrings.xml'))]
def cells(z, path):
    ss = strings(z)
    out = {}
    for c in E.fromstring(z.read(path)).iter(q('c')):
        n = copy.deepcopy(c)
        if n.get('t') == 's':
            value = ss[int(n.find(q('v')).text)]
            n.remove(n.find(q('v'))); n.set('t', 'inlineStr')
            E.SubElement(E.SubElement(n, q('is')), q('t')).text = value
        out[n.get('r')] = n
    return out
def replace(data, source, address, row=None):
    rownum = int(re.search(r'\d+', address)[0])
    parent = next((r for r in data if int(r.get('r')) == rownum), None)
    if parent is None:
        parent = E.SubElement(data, q('row'), {'r':str(rownum)})
    old = next((c for c in parent if c.get('r') == address), None)
    c = copy.deepcopy(source); c.set('r', address)
    # Use existing native style, not the draft's remapped style IDs.
    c.attrib.pop('s', None)
    if old is not None:
        if old.get('s') is not None: c.set('s', old.get('s'))
        parent.remove(old)
    f = c.find(q('f'))
    if f is not None:
        if row is not None:
            f.text = re.sub(r'(\$?[A-Z]{1,3})2\b', lambda m:m[1]+str(row), f.text)
        v=c.find(q('v'))
        if v is not None:c.remove(v)
    parent.append(c)
    def colnum(c):
        n=0
        for x in re.match('[A-Z]+',c.get('r'))[0]:n=n*26+ord(x)-64
        return n
    parent[:] = sorted(parent, key=colnum)

if sys.argv[1] == '--slim':
    # Bounded authoring fixture: avoid expanding millions of range dependencies
    # in import/render. Only row-2 masters are applied to the production package.
    source, target = sys.argv[2:]
    with ZipFile(source) as z, ZipFile(target,'w',ZIP_DEFLATED) as out:
        for n in z.namelist():
            b=z.read(n)
            if n.startswith('xl/worksheets/sheet') and n.endswith('.xml'):
                root=E.fromstring(b); data=root.find(q('sheetData'))
                if data is not None:
                    for row in list(data):
                        if int(row.get('r'))>6:data.remove(row)
                    for f in data.iter(q('f')):
                        if f.text:f.text=f.text.replace('$1001','$6').replace('$3001','$6')
                b=E.tostring(root,encoding='utf-8',xml_declaration=True)
            out.writestr(n,b)
    sys.exit(0)

draft, target = sys.argv[1:]
with ZipFile(draft) as d, ZipFile(target) as z:
    entries={n:z.read(n) for n in z.namelist()}
    # Resolve draft sheet paths by name because import/export may remap numbers.
    rels=E.fromstring(d.read('xl/_rels/workbook.xml.rels'))
    relmap={r.get('Id'):r.get('Target').lstrip('/') for r in rels}
    sheetpaths={s.get('name'):relmap[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] for s in E.fromstring(d.read('xl/workbook.xml')).find(q('sheets'))}
    for k,v in list(sheetpaths.items()):
        if not v.startswith('xl/'):sheetpaths[k]='xl/'+v
    changes={
      '사용법':('xl/worksheets/sheet1.xml',['A7','A12','A18','A19','A20','A21'],{}),
      '보유목록':('xl/worksheets/sheet3.xml',['G1','H1','I1'],{'F':3001,'G':3001,'H':3001,'I':3001}),
      '실물목록':('xl/worksheets/sheet4.xml',['O1','P1','Q1','R1'],{'A':1001,'K':1001,'L':1001,'M':1001,'O':1001,'P':1001,'Q':1001,'R':1001}),
      '위치별요약':('xl/worksheets/sheet5.xml',['A34','A35','A40'],{'B':31,'J':31}),
    }
    for name,(path,fixed,columns) in changes.items():
        source=cells(d,sheetpaths[name]); root=E.fromstring(entries[path]);data=root.find(q('sheetData'))
        for address in fixed:replace(data,source[address],address)
        for col,end in columns.items():
            for r in range(2,end+1):replace(data,source[col+'2'],col+str(r),r)
        if name in ('보유목록','실물목록'):
            cols=root.find(q('cols'))
            if cols is None: cols=E.Element(q('cols'));root.insert(list(root).index(data),cols)
            start,end=(8,9) if name=='보유목록' else (15,18)
            for col in list(cols):
                if int(col.get('min'))==start and int(col.get('max'))==end:cols.remove(col)
            E.SubElement(cols,q('col'),{'min':str(start),'max':str(end),'hidden':'1','width':'12','customWidth':'1'})
            dim=root.find(q('dimension'))
            if dim is not None:dim.set('ref','A1:I3001' if name=='보유목록' else 'A1:R1001')
        data[:]=sorted(data,key=lambda r:int(r.get('r')))
        entries[path]=E.tostring(root,encoding='utf-8',xml_declaration=True)
    root=E.fromstring(entries['xl/workbook.xml']);calc=root.find(q('calcPr'))
    if calc is None:calc=E.SubElement(root,q('calcPr'))
    calc.set('calcMode','auto');calc.set('fullCalcOnLoad','1');calc.set('forceFullCalc','1')
    entries['xl/workbook.xml']=E.tostring(root,encoding='utf-8',xml_declaration=True)
with ZipFile(target,'w',ZIP_DEFLATED) as out:
    for n,b in entries.items():out.writestr(n,b)
print('Packaged formula templates; native styles/validations/comments preserved')
