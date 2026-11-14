// exportar.js: exporta para Excel (.xlsx) exatamente o que está filtrado na tela.
// Sem bibliotecas externas (não precisa mexer na CSP). Textos entram como TEXTO no Excel,
// então um valor como "=1+1" na descrição nunca vira fórmula (proteção contra injeção).
(() => {
const enc = new TextEncoder();
const tab = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = tab[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zip(files) { // ZIP sem compressão (suficiente para .xlsx)
  const parts = [], cen = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.n), d = enc.encode(f.d), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nm, d); cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + d.length;
  }
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cen.reduce((a, b) => a + b.length, 0), true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const xe = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const col = i => String.fromCharCode(65 + i);

// célula: {v, t: 's' texto | 'n' número | 'd' data, s: estilo (1 cabeçalho, 2 data, 3-6 cores de urgência)}
function sheetXml(cab, linhas, larg) {
  const cel = (c, r, x) => { const s = x.s ? ` s="${x.s}"` : '';
    return x.t === 's' ? `<c r="${col(c)}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${xe(x.v)}</t></is></c>` : `<c r="${col(c)}${r}"${s}><v>${+x.v}</v></c>`; };
  const rows = [cab.map(v => ({ v, t: 's', s: 1 })), ...linhas].map((l, i) => `<row r="${i + 1}">${l.map((x, c) => cel(c, i + 1, x)).join('')}</row>`).join('');
  return `${X}<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${col(cab.length - 1)}${linhas.length + 1}"/></worksheet>`;
}

const fill = c => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/></patternFill></fill>`;
const STYLES = `${X}<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('FF1F2937')}${fill('FFF87171')}${fill('FFFCA5A5')}${fill('FFFDBA74')}${fill('FFFDE68A')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function montarXlsx(sheets) { // sheets: [{nome, cab, linhas, larg}]
  const n = sheets.length, R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', P = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const files = [
    { n: '[Content_Types].xml', d: `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { n: '_rels/.rels', d: `${X}<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { n: 'xl/workbook.xml', d: `${X}<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { n: 'xl/_rels/workbook.xml.rels', d: `${X}<Relationships xmlns="${P}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>` },
    { n: 'xl/styles.xml', d: STYLES },
    ...sheets.map((s, i) => ({ n: `xl/worksheets/sheet${i + 1}.xml`, d: sheetXml(s.cab, s.linhas, s.larg) }))
  ];
  return zip(files);
}
globalThis.montarXlsx = montarXlsx;
if (typeof document === 'undefined') return; // (teste fora do navegador)

// ---------- exportar o que está na tela (usa cur, cls, hoje, lojaNome, dl, toast do app.js) ----------
const serial = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 + 25569; };
function exportar(p) {
  const rows = cur[p]; if (!rows || !rows.length) return toast('Nada para exportar com este filtro', 1);
  const h = hoje(), rel = p === 'rel', cor = { k: 3, r: 4, o: 5, y: 6 };
  const sel = id => { const e = $(`#${p}-${id}`); return e && e.value ? (e.selectedOptions ? e.selectedOptions[0].text : e.value) : ''; };
  const linhas = rows.map(r => {
    const d = Math.round((new Date(r.validade + 'T00:00') - new Date(h + 'T00:00')) / 864e5);
    const l = [{ v: lojaNome(r.loja_id), t: 's' }, { v: r.ean, t: 's' }, { v: r.descricao || 'Sem descrição', t: 's' }, { v: r.quantidade, t: 'n' },
      { v: serial(r.validade), t: 'd', s: 2 }, { v: d < 0 ? `Vencido há ${-d} d` : d === 0 ? 'Vence hoje' : `Faltam ${d} d`, t: 's', s: rel ? cor[cls(r.validade)] : 0 }, { v: d, t: 'n' }];
    if (!rel) l.push({ v: r.motivo + (r.motivo_texto ? ' – ' + r.motivo_texto : ''), t: 's' }, { v: r.por, t: 's' });
    return l;
  });
  const cab = ['Loja', 'EAN', 'Descrição', 'Quantidade', 'Validade', 'Situação', 'Dias p/ vencer', ...(rel ? [] : ['Motivo', 'Excluído por'])];
  const info = [['Lista', rel ? 'Relatório (itens em estoque)' : 'Itens excluídos'], ['Loja', sel('lj') || 'Todas que você pode ver'],
    ['Validade de', sel('de')], ['Validade até', sel('ate')], ['Vencem em até', sel('m') || 'Todos'], ['Ordem', sel('o')], ['Busca', $(`#${p}-q`).value.trim()],
    ['Total de itens', rows.length], ['Soma das quantidades', rows.reduce((a, r) => a + (+r.quantidade || 0), 0)],
    ['Gerado em', new Date().toLocaleString('pt-BR')], ['Gerado por', me.nome]].map(([a, b]) => [{ v: a, t: 's' }, { v: b, t: 's' }]);
  dl(montarXlsx([{ nome: rel ? 'Relatório' : 'Excluídos', cab, linhas, larg: [18, 16, 44, 12, 12, 18, 14, 30, 18] },
    { nome: 'Filtros aplicados', cab: ['Filtro', 'Valor'], linhas: info, larg: [24, 36] }]), `validade-${rel ? 'relatorio' : 'excluidos'}-${h}.xlsx`);
  toast(`Excel gerado com ${rows.length} itens`);
}
['rel', 'exc'].forEach(p => { const b = $('#xl-' + p); if (b) b.onclick = () => exportar(p); });
})();