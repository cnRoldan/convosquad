import assert from 'node:assert/strict';
import {test,afterEach} from 'node:test';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import {i18n,t,supportedLanguage,intlLocale} from '../src/features/i18n/runtime.ts';
import {pushMessage} from '../supabase/functions/_shared/push-event.ts';
afterEach(async()=>{await i18n.changeLanguage('es');});
test('idioma detectado admite variantes y vuelve a español si no está disponible',()=>{
 assert.equal(supportedLanguage('en-US'),'en');assert.equal(supportedLanguage('de-DE'),'de');assert.equal(supportedLanguage('fr_FR'),'fr');assert.equal(supportedLanguage('it-IT'),'es');
});
test('catálogos completos conservan variables y traducciones no alteran los nombres',async()=>{
 const catalogs=['es','en','de','fr'].map(lang=>JSON.parse(readFileSync(new URL(`../src/features/i18n/locales/${lang}.json`,import.meta.url),'utf8')));
 const keys=Object.keys(catalogs[0]).sort();
 for(const catalog of catalogs){assert.deepEqual(Object.keys(catalog).sort(),keys);for(const [key,value] of Object.entries(catalog)){
  assert.ok(value.trim());const vars=text=>[...text.matchAll(/\{\{v\d+\}\}/g)].map(match=>match[0]).sort();assert.deepEqual(vars(value),vars(key),key);
 }}
 const missing=new Set();
 function scan(directory){for(const name of readdirSync(directory)){
  const file=path.join(directory,name);if(statSync(file).isDirectory()){scan(file);continue;}
  if(!/\.tsx?$/.test(file))continue;
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='t'&&ts.isStringLiteral(node.arguments[0])&&!(node.arguments[0].text in catalogs[0]))missing.add(node.arguments[0].text);ts.forEachChild(node,visit);}
  visit(source);
 }}
 scan(new URL('../src/',import.meta.url).pathname);assert.deepEqual([...missing],[]);
 await i18n.changeLanguage('en');assert.equal(t('Cambiar idioma'),'Change language');assert.equal(intlLocale(),'en-GB');
 assert.ok(t('WhatsApp de {{v0}}',{v0:'WABI SABI'}).includes('WABI SABI'));
});
test('push usa idioma del destinatario y conserva identificadores y acciones',()=>{
 const event={clubId:'club',callUpId:'call',eventKey:'event',kind:'published'};
 for(const [lang,title] of [['es','Nueva convocatoria'],['en','New call-up'],['de','Neues Aufgebot'],['fr','Nouvelle convocation']]){
  const message=pushMessage(event,'ExponentPushToken[fixture]','user',true,lang);assert.equal(message.title,title);assert.equal(message.categoryId,'call_up_availability');assert.equal(message.data.userId,'user');
 }
 assert.equal(pushMessage(event,'fixture','user',true,'it').title,'Nueva convocatoria');
});
