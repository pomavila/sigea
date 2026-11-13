/* =========================================================
   SIGEA · Pagos de un abonado (T10 y T11 - HU-02)

   Partes del archivo:
     1. Referencias y datos de la pantalla
     2. Utilidades de fechas (para la vista previa del periodo)
     3. Estado de cuenta (RN-01 y RN-02)
     4. Formulario de pago
     5. Historial de pagos
     6. Anular un pago (solo GERENCIA · RN-05)
     7. Cargar la pantalla

   API que usa:
     GET  /api/abonados/:id/pagos   -> abonado + contratos + historial
     POST /api/pagos                -> registrar un pago
     POST /api/pagos/:id/anular     -> anular un pago
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   1. REFERENCIAS Y DATOS
   --------------------------------------------------------- */
const { el } = SIGEA;

const alerta = document.getElementById('alerta');
const estadoCuenta = document.getElementById('estadoCuenta');
const tablaPagos = document.getElementById('tablaPagos');
const formPago = document.getElementById('formPago');
const selectContrato = document.getElementById('contrato');
const selectMeses = document.getElementById('meses');
const inputMonto = document.getElementById('monto');
const selectMedio = document.getElementById('medioPago');
const inputOperacion = document.getElementById('nroOperacion');
const cajaPeriodo = document.getElementById('periodo');
const sinPagoPosible = document.getElementById('sinPagoPosible');
const btnConfirmarPago = document.getElementById('btnConfirmarPago');
const formAnular = document.getElementById('formAnular');
const inputMotivo = document.getElementById('motivo');

const MAX_MESES = 12;        // el backend acepta de 1 a 12 meses por pago
const COLUMNAS_HISTORIAL = 7;

// El id del abonado llega en la dirección: pagos.html?id=3
const idAbonado = new URLSearchParams(location.search).get('id');

let abonado = null;          // datos que devolvió la API
let pagoParaAnular = null;   // pago elegido en el historial

/* ---------------------------------------------------------
   2. UTILIDADES DE FECHAS
   Sirven solo para MOSTRAR qué periodo cubrirá el pago antes de
   registrarlo. El periodo definitivo siempre lo calcula el
   backend (src/services/reglas.js) con estas mismas reglas.
   --------------------------------------------------------- */
function aFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aTexto(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(texto, dias) {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aTexto(fecha);
}

// Si el día no existe en el mes destino, usa el último (31 ene + 1 mes = 28 feb)
function sumarMeses(texto, meses) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0)).getUTCDate();
  primero.setUTCDate(Math.min(dia, ultimoDia));
  return aTexto(primero);
}

// Periodo que cubriría un pago de N meses de ese contrato
function calcularPeriodo(contrato, meses) {
  const desde = contrato.proximo_periodo_desde;
  let hasta = sumarDias(sumarMeses(desde, meses), -1);
  if (hasta > contrato.fecha_fin) hasta = contrato.fecha_fin; // el contrato termina antes
  return { desde, hasta };
}

// Cuántos meses se pueden pagar como máximo sin pasar el fin del contrato
function mesesPagables(contrato) {
  if (!contrato.proximo_periodo_desde) return 0;
  let meses = 0;
  while (meses < MAX_MESES && sumarMeses(contrato.proximo_periodo_desde, meses) <= contrato.fecha_fin) {
    meses++;
  }
  return meses;
}

/* ---------------------------------------------------------
   3. ESTADO DE CUENTA
   --------------------------------------------------------- */
function dato(etiqueta, valor) {
  return el('div', { className: 'col-6 col-md-4' },
    el('div', { className: 'small text-muted', text: etiqueta }),
    el('div', { className: 'fw-semibold', text: valor })
  );
}

function bloqueContrato(contrato, esUltimo) {
  const debe = contrato.saldo_pendiente > 0;
  const vehiculo = `${SIGEA.TIPOS_VEHICULO[contrato.vehiculo.tipo] || contrato.vehiculo.tipo} · ${contrato.vehiculo.placa_codigo}`;
  const espacio = `${contrato.espacio.codigo} (${SIGEA.TIPOS_ESPACIO[contrato.espacio.tipo] || contrato.espacio.tipo})`;

  return el('div', { className: esUltimo ? '' : 'border-bottom pb-3 mb-3' },
    // Estado y saldo, lo primero que debe ver la caja
    el('div', { className: 'd-flex flex-wrap justify-content-between align-items-start gap-3 mb-3' },
      el('div', {},
        el('div', { className: 'fs-5' }, SIGEA.insigniaEstado(contrato.estado)),
        el('div', { className: 'small text-muted mt-1', text: SIGEA.detalleEstado(contrato) })
      ),
      el('div', { className: 'text-end' },
        el('div', { className: 'small text-muted', text: 'Saldo pendiente' }),
        el('div', {
          className: `fs-3 fw-bold lh-1 ${debe ? 'text-danger' : 'text-success'}`,
          text: SIGEA.moneda(contrato.saldo_pendiente)
        }),
        debe && el('div', { className: 'small text-muted', text: `${contrato.meses_adeudados} mes(es) adeudado(s)` })
      )
    ),
    el('div', { className: 'row g-3' },
      dato('Vehículo', vehiculo),
      dato('Espacio', espacio),
      dato('Tarifa mensual', SIGEA.moneda(contrato.tarifa_mensual)),
      dato('Pagado hasta', contrato.pagado_hasta ? SIGEA.fecha(contrato.pagado_hasta) : 'Sin pagos'),
      dato('Inicio del contrato', SIGEA.fecha(contrato.fecha_inicio)),
      dato('Fin del contrato', SIGEA.fecha(contrato.fecha_fin))
    )
  );
}

function mostrarAbonado() {
  document.title = `SIGEA · ${abonado.apellidos}, ${abonado.nombres}`;
  document.getElementById('nombreAbonado').textContent = `${abonado.apellidos}, ${abonado.nombres}`;
  document.getElementById('datosAbonado').textContent =
    [`DNI ${abonado.dni}`, abonado.celular && `Cel. ${abonado.celular}`, abonado.direccion]
      .filter(Boolean).join(' · ');

  if (abonado.contratos.length === 0) {
    estadoCuenta.replaceChildren(
      el('p', { className: 'text-muted mb-0', text: 'Este abonado no tiene contratos vigentes.' })
    );
    return;
  }
  estadoCuenta.replaceChildren(
    ...abonado.contratos.map((contrato, i) => bloqueContrato(contrato, i === abonado.contratos.length - 1))
  );
}

/* ---------------------------------------------------------
   4. FORMULARIO DE PAGO
   --------------------------------------------------------- */
function contratoElegido() {
  return abonado.contratos.find(c => c.id_contrato === Number(selectContrato.value));
}

// Llena el select de contratos y decide si el formulario se puede usar
function prepararFormulario() {
  const pagables = abonado.contratos.filter(c => mesesPagables(c) > 0);

  if (pagables.length === 0) {
    formPago.classList.add('d-none');
    sinPagoPosible.classList.remove('d-none');
    sinPagoPosible.textContent = abonado.contratos.length
      ? 'El contrato ya está pagado hasta su fecha de fin. No hay nada por cobrar.'
      : 'No hay contratos vigentes para cobrar.';
    return;
  }

  formPago.classList.remove('d-none');
  sinPagoPosible.classList.add('d-none');

  selectContrato.replaceChildren(...pagables.map(c =>
    new Option(`${c.espacio.codigo} · ${c.vehiculo.placa_codigo}`, c.id_contrato)
  ));
  document.getElementById('grupoContrato').classList.toggle('d-none', pagables.length < 2);

  prepararMeses();
}

// Opciones de 1 a N meses. Por defecto, los meses que el abonado debe.
function prepararMeses() {
  const contrato = contratoElegido();
  const maximo = mesesPagables(contrato);

  selectMeses.replaceChildren(...Array.from({ length: maximo }, (_, i) =>
    new Option(i + 1 === 1 ? '1 mes' : `${i + 1} meses`, i + 1)
  ));
  selectMeses.value = String(Math.min(Math.max(contrato.meses_adeudados, 1), maximo));

  actualizarMonto();
}

// Monto = meses × tarifa. Se trabaja en céntimos para no arrastrar decimales.
function montoDelPago() {
  const contrato = contratoElegido();
  return (Math.round(contrato.tarifa_mensual * 100) * Number(selectMeses.value)) / 100;
}

function actualizarMonto() {
  const contrato = contratoElegido();
  const meses = Number(selectMeses.value);
  const periodo = calcularPeriodo(contrato, meses);

  inputMonto.value = montoDelPago().toFixed(2);
  document.getElementById('ayudaMonto').textContent =
    `${meses} × ${SIGEA.moneda(contrato.tarifa_mensual)} (tarifa mensual)`;
  cajaPeriodo.replaceChildren(
    SIGEA.icono('calendar-range', 'me-1'),
    'Cubre del ',
    el('strong', { text: SIGEA.fecha(periodo.desde) }),
    ' al ',
    el('strong', { text: SIGEA.fecha(periodo.hasta) })
  );
}

function limpiarErrorOperacion() {
  inputOperacion.classList.remove('is-invalid');
  document.getElementById('error-nroOperacion').textContent = '';
}

function actualizarMedio() {
  const esEfectivo = selectMedio.value === 'EFECTIVO';
  document.getElementById('grupoOperacion').classList.toggle('d-none', esEfectivo);
  if (esEfectivo) {
    inputOperacion.value = '';
    limpiarErrorOperacion();
  }
}

function filaResumen(etiqueta, valor) {
  return el('li', { className: 'list-group-item d-flex justify-content-between gap-3 px-0' },
    el('strong', { text: etiqueta }),
    el('span', { className: 'text-end', text: valor })
  );
}

// Paso 1: al pulsar "Registrar pago" se pide confirmación (es dinero: mejor revisar)
formPago.addEventListener('submit', e => {
  e.preventDefault();
  SIGEA.ocultarAlerta(alerta);
  limpiarErrorOperacion();

  const contrato = contratoElegido();
  const meses = Number(selectMeses.value);
  const periodo = calcularPeriodo(contrato, meses);
  const operacion = inputOperacion.value.trim();

  document.getElementById('resumenPago').replaceChildren(
    filaResumen('Abonado', `${abonado.nombres} ${abonado.apellidos}`),
    filaResumen('Espacio', `${contrato.espacio.codigo} · ${contrato.vehiculo.placa_codigo}`),
    filaResumen('Periodo', `${SIGEA.fecha(periodo.desde)} al ${SIGEA.fecha(periodo.hasta)}`),
    filaResumen('Medio de pago', SIGEA.MEDIOS_PAGO[selectMedio.value] + (operacion ? ` · Op. ${operacion}` : '')),
    filaResumen('Monto', SIGEA.moneda(montoDelPago()))
  );
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmar')).show();
});

// Paso 2: confirmado, se envía a la API
btnConfirmarPago.addEventListener('click', async () => {
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmar'));
  btnConfirmarPago.disabled = true; // evita doble clic = doble pago
  document.getElementById('spinnerPago').classList.remove('d-none');

  try {
    const respuesta = await SIGEA.api('/pagos', {
      metodo: 'POST',
      cuerpo: {
        id_contrato: Number(selectContrato.value),
        meses: Number(selectMeses.value),
        monto: montoDelPago(),
        medio_pago: selectMedio.value,
        nro_operacion: inputOperacion.value.trim() || null
      }
    });

    modal.hide();
    const pago = respuesta.pago;
    selectMedio.value = 'EFECTIVO';
    actualizarMedio();
    await cargarPantalla();
    SIGEA.mostrarAlerta(alerta,
      `Pago registrado: ${SIGEA.moneda(pago.monto)} por el periodo del ` +
      `${SIGEA.fecha(pago.periodo_desde)} al ${SIGEA.fecha(pago.periodo_hasta)}.`, 'success');
    alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    modal.hide();
    SIGEA.mostrarAlerta(alerta, error.message);
    if (error.errores?.nro_operacion) {
      inputOperacion.classList.add('is-invalid');
      document.getElementById('error-nroOperacion').textContent = error.errores.nro_operacion;
    }
    alerta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    btnConfirmarPago.disabled = false;
    document.getElementById('spinnerPago').classList.add('d-none');
  }
});

selectContrato.addEventListener('change', prepararMeses);
selectMeses.addEventListener('change', actualizarMonto);
selectMedio.addEventListener('change', actualizarMedio);
inputOperacion.addEventListener('input', limpiarErrorOperacion);

/* ---------------------------------------------------------
   5. HISTORIAL DE PAGOS
   La API ya lo entrega ordenado del más reciente al más antiguo.
   --------------------------------------------------------- */
function filaVaciaHistorial(texto) {
  return el('tr', {},
    el('td', { colspan: String(COLUMNAS_HISTORIAL), className: 'text-center text-muted py-4', text: texto })
  );
}

// Solo se puede anular el ÚLTIMO pago vigente de cada contrato
function idsAnulables(pagos) {
  const ultimoPorContrato = new Map();
  pagos.filter(p => p.estado === 'REGISTRADO').forEach(pago => {
    const actual = ultimoPorContrato.get(pago.id_contrato);
    if (!actual || pago.periodo_hasta > actual.periodo_hasta) ultimoPorContrato.set(pago.id_contrato, pago);
  });
  return new Set([...ultimoPorContrato.values()].map(p => p.id_pago));
}

function filaPago(pago, anulables) {
  const anulado = pago.estado === 'ANULADO';
  const medio = SIGEA.MEDIOS_PAGO[pago.medio_pago] || pago.medio_pago;
  const puedeAnular = !anulado && anulables.has(pago.id_pago) && SIGEA.sesion.tieneRol('GERENCIA');

  return el('tr', { className: anulado ? 'sigea-anulado' : '' },
    el('td', { className: 'text-nowrap', text: SIGEA.fechaHora(pago.fecha_pago) }),
    el('td', {},
      el('div', { className: 'sigea-tachable text-nowrap', text: `${SIGEA.fecha(pago.periodo_desde)} al ${SIGEA.fecha(pago.periodo_hasta)}` }),
      el('div', { className: 'small text-muted', text: `${pago.codigo_espacio} · ${pago.placa_codigo}` })
    ),
    el('td', { className: 'text-end fw-semibold text-nowrap sigea-tachable', text: SIGEA.moneda(pago.monto) }),
    el('td', { className: 'd-none d-md-table-cell' },
      el('div', { text: medio }),
      pago.nro_operacion && el('div', { className: 'small text-muted text-nowrap', text: `Op. ${pago.nro_operacion}` })
    ),
    el('td', { className: 'd-none d-lg-table-cell', text: pago.registrado_por }),
    el('td', {},
      anulado
        ? el('span', { className: 'badge text-bg-secondary' }, SIGEA.icono('slash-circle', 'me-1'), 'Anulado')
        : el('span', { className: 'badge text-bg-success' }, SIGEA.icono('check-circle-fill', 'me-1'), 'Registrado'),
      anulado && el('div', {
        className: 'small mt-1',
        text: `${pago.motivo_anulacion} — ${pago.anulado_por}, ${SIGEA.fechaHora(pago.fecha_anulacion)}`
      })
    ),
    el('td', { className: 'text-end' },
      puedeAnular && el('button', {
        type: 'button',
        className: 'btn btn-sm btn-outline-danger text-nowrap',
        onClick: () => abrirAnulacion(pago)
      }, SIGEA.icono('x-lg', 'me-1'), 'Anular')
    )
  );
}

function mostrarHistorial(pagos) {
  const vigentes = pagos.filter(p => p.estado === 'REGISTRADO').length;
  document.getElementById('totalPagos').textContent = vigentes === 1 ? '1 pago' : `${vigentes} pagos`;

  if (pagos.length === 0) {
    tablaPagos.replaceChildren(filaVaciaHistorial('Este abonado aún no tiene pagos registrados.'));
    return;
  }
  const anulables = idsAnulables(pagos);
  tablaPagos.replaceChildren(...pagos.map(pago => filaPago(pago, anulables)));
}

/* ---------------------------------------------------------
   6. ANULAR UN PAGO (RN-05)
   El botón solo aparece para GERENCIA, pero la regla de verdad
   está en el backend: si otro rol llama a la API recibe 403.
   --------------------------------------------------------- */
function abrirAnulacion(pago) {
  pagoParaAnular = pago;
  inputMotivo.value = '';
  inputMotivo.classList.remove('is-invalid');
  document.getElementById('textoAnular').textContent =
    `Se anulará el pago de ${SIGEA.moneda(pago.monto)} del periodo ` +
    `${SIGEA.fecha(pago.periodo_desde)} al ${SIGEA.fecha(pago.periodo_hasta)}. El abonado volverá a deber ese periodo.`;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAnular')).show();
}

// Al abrirse el modal, el cursor va directo al motivo
document.getElementById('modalAnular').addEventListener('shown.bs.modal', () => inputMotivo.focus());

formAnular.addEventListener('submit', async e => {
  e.preventDefault();
  const motivo = inputMotivo.value.trim();
  const errorMotivo = document.getElementById('error-motivo');

  if (motivo.length < 5) {
    inputMotivo.classList.add('is-invalid');
    errorMotivo.textContent = 'Indique el motivo de la anulación (mínimo 5 caracteres).';
    return;
  }

  const boton = document.getElementById('btnConfirmarAnular');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAnular'));
  boton.disabled = true;
  try {
    await SIGEA.api(`/pagos/${pagoParaAnular.id_pago}/anular`, { metodo: 'POST', cuerpo: { motivo } });
    modal.hide();
    await cargarPantalla();
    SIGEA.mostrarAlerta(alerta, 'El pago fue anulado. El saldo del abonado se actualizó.', 'warning');
  } catch (error) {
    if (error.errores?.motivo) {
      inputMotivo.classList.add('is-invalid');
      errorMotivo.textContent = error.errores.motivo;
    } else {
      modal.hide();
      SIGEA.mostrarAlerta(alerta, error.message);
    }
  } finally {
    boton.disabled = false;
  }
});

/* ---------------------------------------------------------
   7. CARGAR LA PANTALLA
   --------------------------------------------------------- */
async function cargarPantalla() {
  const respuesta = await SIGEA.api(`/abonados/${encodeURIComponent(idAbonado)}/pagos`);
  abonado = respuesta.abonado;
  mostrarAbonado();
  if (SIGEA.sesion.puedeEscribir()) prepararFormulario();
  mostrarHistorial(respuesta.pagos);
}

function mostrarErrorDeCarga(mensaje) {
  document.getElementById('nombreAbonado').textContent = 'Abonado no disponible';
  SIGEA.mostrarAlerta(alerta, mensaje);
  estadoCuenta.replaceChildren(el('p', { className: 'text-muted mb-0', text: 'Sin información.' }));
  formPago.classList.add('d-none');
  tablaPagos.replaceChildren(filaVaciaHistorial('Sin información.'));
}

// Al cargar la página
if (SIGEA.exigirSesion()) {
  SIGEA.prepararBarra();
  actualizarMedio();

  if (!/^\d+$/.test(idAbonado || '')) {
    mostrarErrorDeCarga('No se indicó qué abonado mostrar. Vuelva al listado y elija uno.');
  } else {
    cargarPantalla().catch(error => mostrarErrorDeCarga(error.message));
  }
}
