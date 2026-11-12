/* =========================================================
   SIGEA · Panel principal
   Muestra de un vistazo lo que pide la meta del Sprint 1:
   quién está al día, quién debe y cuánto.
     GET /api/resumen               -> los cuatro indicadores
     GET /api/abonados?estado=...   -> la lista de quienes deben
   ========================================================= */

'use strict';

const { el } = SIGEA;
const alerta = document.getElementById('alerta');
const tablaDeudores = document.getElementById('tablaDeudores');

function ponerTexto(id, texto) {
  document.getElementById(id).textContent = texto;
}

function mostrarResumen(resumen) {
  ponerTexto('numAlDia', resumen.al_dia);
  ponerTexto('numPorVencer', resumen.por_vencer);
  ponerTexto('numVencidos', resumen.vencidos);
  ponerTexto('saldoTotal', SIGEA.moneda(resumen.saldo_total));

  const { total, libres, ocupados } = resumen.espacios;
  const porcentaje = total ? Math.round((ocupados / total) * 100) : 0;
  ponerTexto('espOcupados', `${ocupados} de ${total} (${porcentaje} %)`);
  ponerTexto('espLibres', libres);
  ponerTexto('espTotal', total);

  const barra = document.getElementById('barraOcupacion');
  barra.setAttribute('aria-valuenow', String(porcentaje));
  barra.firstElementChild.style.width = `${porcentaje}%`;
}

function filaVacia(texto) {
  return el('tr', {}, el('td', { colspan: '5', className: 'text-center text-muted py-4', text: texto }));
}

function filaDeudor(item) {
  return el('tr', {},
    el('td', {},
      el('div', { className: 'fw-semibold', text: `${item.apellidos}, ${item.nombres}` }),
      el('div', { className: 'small text-muted', text: `${item.vehiculo.placa_codigo} · ${SIGEA.detalleEstado(item)}` })
    ),
    el('td', { className: 'd-none d-sm-table-cell', text: item.espacio.codigo }),
    el('td', {}, SIGEA.insigniaEstado(item.estado)),
    el('td', { className: 'text-end fw-semibold text-nowrap', text: SIGEA.moneda(item.saldo_pendiente) }),
    el('td', { className: 'text-end' },
      el('a', {
        className: 'btn btn-sm btn-outline-sigea text-nowrap',
        href: SIGEA.paginas.pagos(item.id_abonado)
      }, SIGEA.sesion.puedeEscribir() ? 'Cobrar' : 'Ver')
    )
  );
}

function mostrarDeudores(lista) {
  // Solo quienes deben algo, primero el que más debe
  const deudores = lista
    .filter(item => item.saldo_pendiente > 0)
    .sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);

  tablaDeudores.replaceChildren(
    ...(deudores.length ? deudores.map(filaDeudor) : [filaVacia('Ningún abonado tiene deuda. ¡Todo al día!')])
  );
}

async function cargarPanel() {
  try {
    // Promise.all lanza las dos peticiones a la vez y espera a que terminen ambas
    const [resumen, vencidos] = await Promise.all([
      SIGEA.api('/resumen'),
      SIGEA.api('/abonados?estado=VENCIDO')
    ]);
    mostrarResumen(resumen);
    mostrarDeudores(vencidos);
  } catch (error) {
    SIGEA.mostrarAlerta(alerta, error.message);
    tablaDeudores.replaceChildren(filaVacia('No se pudo cargar la información.'));
  }
}

// Al cargar la página
if (SIGEA.exigirSesion()) {
  SIGEA.prepararBarra();
  ponerTexto('fechaHoy', new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }));
  cargarPanel();
}
