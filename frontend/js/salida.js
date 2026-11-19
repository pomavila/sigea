/* =========================================================
   SIGEA · Pantalla Control de salida
   Sprint 2 · HU-03 Alerta de salida · Tarea T15

   1. Al presionar Enter (o Verificar) se envía la placa a
      POST /api/salida: la API revisa la deuda (RN-07) y deja
      la consulta registrada con fecha, hora y usuario.
   2. Se muestra el resultado:
        CON_DEUDA   alerta roja con el monto y botón Registrar pago
        AL_DIA      salida permitida en verde
        NO_ABONADO  cliente por hora (cobro normal del parquímetro)
   3. Se recarga el historial de alertas del día.
   ========================================================= */

'use strict';

if (SIGEA.exigirSesion()) {
  SIGEA.prepararBarra();
  iniciar();
}

function iniciar() {
  const { el, icono, moneda, fecha, api, mostrarAlerta, ocultarAlerta } = SIGEA;

  const form = document.getElementById('formSalida');
  const inputPlaca = document.getElementById('placa');
  const errorPlaca = document.getElementById('error-placa');
  const btn = document.getElementById('btnVerificar');
  const spinner = document.getElementById('spinnerSalida');
  const caja = document.getElementById('resultado');
  const alerta = document.getElementById('alerta');
  const inputFecha = document.getElementById('fecha');
  const tabla = document.getElementById('tablaAlertas');

  const RESULTADOS = {
    CON_DEUDA:  { texto: 'Con deuda',        clase: 'text-bg-danger',    icono: 'exclamation-octagon-fill' },
    AL_DIA:     { texto: 'Salida permitida', clase: 'text-bg-success',   icono: 'check-circle-fill' },
    NO_ABONADO: { texto: 'Cliente por hora', clase: 'text-bg-secondary', icono: 'clock-fill' }
  };

  function insigniaResultado(resultado) {
    const info = RESULTADOS[resultado];
    return el('span', { className: `badge ${info.clase}` }, icono(info.icono, 'me-1'), info.texto);
  }

  function dato(etiqueta, valor) {
    return el('div', { className: 'col-6' },
      el('div', { className: 'small opacity-75', text: etiqueta }),
      el('div', { className: 'fw-semibold', text: valor }));
  }

  /* ---------- 2. Resultado ---------- */
  function mostrarResultado(r) {
    caja.replaceChildren();
    caja.className = 'card sigea-card h-100 sigea-resultado';

    if (r.resultado === 'NO_ABONADO') {
      caja.classList.add('es-hora');
      caja.append(el('div', { className: 'card-body text-center py-5' },
        icono('clock-fill', 'fs-1 text-secondary'),
        el('h2', { className: 'h4 mt-2 mb-1', text: 'Cliente por hora' }),
        el('p', { className: 'mb-1 fs-5 fw-semibold sigea-placa-grande', text: r.placa }),
        el('p', { className: 'text-muted mb-0', text: 'La placa no tiene un contrato de abonado vigente. Cobrar según el parquímetro.' })
      ));
      return;
    }

    const nombre = `${r.abonado.nombres} ${r.abonado.apellidos}`;
    const vehiculo = `${SIGEA.TIPOS_VEHICULO[r.vehiculo.tipo] || r.vehiculo.tipo} · ${r.vehiculo.placa_codigo}`;
    const espacio = `${r.espacio.codigo} (${SIGEA.TIPOS_ESPACIO[r.espacio.tipo] || r.espacio.tipo})`;

    if (r.resultado === 'CON_DEUDA') {
      caja.classList.add('es-deuda');
      const pagar = SIGEA.sesion.puedeEscribir()
        ? el('a', { className: 'btn btn-light btn-lg fw-semibold text-danger', href: SIGEA.paginas.pagos(r.abonado.id_abonado) },
            icono('cash-coin', 'me-1'), 'Registrar pago')
        : null;
      caja.append(el('div', { className: 'card-body p-4' },
        el('div', { className: 'd-flex align-items-center gap-3 mb-3' },
          icono('exclamation-octagon-fill', 'display-5'),
          el('div', {},
            el('h2', { className: 'h3 mb-0 fw-bold', text: '¡ALERTA! Abonado con deuda' }),
            el('div', { text: 'Cobrar antes de permitir la salida.' }))),
        el('div', { className: 'sigea-monto-deuda mb-3' },
          el('div', { className: 'small opacity-75', text: 'Deuda pendiente' }),
          el('div', { className: 'display-6 fw-bold', text: moneda(r.saldo_pendiente) }),
          el('div', { text: `${r.meses_adeudados} mes(es) adeudado(s) · ${SIGEA.detalleEstado(r)}` })),
        el('div', { className: 'row g-3 mb-3' },
          dato('Abonado', nombre), dato('DNI', r.abonado.dni),
          dato('Vehículo', vehiculo), dato('Espacio', espacio),
          dato('Pagado hasta', fecha(r.pagado_hasta)), dato('Celular', r.abonado.celular || '—')),
        pagar
      ));
    } else {
      caja.classList.add('es-ok');
      caja.append(el('div', { className: 'card-body p-4' },
        el('div', { className: 'd-flex align-items-center gap-3 mb-3' },
          icono('check-circle-fill', 'display-5'),
          el('div', {},
            el('h2', { className: 'h3 mb-0 fw-bold', text: 'Salida permitida' }),
            el('div', { text: 'El abonado está al día.' }))),
        el('div', { className: 'row g-3 mb-2' },
          dato('Abonado', nombre), dato('DNI', r.abonado.dni),
          dato('Vehículo', vehiculo), dato('Espacio', espacio),
          dato('Pagado hasta', fecha(r.pagado_hasta)), dato('Estado', SIGEA.detalleEstado(r))),
        r.estado === 'POR_VENCER'
          ? el('div', { className: 'alert alert-warning mb-0 mt-2 py-2' }, icono('exclamation-triangle-fill', 'me-1'),
              'Su mensualidad está por vencer: recuérdele renovar.')
          : null
      ));
    }
  }

  /* ---------- 1. Verificar placa ---------- */
  function errorDePlaca(mensaje) {
    inputPlaca.classList.toggle('is-invalid', Boolean(mensaje));
    errorPlaca.textContent = mensaje || '';
  }

  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    ocultarAlerta(alerta);
    const placa = inputPlaca.value.trim().toUpperCase();
    if (!placa) {
      errorDePlaca('Ingrese la placa del vehículo.');
      inputPlaca.focus();
      return;
    }
    errorDePlaca('');
    btn.disabled = true;
    spinner.classList.remove('d-none');
    try {
      const r = await api('/salida', { metodo: 'POST', cuerpo: { placa } });
      mostrarResultado(r);
      inputPlaca.select();
      inputFecha.value = r.fecha_hora.slice(0, 10);
      await cargarHistorial();
    } catch (error) {
      if (error.errores?.placa) errorDePlaca(error.errores.placa);
      else mostrarAlerta(alerta, error.message);
    } finally {
      btn.disabled = false;
      spinner.classList.add('d-none');
    }
  });

  inputPlaca.addEventListener('input', () => errorDePlaca(''));

  /* ---------- 3. Historial del día ---------- */
  async function cargarHistorial() {
    try {
      const datos = await api(`/alertas?fecha=${encodeURIComponent(inputFecha.value)}`);
      document.getElementById('numTotal').textContent = datos.total;
      document.getElementById('numDeuda').textContent = datos.con_deuda;
      document.getElementById('numAlDia').textContent = datos.al_dia;
      document.getElementById('numHora').textContent = datos.no_abonado;

      if (datos.alertas.length === 0) {
        tabla.replaceChildren(el('tr', {}, el('td', {
          colspan: '6', className: 'text-center text-muted py-4', text: 'No hay consultas registradas en esta fecha.'
        })));
        return;
      }
      tabla.replaceChildren(...datos.alertas.map(a => el('tr', { className: a.resultado === 'CON_DEUDA' ? 'table-danger' : null },
        el('td', { className: 'text-nowrap', text: a.fecha_hora.slice(11, 16) }),
        el('td', { className: 'fw-semibold text-nowrap', text: a.placa }),
        el('td', {}, a.id_abonado
          ? el('a', { href: SIGEA.paginas.pagos(a.id_abonado), text: a.abonado })
          : el('span', { className: 'text-muted', text: '—' })),
        el('td', {}, insigniaResultado(a.resultado)),
        el('td', { className: 'text-end text-nowrap', text: a.saldo_detectado > 0 ? moneda(a.saldo_detectado) : '—' }),
        el('td', { className: 'd-none d-md-table-cell', text: a.registrado_por })
      )));
    } catch (error) {
      tabla.replaceChildren(el('tr', {}, el('td', { colspan: '6', className: 'text-center text-danger py-4', text: error.message })));
    }
  }

  inputFecha.addEventListener('change', cargarHistorial);

  // Al abrir la pantalla: historial de hoy (la API decide qué día es "hoy" en Huancayo)
  (async () => {
    try {
      const datos = await api('/alertas');
      inputFecha.value = datos.fecha;
    } catch { /* cargarHistorial mostrará el error */ }
    await cargarHistorial();
  })();
}
