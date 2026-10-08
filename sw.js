// Service worker de República: permet obrir l'app sense connexió.
// Canvia VERSIO cada cop que pugis una nova versió de l'index.html.
const VERSIO = 'republica-v30';
const BASICS = ['./', './index.html', './manifest.webmanifest',
  './icones/apple-touch-icon.png', './icones/icona-192.png', './icones/icona-512.png',
  './icones/icona-maskable-512.png', './icones/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIO).then(c => c.addAll(BASICS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claus => Promise.all(claus.filter(k => k !== VERSIO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Lletres de Google Fonts: es desen el primer cop i després es serveixen des de la memòria
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.open(VERSIO).then(c => c.match(req).then(r => r || fetch(req).then(x => { c.put(req, x.clone()); return x; }))));
    return;
  }

  // Qualsevol altra cosa d'un altre servidor (temps, lloc, festius, ràdios, podcasts,
  // notícies): directament a la xarxa, sense passar pel service worker
  if (url.origin !== self.location.origin) return;

  // La pàgina: primer la xarxa (per rebre actualitzacions); sense connexió, la còpia desada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(x => {
      const copia = x.clone();
      caches.open(VERSIO).then(c => c.put('./index.html', copia));
      return x;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // La resta (icones, manifest): primer la còpia desada
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
