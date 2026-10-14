import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRosterText, validateImportRows } from '../src/features/players/import-parser.ts';
import { categories, legacyCategory, compareRoster, moveItem } from '../src/features/players/categories.ts';
import { clubLocalTimeToInstant } from '../src/features/call-ups/local-time.ts';
const sample=`FC27
Miércoles 21:50
13/10/2026
🧤 PORTERO 🧤
2️⃣3️⃣alexinstic23😘 ✅
🛡️ CENTRALES 🛡️
0️⃣4️⃣Pato2140🦆
2️⃣4️⃣Salsinhes ✅
⚡ CARRILEROS ⚡
2️⃣1️⃣Samuelscp10
🎩 MCDs / Volantes 🎩
0️⃣6️⃣roaan10
🕹️ MCOs 🕹️
8️⃣Bonifasiosuprimo ✅
⚽ DELANTEROS ⚽
1️⃣0️⃣Kaio Vegas9739
🧲 BACK UP
0️⃣1️⃣spindly_ghost7
0️⃣1️⃣mershgamer (MC)
AYUDAS
1 jugador externo
PRUEBAS
1 dfc`;
test('el formato real conserva categorías, nombres, orden y disponibilidad solo como metadatos',()=>{
 const parsed=parseRosterText(sample); assert.equal(parsed.error,null); assert.equal(parsed.metadata.length,3);
 const checked=validateImportRows(parsed.rows,[]); const players=checked.flatMap(row=>row.player?[row.player]:[]);
 assert.equal(players.length,9); assert.deepEqual(players.map(row=>row.category),['goalkeepers','centre_backs','centre_backs','wide_backs','midfielders','midfielders','attackers','backups','backups']);
 assert.equal(players[0].eaId,'alexinstic23'); assert.equal(players[0].jerseyNumber,23); assert.equal(players[1].jerseyNumber,4);
 assert.equal(players[6].eaId,'Kaio Vegas9739'); assert.equal(players[8].eaId,'mershgamer');
 assert.ok(players.every(row=>!('availability' in row))); assert.equal(parsed.rows[0].availability,'available');
 assert.equal(parsed.rows[9].kind,'aid'); assert.equal(parsed.rows[9].selected,false);
 assert.equal(parsed.rows[10].kind,'trial'); assert.ok(checked[10].errors.length);
});
test('los encabezados oficiales y antiguos se convierten a identificadores estables',()=>{
 for(const [header,category] of [['PORTEROS','goalkeepers'],['CENTRALES','centre_backs'],['LATERALES / CARRILEROS','wide_backs'],['CENTROCAMPISTAS','midfielders'],['ATACANTES','attackers'],['BACKUPS','backups'],['MCOs','midfielders'],['MCDs / Volantes','midfielders'],['DELANTEROS','attackers']]) assert.equal(validateImportRows(parseRosterText(`${header}\n1 - Player`).rows,[])[0].player.category,category);
 assert.deepEqual(categories,['goalkeepers','centre_backs','wide_backs','midfielders','attackers','backups']);
 assert.ok(Object.values(legacyCategory).every(category=>category!=='backups'));
});
test('no pierde espacios, números iniciales o sufijos legítimos de EA IDs bajo encabezados',()=>{
 const rows=parseRosterText('CENTROCAMPISTAS\n0️⃣4️⃣123 EA Name\n2️⃣My EA MC\n3️⃣Skin Tone👍🏽').rows;
 assert.deepEqual(validateImportRows(rows,[]).map(row=>row.player.eaId),['123 EA Name','My EA MC','Skin Tone']);
});
test('PRUEBAS reconoce posición libre y exige revisar entradas de cantidad',()=>{
 const parsed=parseRosterText('PRUEBAS\n23 - Trial Name (central zurdo)\n1 dfc');
 assert.equal(validateImportRows(parsed.rows,[])[0].trial.position,'central zurdo');
 assert.ok(validateImportRows(parsed.rows,[])[1].errors.length);
 const corrected=parsed.rows.map(row=>row.lineNumber===3?{...row,eaId:'Real Trial',jerseyText:'',positionText:'DFC',requiresReview:false}:row);
 assert.equal(validateImportRows(corrected,[])[1].trial.eaId,'Real Trial');
});
test('AYUDAS permanece fuera de importación aunque se marque para incluir',()=>{
 const row=parseRosterText('AYUDAS\nNecesitamos 1 DFC').rows[0]; row.selected=true;
 const checked=validateImportRows([row],[])[0]; assert.equal(checked.player,null); assert.equal(checked.trial,null);
});
test('duplicados entre plantilla, pruebas y lote se rechazan, y dorsales duplicados solo avisan',()=>{
 const rows=parseRosterText('BACKUPS\n1️⃣One\n1️⃣Two\nPRUEBAS\n3 - ONE (DFC)').rows;
 const checked=validateImportRows(rows,[]); assert.ok(checked[0].errors.some(x=>x.includes('duplicado'))); assert.ok(checked[1].warnings.length);
 const existing=validateImportRows([rows[1]],[],[{eaId:'TWO'}]); assert.ok(existing[0].errors.length);
});
test('encabezados no reconocidos y datos ambiguos no se importan silenciosamente',()=>{
 const rows=parseRosterText('CENTRALES\nDEFENSAS EXTRA\n1 DFC\n0 - Invalid\n99Player\n13/10/2026').rows;
 assert.ok(validateImportRows(rows,[]).every(row=>row.errors.length));
});
test('la ordenación respeta categoría y orden manual, y no altera el array original',()=>{
 const rows=[{id:'b',category:'backups',sortOrder:0},{id:'a',category:'goalkeepers',sortOrder:9},{id:'c',category:'goalkeepers',sortOrder:1}];
 assert.deepEqual([...rows].sort(compareRoster).map(row=>row.id),['c','a','b']);
 const ids=['a','b','c']; assert.deepEqual(moveItem(ids,'b',-1),['b','a','c']); assert.deepEqual(ids,['a','b','c']); assert.equal(moveItem(ids,'a',-1),null);
});
test('crear convocatoria interpreta la hora del club y rechaza horas ambiguas o inexistentes',()=>{
 assert.equal(clubLocalTimeToInstant('2026-10-14','21:50','Europe/Madrid'),'2026-10-14T19:50:00.000Z');
 assert.equal(clubLocalTimeToInstant('2026-11-14','21:50','Europe/Madrid'),'2026-11-14T20:50:00.000Z');
 assert.throws(()=>clubLocalTimeToInstant('2026-03-29','02:30','Europe/Madrid'));
 assert.throws(()=>clubLocalTimeToInstant('2026-10-25','02:30','Europe/Madrid'));
 assert.throws(()=>clubLocalTimeToInstant('2026-02-30','21:50','Europe/Madrid'));
});
