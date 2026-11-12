// Set each URL only after confirming that its public listing is available.
// Keep null during review: the page must not send players to an unavailable app.
const stores = {
  apple: null,
  google: null,
};

const available = [];
for (const link of document.querySelectorAll('[data-store]')) {
  const store = link.dataset.store;
  const value = stores[store];
  if (!value) continue;
  const url = new URL(value);
  const host = store === 'apple' ? 'apps.apple.com' : 'play.google.com';
  if (url.protocol !== 'https:' || url.hostname !== host) continue;
  link.href = url.href;
  link.removeAttribute('aria-disabled');
  link.setAttribute('aria-label', store === 'apple' ? 'Descargar en App Store' : 'Descargar en Google Play');
  link.querySelector('[data-store-status]').textContent = 'Disponible en';
  available.push(store === 'apple' ? 'App Store' : 'Google Play');
}

if (available.length) {
  const availability = `Disponible en ${available.join(' y ')}.`;
  document.querySelector('[data-availability-note]').textContent = availability;
  document.querySelector('[data-availability-faq]').textContent = `${availability} Utiliza los enlaces del inicio de esta página para descargar la app. También puedes seguir usando la versión web.${available.length === 1 ? ' La otra tienda estará disponible próximamente.' : ''}`;
  document.querySelector('[data-availability-footer]').textContent = `${availability} También en tu navegador.`;
}
