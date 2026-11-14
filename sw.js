/* Service worker de República: permet obrir l'app sense connexió.

   - La pàgina (index.html): primer la xarxa, perquè les versions noves arribin
     de seguida; si no hi ha xarxa (o triga més de 4 s), la còpia desada.
     Per això JA NO cal canviar VERSIO cada cop que es puja un index.html nou.
   - Fitxers propis (manifest, icones): còpia desada i renovació per darrere.
   - Tipografies (Google Fonts) i hls.js (jsDelivr, per a algunes ràdios): igual.
   - Tota la resta va sempre directa a la xarxa i no es desa mai: el temps, la
     ubicació, els festius, la Viquipèdia, les notícies, els podcasts i les ràdios.

   VERSIO només s'ha de canviar si es canvia aquest fitxer i es vol llençar tot el
   que hi havia desat. El nom porta el prefix del projecte perquè la memòria
   (Cache Storage) és compartida per totes les apps del mateix domini: cada app
   només ha d'esborrar les seves pròpies versions velles, mai les de les altres
   (abans, en activar-se, esborrava també les de Kasio, Antaviana, etc.). */
const VERSIO = 'republica-v63';
const BASE = ['./', './index.html', './manifest.webmanifest',
  './icones/apple-touch-icon.png', './icones/icona-192.png', './icones/icona-512.png',
  './icones/icona-maskable-512.png', './icones/favicon-32.png'];
const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
const ESPERA_PAGINA_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSIO)
      // un fitxer que falti no ha d'impedir la instal·lació (amb addAll, un sol 404 ho feia fallar tot)
      .then(c => Promise.all(BASE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// Només les versions velles d'aquesta app
const esVella = k => k.startsWith('republica-') && k !== VERSIO;

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(esVella).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Només es desen respostes bones (o opaques, com el full d'estil de les tipografies)
const desable = r => r && (r.ok || r.type === 'opaque');
const desa = (req, r) => desable(r) ? caches.open(VERSIO).then(c => c.put(req, r)).catch(() => {}) : Promise.resolve();

// Pàgina: xarxa primer, amb temps límit; si falla, la còpia desada
function pagina(e){
  const req = e.request;
  const copia = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')).then(r => r || caches.match('./'));
  const xarxa = fetch(req).then(r => {
    // la versió nova es desa amb els dos noms de la pàgina («./» i «./index.html»): sense connexió surt sempre
    // la darrera que s'ha vist. Una pàgina d'error (404, 500) no substitueix mai la bona.
    if (desable(r)) e.waitUntil(Promise.all([desa('./', r.clone()), desa('./index.html', r.clone())]));
    return r;
  });
  const lenta = new Promise(res => setTimeout(res, ESPERA_PAGINA_MS)).then(copia);
  return Promise.race([xarxa.catch(() => null), lenta]).then(r => r || copia()).then(r => r || xarxa);
}

// Fitxers estàtics: còpia desada de seguida i renovació per darrere
function copiaIRenova(e){
  const req = e.request;
  return caches.match(req).then(hit => {
    const nova = fetch(req).then(r => desable(r) ? desa(req, r.clone()).then(() => r) : r);
    if (hit){ e.waitUntil(nova.catch(() => {})); return hit; }
    return nova;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  if (url.origin === self.location.origin){
    const esPagina = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    e.respondWith(esPagina ? pagina(e) : copiaIRenova(e));
    return;
  }
  if (CDN.includes(url.hostname)) e.respondWith(copiaIRenova(e));
  // qualsevol altre servidor (APIs, notícies, ràdios, podcasts): no s'intercepta
});
