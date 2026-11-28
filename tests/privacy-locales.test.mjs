import{test}from'node:test';import assert from'node:assert/strict';import{privacyPolicies,privacyContact}from'../src/features/legal/privacy.ts';
test('every privacy translation preserves the support contact and deletion URL and describes the current purchase providers',()=>{
 for(const[lang,policy]of Object.entries(privacyPolicies)){
  assert.equal(policy.sections.length,12,lang);assert.ok(policy.sections.every(s=>s.title&&s.paragraphs.every(p=>p.trim())),lang);
  const copy=policy.sections.flatMap(s=>s.paragraphs).join('\n');assert.ok(copy.includes(privacyContact),lang);assert.ok(copy.includes('convosquad.netlify.app/delete-account'),lang);assert.ok(copy.includes('RevenueCat'),lang);assert.ok(policy.providerLinks.some(p=>p.label==='RevenueCat'),lang);
 }
});
