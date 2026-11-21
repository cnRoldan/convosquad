// Set each URL only after confirming that its public listing is available.
// Keep null during review: the page must not send players to an unavailable app.
const stores = {
  apple: null,
  google: 'https://play.google.com/store/apps/details?id=com.convosquad.app',
};

export function renderStores(translate = text => text) {
  const available = [];
  for (const link of document.querySelectorAll('[data-store]')) {
    const store = link.dataset.store;
    const name = store === 'apple' ? 'App Store' : 'Google Play';
    const value = stores[store];
    link.querySelector('[data-store-status]').textContent = translate('Próximamente en');
    link.setAttribute('aria-disabled', 'true');
    link.removeAttribute('href');
    link.setAttribute('aria-label', translate('{store}: próximamente').replace('{store}', name));
    if (!value) continue;
    const url = new URL(value);
    const host = store === 'apple' ? 'apps.apple.com' : 'play.google.com';
    if (url.protocol !== 'https:' || url.hostname !== host) continue;
    link.href = url.href;
    link.removeAttribute('aria-disabled');
    link.setAttribute('aria-label', translate('Descargar en {store}').replace('{store}', name));
    link.querySelector('[data-store-status]').textContent = translate('Disponible en');
    available.push(name);
  }
  const availability = available.length
    ? translate('Disponible en {stores}.').replace('{stores}', available.join(translate(' y ')))
    : translate('Estamos preparando el lanzamiento en las tiendas.');
  document.querySelector('[data-availability-note]').textContent = availability;
  document.querySelector('[data-availability-faq]').textContent = [
    availability,
    translate('Utiliza los enlaces del inicio de esta página para descargar la app. También puedes seguir usando la versión web.'),
    available.length === 1 ? translate('La otra tienda estará disponible próximamente.') : '',
  ].filter(Boolean).join(' ');
  document.querySelector('[data-availability-footer]').textContent = available.length
    ? `${availability} ${translate('También en tu navegador.')}`
    : translate('Las apps para iOS y Android llegarán pronto.');
}
