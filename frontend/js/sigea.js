/* =========================================================
   SIGEA · Funciones compartidas por todas las pantallas

   Partes del archivo:
     1. Rutas de las páginas
     2. Sesión (token JWT guardado en el navegador)
     3. Llamadas a la API (fetch con el token)
     4. Barra superior (usuario, rol y botón Salir)
     5. Formato de fechas y dinero
     6. Ayudas para crear elementos HTML de forma segura
     7. Estados del abonado (RN-01)

   Todo queda dentro del objeto SIGEA para no llenar el
   navegador de variables sueltas. Ejemplo: SIGEA.api('/abonados')
   ========================================================= */

'use strict';

const SIGEA = (() => {

  /* ---------------------------------------------------------
     1. RUTAS
     Este archivo está en frontend/js/. Subiendo un nivel se
     obtiene la carpeta frontend/, sin importar desde qué
     página se cargó (index.html o pages/*.html).
     --------------------------------------------------------- */
  const RAIZ = new URL('..', document.currentScript.src).href;

  const paginas = {
    login: `${RAIZ}pages/login.html`,
    panel: `${RAIZ}index.html`,
    abonados: `${RAIZ}pages/abonados.html`,
    registro: `${RAIZ}pages/registro-abonado.html`,
    pagos: idAbonado => `${RAIZ}pages/pagos.html?id=${encodeURIComponent(idAbonado)}`
  };

  /* ---------------------------------------------------------
     2. SESIÓN
     Al iniciar sesión, la API entrega un token JWT que dura
     8 horas (RN-06). Se guarda en localStorage y se envía en
     cada petición. El token NO contiene la contraseña.
     --------------------------------------------------------- */
  const sesion = {
    guardar(token, usuario) {
      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
    },
    token() {
      return localStorage.getItem('token');
    },
    usuario() {
      try {
        return JSON.parse(localStorage.getItem('usuario'));
      } catch {
        return null;
      }
    },
    cerrar() {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    },
    // ¿El usuario actual tiene alguno de estos roles?
    tieneRol(...roles) {
      const usuario = sesion.usuario();
      return Boolean(usuario && roles.includes(usuario.rol));
    },
    // CAJA y GERENCIA registran abonados y pagos (RN-05). OPERATIVO solo consulta.
    puedeEscribir() {
      return sesion.tieneRol('CAJA', 'GERENCIA');
    }
  };

  // Se llama al inicio de cada pantalla privada: sin sesión, va al login
  function exigirSesion() {
    if (!sesion.token() || !sesion.usuario()) {
      sesion.cerrar();
      location.replace(paginas.login);
      return false;
    }
    return true;
  }

  function salir() {
    sesion.cerrar();
    location.href = paginas.login;
  }

  /* ---------------------------------------------------------
     3. LLAMADAS A LA API
     --------------------------------------------------------- */

  // Error con el código HTTP y los mensajes por campo que envía la API
  class ErrorSigea extends Error {
    constructor(mensaje, status = 0, errores = {}) {
      super(mensaje);
      this.status = status;
      this.errores = errores;
    }
  }

  /**
   * Llama a la API y devuelve la respuesta ya convertida de JSON a objeto.
   * @param {string} ruta     Por ejemplo '/abonados?buscar=ana'
   * @param {object} opciones { metodo: 'POST', cuerpo: {...} }
   *
   * async/await: fetch tarda (va por la red). "await" espera la respuesta
   * sin congelar la página; por eso la función se declara "async".
   */
  async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
    const cabeceras = { 'Content-Type': 'application/json' };
    const token = sesion.token();
    if (token) cabeceras.Authorization = `Bearer ${token}`;

    let respuesta;
    try {
      respuesta = await fetch(SIGEA_CONFIG.API_URL + ruta, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
      });
    } catch {
      // fetch solo falla así cuando no hay red o el servidor está apagado
      throw new ErrorSigea('No se pudo conectar con el servidor. Verifique que el backend esté encendido.');
    }

    let datos = {};
    try { datos = await respuesta.json(); } catch { /* respuesta sin cuerpo */ }

    if (respuesta.ok) return datos;

    // 401 = sesión vencida o inválida: se vuelve al login (salvo que ya estemos iniciando sesión)
    if (respuesta.status === 401 && !ruta.startsWith('/auth/login')) {
      sesion.cerrar();
      location.replace(`${paginas.login}?expirada=1`);
    }

    throw new ErrorSigea(
      datos.mensaje || `Error del servidor (${respuesta.status}).`,
      respuesta.status,
      datos.errores || {}
    );
  }

  /* ---------------------------------------------------------
     4. BARRA SUPERIOR
     Cada página tiene la barra escrita en su HTML. Aquí solo se
     completan el nombre del usuario, su rol y el botón Salir,
     y se ocultan las opciones que su rol no puede usar.
     --------------------------------------------------------- */
  const NOMBRES_ROL = { CAJA: 'Caja', GERENCIA: 'Gerencia', OPERATIVO: 'Área operativa' };

  function prepararBarra() {
    const usuario = sesion.usuario();
    if (!usuario) return;

    const nombre = document.getElementById('usuarioNombre');
    const rol = document.getElementById('usuarioRol');
    if (nombre) nombre.textContent = usuario.nombre;
    if (rol) rol.textContent = NOMBRES_ROL[usuario.rol] || usuario.rol;

    document.getElementById('btnSalir')?.addEventListener('click', salir);

    // Todo elemento con data-solo-escritura se oculta para el rol OPERATIVO
    if (!sesion.puedeEscribir()) {
      document.querySelectorAll('[data-solo-escritura]').forEach(e => e.classList.add('d-none'));
    }
  }

  /* ---------------------------------------------------------
     5. FORMATO
     Las fechas llegan de la API como texto "AAAA-MM-DD". Se
     reordenan como texto (sin crear objetos Date) para que no
     cambien de día por la zona horaria.
     --------------------------------------------------------- */
  const formatoNumero = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function moneda(monto) {
    return `S/ ${formatoNumero.format(Number(monto) || 0)}`;
  }

  // "2026-11-09" -> "09/11/2026"
  function fecha(texto) {
    if (!texto) return '—';
    const [anio, mes, dia] = texto.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  }

  // "2026-11-09 18:30:00" -> "09/11/2026 18:30"
  function fechaHora(texto) {
    if (!texto) return '—';
    return `${fecha(texto)} ${texto.slice(11, 16)}`.trim();
  }

  /* ---------------------------------------------------------
     6. CREAR ELEMENTOS HTML
     Los datos que vienen de la base (nombres, direcciones...) se
     insertan SIEMPRE como texto (textContent), nunca como HTML
     (innerHTML). Así, si alguien registra un nombre con código
     malicioso, el navegador lo muestra como texto y no lo ejecuta.

     el('td', { className: 'fw-bold', text: 'Hola' })
     el('tr', {}, celda1, celda2)
     --------------------------------------------------------- */
  function el(etiqueta, propiedades = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(propiedades)) {
      if (valor === null || valor === undefined || valor === false) continue;
      if (clave === 'className') nodo.className = valor;
      else if (clave === 'text') nodo.textContent = valor;
      else if (clave === 'onClick') nodo.addEventListener('click', valor);
      else nodo.setAttribute(clave, valor);
    }
    hijos.flat().forEach(hijo => {
      if (hijo === null || hijo === undefined || hijo === false) return;
      nodo.append(hijo); // append acepta nodos y también texto plano
    });
    return nodo;
  }

  function icono(nombre, clasesExtra = '') {
    return el('i', { className: `bi bi-${nombre} ${clasesExtra}`.trim(), 'aria-hidden': 'true' });
  }

  // Muestra un mensaje dentro de un <div class="alert d-none">
  function mostrarAlerta(caja, mensaje, tipo = 'danger') {
    caja.className = `alert alert-${tipo}`;
    caja.textContent = mensaje;
  }

  function ocultarAlerta(caja) {
    caja.className = 'alert d-none';
    caja.textContent = '';
  }

  /* ---------------------------------------------------------
     7. ESTADOS DEL ABONADO (RN-01)
     El color nunca va solo: siempre lo acompañan un ícono y un
     texto, para que también lo entienda quien no distingue colores.
     --------------------------------------------------------- */
  const ESTADOS = {
    AL_DIA:     { texto: 'Al día',     clase: 'text-bg-success', icono: 'check-circle-fill' },
    POR_VENCER: { texto: 'Por vencer', clase: 'text-bg-warning', icono: 'exclamation-triangle-fill' },
    VENCIDO:    { texto: 'Vencido',    clase: 'text-bg-danger',  icono: 'x-circle-fill' }
  };

  function insigniaEstado(estado) {
    const info = ESTADOS[estado];
    if (!info) return el('span', { className: 'badge text-bg-secondary', text: 'Sin contrato' });
    return el('span', { className: `badge ${info.clase}` }, icono(info.icono, 'me-1'), info.texto);
  }

  // Frase que explica el estado: "Vence en 3 días", "Venció hace 2 días"...
  function detalleEstado(item) {
    if (item.contrato_finalizado) return 'Contrato finalizado';
    if (!item.pagado_hasta) return 'Sin pagos registrados';
    const dias = item.dias_para_vencer;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    if (dias > 1) return `Vence en ${dias} días`;
    if (dias === -1) return 'Venció ayer';
    return `Venció hace ${Math.abs(dias)} días`;
  }

  const TIPOS_VEHICULO = { CARRO: 'Carro', MOTO: 'Moto', CARRETA: 'Carreta' };
  const TIPOS_ESPACIO = { TECHADO: 'Techado', EXTERIOR: 'Exterior', ALMACEN: 'Almacén' };
  const MEDIOS_PAGO = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia' };

  return {
    paginas, sesion, exigirSesion, salir,
    api, ErrorSigea,
    prepararBarra,
    moneda, fecha, fechaHora,
    el, icono, mostrarAlerta, ocultarAlerta,
    insigniaEstado, detalleEstado,
    TIPOS_VEHICULO, TIPOS_ESPACIO, MEDIOS_PAGO
  };
})();
