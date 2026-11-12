/* =========================================================
   SIGEA · Pruebas unitarias de las reglas de negocio
   Ejecutar:  npm test
   No necesitan base de datos: prueban funciones puras.
   ========================================================= */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const fechas = require('../src/utils/fechas');
const reglas = require('../src/services/reglas');

const HOY = '2026-11-11';
const contrato = { tarifa_mensual: '200.00', fecha_inicio: '2026-08-11', fecha_fin: '2027-08-11' };

describe('Utilidades de fechas', () => {
  test('valida formato y existencia de la fecha', () => {
    assert.equal(fechas.esFechaValida('2026-11-09'), true);
    assert.equal(fechas.esFechaValida('2026-02-30'), false); // febrero no tiene 30
    assert.equal(fechas.esFechaValida('09/11/2026'), false);
    assert.equal(fechas.esFechaValida(null), false);
  });

  test('suma días cruzando de mes y de año', () => {
    assert.equal(fechas.sumarDias('2026-11-30', 1), '2026-12-01');
    assert.equal(fechas.sumarDias('2026-01-01', -1), '2025-12-31');
  });

  test('suma meses como MySQL: si el día no existe usa el último del mes', () => {
    assert.equal(fechas.sumarMeses('2026-11-11', 1), '2026-12-11');
    assert.equal(fechas.sumarMeses('2026-01-31', 1), '2026-02-28');
    assert.equal(fechas.sumarMeses('2026-12-15', 2), '2027-02-15');
  });

  test('cuenta meses completos como TIMESTAMPDIFF(MONTH)', () => {
    assert.equal(fechas.mesesCompletosEntre('2026-09-28', '2026-11-11'), 1);
    assert.equal(fechas.mesesCompletosEntre('2026-11-11', '2026-11-11'), 0);
    assert.equal(fechas.mesesCompletosEntre('2026-08-11', '2026-11-11'), 3);
  });

  test('hoy() devuelve una fecha con formato AAAA-MM-DD', () => {
    assert.equal(fechas.esFechaValida(fechas.hoy()), true);
  });
});

describe('RN-01 · Estado del abonado', () => {
  test('AL_DIA si vence en más de 5 días', () => {
    assert.deepEqual(reglas.calcularEstado('2026-11-17', HOY), { estado: 'AL_DIA', dias_para_vencer: 6 });
  });

  test('POR_VENCER si vence en 0 a 5 días (incluye los dos límites)', () => {
    assert.equal(reglas.calcularEstado('2026-11-16', HOY).estado, 'POR_VENCER'); // 5 días
    assert.equal(reglas.calcularEstado('2026-11-14', HOY).estado, 'POR_VENCER'); // 3 días
    assert.equal(reglas.calcularEstado(HOY, HOY).estado, 'POR_VENCER');          // vence hoy
  });

  test('VENCIDO si la fecha ya pasó', () => {
    assert.deepEqual(reglas.calcularEstado('2026-11-09', HOY), { estado: 'VENCIDO', dias_para_vencer: -2 });
  });

  test('sin pagos, la cobertura es el día anterior al inicio del contrato', () => {
    assert.equal(reglas.calcularCobertura(contrato, null), '2026-08-10');
    assert.equal(reglas.calcularCobertura(contrato, '2026-12-10'), '2026-12-10');
  });
});

describe('RN-02 · Saldo pendiente', () => {
  test('sin deuda si la cobertura llega a hoy o más', () => {
    assert.deepEqual(reglas.calcularDeuda(contrato, '2026-12-10', HOY), { meses_adeudados: 0, saldo_pendiente: 0 });
    assert.deepEqual(reglas.calcularDeuda(contrato, HOY, HOY), { meses_adeudados: 0, saldo_pendiente: 0 });
  });

  test('debe 1 mes apenas empieza el primer día sin cubrir', () => {
    assert.deepEqual(reglas.calcularDeuda(contrato, '2026-11-10', HOY), { meses_adeudados: 1, saldo_pendiente: 200 });
  });

  test('debe 2 meses si pasó más de un mes sin pagar', () => {
    // Cubierto hasta el 27/09 → debe el mes del 28/09 y el del 28/10
    assert.deepEqual(reglas.calcularDeuda(contrato, '2026-09-27', HOY), { meses_adeudados: 2, saldo_pendiente: 400 });
  });

  test('no cobra meses posteriores al fin del contrato', () => {
    const terminado = { tarifa_mensual: '100.00', fecha_inicio: '2026-01-01', fecha_fin: '2026-06-30' };
    // Cubierto hasta el 31/05: solo debe junio, aunque hoy sea noviembre
    assert.deepEqual(reglas.calcularDeuda(terminado, '2026-05-31', HOY), { meses_adeudados: 1, saldo_pendiente: 100 });
    // Pagado completo: no debe nada
    assert.equal(reglas.calcularDeuda(terminado, '2026-06-30', HOY).saldo_pendiente, 0);
  });

  test('calcula con céntimos sin errores de redondeo', () => {
    const conDecimales = { ...contrato, tarifa_mensual: '33.33' };
    assert.equal(reglas.calcularDeuda(conDecimales, '2026-08-10', HOY).saldo_pendiente, 133.32); // 4 meses
    assert.equal(reglas.montoEsperado(conDecimales, 3), 99.99);
  });
});

describe('Periodo que cubre un pago', () => {
  test('el primer pago empieza en la fecha de inicio del contrato', () => {
    const cobertura = reglas.calcularCobertura(contrato, null);
    assert.deepEqual(reglas.calcularPeriodoPago(contrato, cobertura, 1),
      { periodo_desde: '2026-08-11', periodo_hasta: '2026-09-10' });
  });

  test('el siguiente pago continúa el día después del anterior', () => {
    assert.deepEqual(reglas.calcularPeriodoPago(contrato, '2026-09-10', 2),
      { periodo_desde: '2026-09-11', periodo_hasta: '2026-11-10' });
  });

  test('rechaza pagar un contrato que ya está pagado completo', () => {
    assert.throws(() => reglas.calcularPeriodoPago(contrato, '2027-08-11', 1), { status: 409 });
  });

  test('rechaza meses que superan el fin del contrato', () => {
    assert.throws(() => reglas.calcularPeriodoPago(contrato, '2027-06-10', 5), { status: 400 });
  });

  test('recorta el último mes al fin del contrato', () => {
    const corto = { ...contrato, fecha_fin: '2026-09-25' };
    assert.deepEqual(reglas.calcularPeriodoPago(corto, '2026-09-10', 1),
      { periodo_desde: '2026-09-11', periodo_hasta: '2026-09-25' });
  });
});

describe('Evaluación completa de un contrato', () => {
  test('contrato nuevo sin pagos: vencido y debe el primer mes', () => {
    const nuevo = { tarifa_mensual: '250.00', fecha_inicio: HOY, fecha_fin: '2027-11-11' };
    const r = reglas.evaluarContrato(nuevo, null, HOY);
    assert.equal(r.estado, 'VENCIDO');
    assert.equal(r.saldo_pendiente, 250);
    assert.equal(r.proximo_periodo_desde, HOY);
    assert.equal(r.pagado_hasta, null);
  });

  test('el peor estado manda cuando hay varios contratos', () => {
    assert.equal(reglas.peorEstado(['AL_DIA', 'VENCIDO']), 'VENCIDO');
    assert.equal(reglas.peorEstado(['AL_DIA', 'POR_VENCER']), 'POR_VENCER');
    assert.equal(reglas.peorEstado(['AL_DIA']), 'AL_DIA');
  });
});
