/* =========================================================
   SIGEA · Configuración del frontend
   Único lugar donde se define la dirección de la API.
   ========================================================= */

'use strict';

// ¿La página NO viene del servidor de SIGEA?
//  - se abrió el archivo .html con doble clic (file://), o
//  - se abrió con Live Server de VS Code (puertos 5500 / 5501).
// En esos casos la API está en otro origen: http://localhost:3000
const PAGINA_SIN_BACKEND =
  location.protocol === 'file:' || ['5500', '5501'].includes(location.port);

const SIGEA_CONFIG = Object.freeze({
  // Si la página la entrega el propio backend (http://localhost:3000 o el
  // servidor publicado), la API está en el mismo origen, bajo /api.
  API_URL: PAGINA_SIN_BACKEND ? 'http://localhost:3000/api' : `${location.origin}/api`,

  // Sprint 2 · HU-04 · T18: QR del negocio que se muestra en caja (rutas desde frontend/).
  // Cuando el Gerente entregue el QR real, ver frontend/img/qr/LEEME.md
  QR_PAGO: Object.freeze({
    YAPE: 'img/qr/qr-prueba.svg',
    PLIN: 'img/qr/qr-prueba.svg'
  }),
  QR_ES_PRUEBA: true
});
