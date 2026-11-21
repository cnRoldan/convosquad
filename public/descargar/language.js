import { renderStores } from './stores.js';

const languages = ['es', 'en', 'de', 'fr'];
const storageKey = 'convosquad.landing.language';
const selector = document.querySelector('[data-language-select]');
const control = document.querySelector('[data-language-control]');
const cache = new Map([['es', {}]]);
let currentLanguage = 'es';
let requestId = 0;

// Keep the original Spanish text nodes so inline links, icons and emphasis survive switches.
const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, {
  acceptNode(node) {
    return node.textContent.trim() && !node.parentElement.closest('script, style, svg, [data-language-control]')
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  },
});
const textNodes = [];
while (walker.nextNode()) textNodes.push({ node: walker.currentNode, source: walker.currentNode.textContent });
const attributes = [];
for (const element of document.querySelectorAll('[alt], [aria-label], meta[name="description"], meta[property^="og:"]')) {
  if (element.closest('[data-language-control]')) continue;
  for (const name of ['alt', 'aria-label', 'content']) {
    if (element.hasAttribute(name)) attributes.push({ element, name, source: element.getAttribute(name) });
  }
}

function supported(value) {
  const code = value?.toLowerCase().split(/[-_]/)[0];
  return languages.includes(code) ? code : null;
}
function initialLanguage() {
  const explicit = supported(new URL(location.href).searchParams.get('lang'));
  if (explicit) return explicit;
  try {
    const saved = supported(localStorage.getItem(storageKey));
    if (saved) return saved;
  } catch { /* Browsing with storage blocked still supports language selection. */ }
  return (navigator.languages ?? [navigator.language]).map(supported).find(Boolean) ?? 'es';
}
async function translationsFor(language) {
  if (!cache.has(language)) {
    const response = await fetch(new URL(`./locales/${language}.json`, import.meta.url));
    if (!response.ok) throw new Error('Landing translation unavailable');
    cache.set(language, await response.json());
  }
  return cache.get(language);
}
async function setLanguage(language, remember = false) {
  const id = ++requestId;
  let translations;
  try { translations = await translationsFor(language); }
  catch { if (id === requestId) selector.value = currentLanguage; return; }
  if (id !== requestId) return;
  const translate = source => translations[source] ?? source;
  for (const { node, source } of textNodes) {
    node.textContent = source.replace(source.trim(), translate(source.trim()));
  }
  for (const { element, name, source } of attributes) element.setAttribute(name, translate(source));
  document.documentElement.lang = language;
  document.querySelector('meta[property="og:locale"]').content = { es: 'es_ES', en: 'en_GB', de: 'de_DE', fr: 'fr_FR' }[language];
  control.querySelector('span').textContent = translate('Idioma');
  selector.setAttribute('aria-label', translate('Idioma de la página'));
  selector.value = language;
  currentLanguage = language;
  renderStores(translate);
  if (remember) {
    try { localStorage.setItem(storageKey, language); } catch { /* Optional preference. */ }
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url);
  }
}

// Spanish HTML and the Google Play link remain usable if scripts or translation files fail.
renderStores();
control.hidden = false;
selector.addEventListener('change', () => { void setLanguage(selector.value, true); });
void setLanguage(initialLanguage());
