/* =========================================================
   SIGEA · Listado de abonados (T05 - HU-01)
   Busca por nombre, apellido, DNI o placa y muestra el estado
   de cada abonado con color (RN-01) y su saldo (RN-02).
     GET /api/abonados?buscar=texto&estado=VENCIDO
   ========================================================= */

'use strict';

const { el } = SIGEA;
const inputBuscar = document.getElementById('buscar');
const tabla = document.getElementById('tablaAbonados');
const contador = document.getElementById('contador');
const alerta = document.getElementById('alerta');

const COLUMNAS = 7;
const ESPERA_MS = 300; // tiempo que se espera a que el usuario deje de escribir

// Cada búsqueda recibe un número. Si llega una respuesta vieja (de una
// búsqueda anterior más lenta), se descarta y no pisa a la más reciente.
let numeroBusqueda = 0;

function estadoElegido() {
  return document.querySelector('input[name="estado"]:checked').value;
}

function filaMensaje(texto) {
  return el('tr', {}, el('td', { colspan: String(COLUMNAS), className: 'text-center text-muted py-4', text: texto }));
}

function filaAbonado(item) {
  const vehiculo = `${SIGEA.TIPOS_VEHICULO[item.vehiculo.tipo] || item.vehiculo.tipo} · ${item.vehiculo.placa_codigo}`;
  const debe = item.saldo_pendiente > 0;

  return el('tr', {},
    el('td', {},
      el('div', { className: 'fw-semibold', text: `${item.apellidos}, ${item.nombres}` }),
      el('div', { className: 'small text-muted', text: `DNI ${item.dni}` }),
      // En celular la columna Vehículo se oculta: la placa se muestra aquí
      el('div', { className: 'small text-muted d-md-none', text: vehiculo })
    ),
    el('td', { className: 'd-none d-md-table-cell' },
      el('div', { text: vehiculo }),
      item.vehiculo.descripcion && el('div', { className: 'small text-muted', text: item.vehiculo.descripcion })
    ),
    el('td', { className: 'd-none d-sm-table-cell' },
      el('div', { className: 'fw-semibold', text: item.espacio.codigo }),
      el('div', { className: 'small text-muted', text: SIGEA.TIPOS_ESPACIO[item.espacio.tipo] || item.espacio.tipo })
    ),
    el('td', { className: 'd-none d-lg-table-cell text-nowrap', text: SIGEA.fecha(item.pagado_hasta) }),
    el('td', {},
      SIGEA.insigniaEstado(item.estado),
      el('div', { className: 'small text-muted mt-1', text: SIGEA.detalleEstado(item) })
    ),
    el('td', { className: `text-end text-nowrap ${debe ? 'fw-bold text-danger' : 'text-muted'}` },
      SIGEA.moneda(item.saldo_pendiente),
      debe && el('div', { className: 'small fw-normal text-muted', text: `${item.meses_adeudados} mes(es)` })
    ),
    el('td', { className: 'text-end' },
      el('a', {
        className: `btn btn-sm text-nowrap ${debe && SIGEA.sesion.puedeEscribir() ? 'btn-sigea' : 'btn-outline-sigea'}`,
        href: SIGEA.paginas.pagos(item.id_abonado),
        'aria-label': `Pagos de ${item.nombres} ${item.apellidos}`
      },
        SIGEA.icono('cash-coin'),
        // En celular solo se ve el ícono (el texto aparece desde 576 px); aria-label lo describe siempre
        el('span', { className: 'd-none d-sm-inline ms-1', text: debe && SIGEA.sesion.puedeEscribir() ? 'Cobrar' : 'Pagos' })
      )
    )
  );
}

async function cargarAbonados() {
  const miNumero = ++numeroBusqueda;
  const parametros = new URLSearchParams();
  const texto = inputBuscar.value.trim();
  if (texto) parametros.set('buscar', texto);
  if (estadoElegido()) parametros.set('estado', estadoElegido());

  try {
    const lista = await SIGEA.api(`/abonados?${parametros}`);
    if (miNumero !== numeroBusqueda) return; // ya hay una búsqueda más nueva

    SIGEA.ocultarAlerta(alerta);
    if (lista.length === 0) {
      tabla.replaceChildren(filaMensaje(
        texto || estadoElegido() ? 'No se encontraron abonados con ese criterio.' : 'Aún no hay abonados registrados.'
      ));
    } else {
      tabla.replaceChildren(...lista.map(filaAbonado));
    }
    contador.textContent = lista.length === 1 ? '1 abonado' : `${lista.length} abonados`;
  } catch (error) {
    if (miNumero !== numeroBusqueda) return;
    SIGEA.mostrarAlerta(alerta, error.message);
    tabla.replaceChildren(filaMensaje('No se pudo cargar el listado.'));
    contador.textContent = '';
  }
}

// "Debounce": en vez de consultar la API en cada tecla, se espera a que el
// usuario deje de escribir 300 ms. Menos peticiones y la pantalla no parpadea.
let temporizador;
inputBuscar.addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargarAbonados, ESPERA_MS);
});

document.querySelectorAll('input[name="estado"]').forEach(radio => {
  radio.addEventListener('change', cargarAbonados);
});

// Al cargar la página
if (SIGEA.exigirSesion()) {
  SIGEA.prepararBarra();

  // El panel enlaza aquí con ?estado=VENCIDO para abrir el listado ya filtrado
  const estadoInicial = new URLSearchParams(location.search).get('estado');
  const radio = [...document.querySelectorAll('input[name="estado"]')].find(r => r.value === estadoInicial);
  if (radio) radio.checked = true;

  cargarAbonados();
}
