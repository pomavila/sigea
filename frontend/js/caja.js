/* =========================================================
   SIGEA · Pantalla Cuadre de caja del día
   Sprint 2 · HU-04 Pago digital · Tarea T19

   Pide a GET /api/caja/cuadre?fecha= el total cobrado en el día
   por medio de pago y el detalle de cada pago. Solo CAJA y
   GERENCIA pueden verla (la API responde 403 a otros roles).
   ========================================================= */

'use strict';

if (SIGEA.exigirSesion()) {
  SIGEA.prepararBarra();
  iniciar();
}

function iniciar() {
  const { el, icono, moneda, api, mostrarAlerta, ocultarAlerta } = SIGEA;
  const inputFecha = document.getElementById('fecha');
  const tabla = document.getElementById('tablaPagos');
  const alerta = document.getElementById('alerta');

  const ICONOS = { EFECTIVO: 'cash-coin', YAPE: 'phone', PLIN: 'phone-fill', TRANSFERENCIA: 'bank' };

  function tarjetaMedio({ medio, cantidad, total }) {
    return el('div', { className: 'col-6 col-md-3' },
      el('div', { className: 'card sigea-card h-100' },
        el('div', { className: 'card-body' },
          el('div', { className: 'text-muted small' }, icono(ICONOS[medio], 'me-1'), SIGEA.MEDIOS_PAGO[medio]),
          el('div', { className: 'fs-5 fw-bold', text: moneda(total) }),
          el('div', { className: 'small text-muted', text: cantidad === 1 ? '1 pago' : `${cantidad} pagos` }))));
  }

  function filaPago(p) {
    const anulado = p.estado === 'ANULADO';
    return el('tr', { className: anulado ? 'sigea-anulado' : null },
      el('td', { className: 'text-nowrap', text: p.fecha_pago.slice(11, 16) }),
      el('td', {}, el('a', { href: SIGEA.paginas.pagos(p.id_abonado), text: p.abonado }),
        anulado ? el('span', { className: 'badge text-bg-secondary ms-2', text: 'Anulado' }) : null),
      el('td', { className: 'd-none d-md-table-cell text-nowrap', text: p.placa_codigo }),
      el('td', { text: SIGEA.MEDIOS_PAGO[p.medio_pago] || p.medio_pago }),
      el('td', { className: 'd-none d-md-table-cell', text: p.nro_operacion || '—' }),
      el('td', { className: 'text-end text-nowrap sigea-tachable', text: moneda(p.monto) }),
      el('td', { className: 'd-none d-lg-table-cell', text: p.registrado_por }));
  }

  async function cargar() {
    ocultarAlerta(alerta);
    try {
      const fecha = inputFecha.value ? `?fecha=${encodeURIComponent(inputFecha.value)}` : '';
      const d = await api(`/caja/cuadre${fecha}`);
      inputFecha.value = d.fecha;
      document.getElementById('total').textContent = moneda(d.total);
      document.getElementById('cantidad').textContent = d.cantidad === 1 ? '1 pago registrado' : `${d.cantidad} pagos registrados`;
      document.getElementById('totalPie').textContent = moneda(d.total);
      document.getElementById('porMedio').replaceChildren(...d.por_medio.map(tarjetaMedio));
      document.getElementById('anulados').textContent = d.anulados.cantidad
        ? `${d.anulados.cantidad} anulado(s): ${moneda(d.anulados.total)} (no suman)` : '';
      tabla.replaceChildren(...(d.pagos.length
        ? d.pagos.map(filaPago)
        : [el('tr', {}, el('td', { colspan: '7', className: 'text-center text-muted py-4', text: 'No hay pagos registrados en esta fecha.' }))]));
    } catch (error) {
      mostrarAlerta(alerta, error.message);
      tabla.replaceChildren(el('tr', {}, el('td', { colspan: '7', className: 'text-center text-danger py-4', text: error.message })));
    }
  }

  inputFecha.addEventListener('change', cargar);
  document.getElementById('btnImprimir').addEventListener('click', () => window.print());
  cargar();
}
