/* =========================================================
   SIGEA · Pruebas de integración de la API (T07 y T12)
   Ejecutar:  npm test

   Cubren los casos de prueba del Sprint 1 (CP-01 a CP-10).
   Usan una base de datos APARTE llamada "sigea_test", que se
   borra y se vuelve a crear en cada ejecución con schema.sql y
   seed.sql. La base de trabajo (sigea_db) no se toca.
   ========================================================= */

'use strict';

require('dotenv').config({ quiet: true });
process.env.DB_NAME = 'sigea_test';                 // debe ir ANTES de cargar la aplicación
process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave-solo-para-pruebas';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { recrearBase } = require('../scripts/base-datos');
const { app } = require('../app');
const { pool } = require('../src/config/db');
const usuarioModel = require('../src/models/usuario.model');
const { hoy, sumarDias } = require('../src/utils/fechas');

// Contraseñas de los usuarios de prueba (están documentadas en database/seed.sql)
const CLAVE_CAJA = 'Caja2026!';
const CLAVE_GERENCIA = 'Gerencia2026!';
const CLAVE_OPERATIVO = 'Operativo2026!';

let servidor;
let urlBase;
const tokens = {};

// Pequeño cliente HTTP para las pruebas
async function api(metodo, ruta, { token, cuerpo } = {}) {
  const respuesta = await fetch(urlBase + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  let datos = null;
  try { datos = await respuesta.json(); } catch { /* sin cuerpo */ }
  return { status: respuesta.status, datos };
}

async function iniciarSesion(usuario, contrasena) {
  const r = await api('POST', '/api/auth/login', { cuerpo: { usuario, contrasena } });
  assert.equal(r.status, 200, `No se pudo iniciar sesión con ${usuario}`);
  return r.datos.token;
}

// Datos válidos para registrar un abonado (cada prueba cambia lo que necesita)
function abonadoNuevo(cambios = {}) {
  const base = {
    abonado: {
      nombres: 'María José', apellidos: 'Ñahui Pérez', dni: '45678912',
      direccion: 'Jr. Cajamarca 344, Huancayo', celular: '912345678'
    },
    vehiculo: { tipo: 'CARRO', placa_codigo: 'w1x-234', descripcion: 'Nissan Sentra negro' },
    contrato: { id_espacio: 8, tarifa_mensual: 180, fecha_inicio: hoy(), fecha_fin: sumarDias(hoy(), 365) }
  };
  return {
    abonado: { ...base.abonado, ...cambios.abonado },
    vehiculo: { ...base.vehiculo, ...cambios.vehiculo },
    contrato: { ...base.contrato, ...cambios.contrato }
  };
}

before(async () => {
  await recrearBase('sigea_test');
  servidor = app.listen(0); // puerto 0 = el sistema elige uno libre
  await new Promise(resolve => servidor.once('listening', resolve));
  urlBase = `http://127.0.0.1:${servidor.address().port}`;

  // Usuario OPERATIVO (el seed solo trae CAJA y GERENCIA)
  await usuarioModel.crear({
    nombre: 'Personal de playa', usuario: 'operativo01',
    contrasenaHash: await bcrypt.hash(CLAVE_OPERATIVO, 4), rol: 'OPERATIVO'
  });

  tokens.caja = await iniciarSesion('caja01', CLAVE_CAJA);
  tokens.gerencia = await iniciarSesion('gerencia01', CLAVE_GERENCIA);
  tokens.operativo = await iniciarSesion('operativo01', CLAVE_OPERATIVO);
});

after(async () => {
  await new Promise(resolve => servidor.close(resolve));
  await pool.end();
});

describe('Salud e inicio de sesión (T08 · RN-06)', () => {
  test('GET /api/salud responde sin iniciar sesión', async () => {
    const r = await api('GET', '/api/salud');
    assert.equal(r.status, 200);
    assert.deepEqual(r.datos, { estado: 'ok' });
  });

  test('el login correcto devuelve token y rol, nunca la contraseña', async () => {
    const r = await api('POST', '/api/auth/login', { cuerpo: { usuario: 'caja01', contrasena: CLAVE_CAJA } });
    assert.equal(r.status, 200);
    assert.equal(r.datos.usuario.rol, 'CAJA');
    assert.equal(typeof r.datos.token, 'string');
    assert.equal(JSON.stringify(r.datos).includes('contrasena'), false);
  });

  test('el token dura 8 horas', () => {
    const datos = jwt.decode(tokens.caja);
    assert.equal(datos.exp - datos.iat, 8 * 60 * 60);
  });

  test('contraseña incorrecta y usuario inexistente dan el mismo 401', async () => {
    const mala = await api('POST', '/api/auth/login', { cuerpo: { usuario: 'caja01', contrasena: 'incorrecta' } });
    const nadie = await api('POST', '/api/auth/login', { cuerpo: { usuario: 'no.existe', contrasena: 'x' } });
    assert.equal(mala.status, 401);
    assert.equal(nadie.status, 401);
    assert.equal(mala.datos.mensaje, nadie.datos.mensaje);
  });

  test('sin token, con token alterado o firmado con otra clave: 401', async () => {
    assert.equal((await api('GET', '/api/abonados')).status, 401);
    assert.equal((await api('GET', '/api/abonados', { token: tokens.caja + 'x' })).status, 401);
    const falso = jwt.sign({ sub: 2, rol: 'GERENCIA' }, 'otra-clave', { expiresIn: '8h' });
    assert.equal((await api('GET', '/api/abonados', { token: falso })).status, 401);
  });

  test('un token vencido ya no sirve', async () => {
    const vencido = jwt.sign({ sub: 1, rol: 'CAJA' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const r = await api('GET', '/api/abonados', { token: vencido });
    assert.equal(r.status, 401);
  });

  test('GET /api/auth/perfil devuelve al usuario de la sesión', async () => {
    const r = await api('GET', '/api/auth/perfil', { token: tokens.gerencia });
    assert.equal(r.status, 200);
    assert.equal(r.datos.usuario, 'gerencia01');
    assert.equal(r.datos.rol, 'GERENCIA');
  });

  test('tras 5 intentos fallidos seguidos se bloquea el ingreso (429)', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await api('POST', '/api/auth/login', { cuerpo: { usuario: 'ataque', contrasena: 'x' + i } });
      assert.equal(r.status, 401);
    }
    const bloqueado = await api('POST', '/api/auth/login', { cuerpo: { usuario: 'ataque', contrasena: 'x' } });
    assert.equal(bloqueado.status, 429);
  });
});

describe('HU-01 · Registro de abonados', () => {
  test('CP-01 · registra un abonado con datos válidos', async () => {
    const r = await api('POST', '/api/abonados', { token: tokens.caja, cuerpo: abonadoNuevo() });
    assert.equal(r.status, 201);
    assert.equal(r.datos.dni, '45678912');
    assert.equal(r.datos.contratos.length, 1);
    assert.equal(r.datos.contratos[0].vehiculo.placa_codigo, 'W1X-234'); // se guarda en mayúsculas
    assert.equal(r.datos.contratos[0].espacio.codigo, 'E-04');

    // El espacio quedó OCUPADO: ya no aparece entre los libres
    const libres = await api('GET', '/api/espacios?tipo=EXTERIOR&estado=LIBRE', { token: tokens.caja });
    assert.deepEqual(libres.datos.map(e => e.codigo), ['E-05']);
  });

  test('CP-02 · rechaza un DNI de 7 dígitos', async () => {
    const r = await api('POST', '/api/abonados', {
      token: tokens.caja,
      cuerpo: abonadoNuevo({ abonado: { dni: '1234567' }, vehiculo: { placa_codigo: 'ZZZ-001' }, contrato: { id_espacio: 9 } })
    });
    assert.equal(r.status, 400);
    assert.equal(r.datos.errores.dni, 'El DNI debe tener 8 dígitos.');
  });

  test('RN-03 · informa todos los campos con error a la vez', async () => {
    const r = await api('POST', '/api/abonados', {
      token: tokens.caja,
      cuerpo: {
        abonado: { nombres: '', apellidos: 'Quispe', dni: 'abc', direccion: '', celular: '812345678' },
        vehiculo: { tipo: 'CAMION', placa_codigo: '' },
        contrato: { id_espacio: 9, tarifa_mensual: 0, fecha_inicio: '2026-11-10', fecha_fin: '2026-11-10' }
      }
    });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.datos.errores).sort(), [
      'celular', 'direccion', 'dni', 'fecha_fin', 'nombres', 'placa_codigo', 'tarifa_mensual', 'tipo_vehiculo'
    ]);
  });

  test('CP-03 · no permite asignar un espacio ocupado (RN-04)', async () => {
    const r = await api('POST', '/api/abonados', {
      token: tokens.caja,
      cuerpo: abonadoNuevo({ abonado: { dni: '11112222' }, vehiculo: { placa_codigo: 'ZZZ-002' }, contrato: { id_espacio: 1 } })
    });
    assert.equal(r.status, 409);
    assert.equal(r.datos.mensaje, 'El espacio ya está ocupado.');
  });

  test('rechaza un DNI que ya está registrado', async () => {
    const r = await api('POST', '/api/abonados', {
      token: tokens.caja,
      cuerpo: abonadoNuevo({ abonado: { dni: '70123456' }, vehiculo: { placa_codigo: 'ZZZ-003' }, contrato: { id_espacio: 9 } })
    });
    assert.equal(r.status, 409);
    assert.match(r.datos.mensaje, /DNI/);
  });

  test('transacción: si la placa está repetida no se guarda nada', async () => {
    const r = await api('POST', '/api/abonados', {
      token: tokens.caja,
      cuerpo: abonadoNuevo({ abonado: { dni: '33334444' }, vehiculo: { placa_codigo: 'V4K-812' }, contrato: { id_espacio: 9 } })
    });
    assert.equal(r.status, 409);
    assert.match(r.datos.mensaje, /placa/);

    // ROLLBACK: ni el abonado quedó guardado ni el espacio quedó ocupado
    const [abonados] = await pool.execute("SELECT COUNT(*) AS n FROM abonado WHERE dni = '33334444'");
    assert.equal(abonados[0].n, 0);
    const [espacios] = await pool.execute('SELECT estado FROM espacio WHERE id_espacio = 9');
    assert.equal(espacios[0].estado, 'LIBRE');
  });

  test('CP-04 · periodo pagado vencido hace 2 días → VENCIDO', async () => {
    // Se ajusta el pago de Carlos (contrato 3) para que su periodo haya vencido hace 2 días
    await pool.execute('UPDATE pago SET periodo_hasta = ? WHERE id_pago = 3', [sumarDias(hoy(), -2)]);
    const r = await api('GET', '/api/abonados/3/estado', { token: tokens.caja });
    assert.equal(r.status, 200);
    assert.equal(r.datos.estado, 'VENCIDO');
    assert.equal(r.datos.contratos[0].dias_para_vencer, -2);
  });

  test('CP-05 · periodo pagado que vence en 3 días → POR_VENCER', async () => {
    const r = await api('GET', '/api/abonados/2/estado', { token: tokens.caja });
    assert.equal(r.datos.estado, 'POR_VENCER');
    assert.equal(r.datos.contratos[0].dias_para_vencer, 3);
  });

  test('RN-01 · periodo pagado que vence en 20 días → AL_DIA', async () => {
    const r = await api('GET', '/api/abonados/1/estado', { token: tokens.caja });
    assert.equal(r.datos.estado, 'AL_DIA');
    assert.equal(r.datos.contratos[0].dias_para_vencer, 20);
  });

  test('CP-06 · busca por placa, DNI y apellido (sin importar tildes ni mayúsculas)', async () => {
    const porPlaca = await api('GET', '/api/abonados?buscar=v4k-812', { token: tokens.caja });
    assert.deepEqual(porPlaca.datos.map(a => a.apellidos), ['Quispe Mamani']);

    const porDni = await api('GET', '/api/abonados?buscar=70234567', { token: tokens.caja });
    assert.deepEqual(porDni.datos.map(a => a.nombres), ['Luis Alberto']);

    const porApellido = await api('GET', '/api/abonados?buscar=huaman', { token: tokens.caja });
    assert.deepEqual(porApellido.datos.map(a => a.apellidos), ['Huamán Rojas']);

    const sinResultados = await api('GET', '/api/abonados?buscar=%25', { token: tokens.caja }); // busca el texto "%"
    assert.deepEqual(sinResultados.datos, []);
  });

  test('el listado trae estado y saldo, y se puede filtrar por estado', async () => {
    const todos = await api('GET', '/api/abonados', { token: tokens.caja });
    assert.equal(todos.status, 200);
    assert.equal(todos.datos.length, 6); // 5 del seed + el de CP-01
    for (const item of todos.datos) {
      assert.ok(['AL_DIA', 'POR_VENCER', 'VENCIDO'].includes(item.estado));
      assert.equal(typeof item.saldo_pendiente, 'number');
    }
    const vencidos = await api('GET', '/api/abonados?estado=VENCIDO', { token: tokens.caja });
    assert.ok(vencidos.datos.length >= 1);
    assert.ok(vencidos.datos.every(item => item.estado === 'VENCIDO'));

    assert.equal((await api('GET', '/api/abonados?estado=OTRO', { token: tokens.caja })).status, 400);
  });

  test('edita los datos personales de un abonado', async () => {
    const r = await api('PUT', '/api/abonados/5', {
      token: tokens.caja,
      cuerpo: { nombres: 'Julio César', apellidos: 'Rivera Córdova', dni: '70567890',
                direccion: 'Av. Huancavelica 500, El Tambo', celular: '955111222' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.datos.celular, '955111222');
    assert.equal(r.datos.direccion, 'Av. Huancavelica 500, El Tambo');
  });

  test('abonado inexistente o id inválido', async () => {
    assert.equal((await api('GET', '/api/abonados/9999', { token: tokens.caja })).status, 404);
    assert.equal((await api('GET', '/api/abonados/abc', { token: tokens.caja })).status, 400);
  });

  test('el rol OPERATIVO puede consultar pero no registrar abonados', async () => {
    assert.equal((await api('GET', '/api/abonados', { token: tokens.operativo })).status, 200);
    const r = await api('POST', '/api/abonados', { token: tokens.operativo, cuerpo: abonadoNuevo() });
    assert.equal(r.status, 403);
  });
});

describe('HU-02 · Pagos y saldo', () => {
  test('RN-02 · saldo = meses adeudados × tarifa', async () => {
    // Marleny (abonado 4): contrato de S/ 250 iniciado hace 10 días y sin pagos → debe 1 mes
    const r = await api('GET', '/api/abonados/4/saldo', { token: tokens.caja });
    assert.equal(r.status, 200);
    assert.equal(r.datos.meses_adeudados, 1);
    assert.equal(r.datos.saldo_pendiente, 250);
    assert.equal(r.datos.estado, 'VENCIDO');
  });

  test('CP-08 · rechaza un monto de 0 o negativo', async () => {
    for (const monto of [0, -250]) {
      const r = await api('POST', '/api/pagos', {
        token: tokens.caja,
        cuerpo: { id_contrato: 4, meses: 1, monto, medio_pago: 'EFECTIVO' }
      });
      assert.equal(r.status, 400);
      assert.equal(r.datos.errores.monto, 'El monto debe ser mayor a 0.');
    }
    const [pagos] = await pool.execute('SELECT COUNT(*) AS n FROM pago WHERE id_contrato = 4');
    assert.equal(pagos[0].n, 0); // no se registró nada
  });

  test('rechaza un monto que no corresponde a los meses pagados', async () => {
    const r = await api('POST', '/api/pagos', {
      token: tokens.caja,
      cuerpo: { id_contrato: 4, meses: 1, monto: 100, medio_pago: 'EFECTIVO' }
    });
    assert.equal(r.status, 400);
    assert.match(r.datos.mensaje, /S\/ 250\.00/);
  });

  test('rechaza medio de pago desconocido y contrato inexistente', async () => {
    const medio = await api('POST', '/api/pagos', {
      token: tokens.caja, cuerpo: { id_contrato: 4, meses: 1, monto: 250, medio_pago: 'CHEQUE' }
    });
    assert.equal(medio.status, 400);
    const contrato = await api('POST', '/api/pagos', {
      token: tokens.caja, cuerpo: { id_contrato: 9999, meses: 1, monto: 250, medio_pago: 'EFECTIVO' }
    });
    assert.equal(contrato.status, 404);
  });

  test('RN-05 · el rol OPERATIVO no puede registrar pagos', async () => {
    const r = await api('POST', '/api/pagos', {
      token: tokens.operativo,
      cuerpo: { id_contrato: 4, meses: 1, monto: 250, medio_pago: 'EFECTIVO' }
    });
    assert.equal(r.status, 403);
  });

  let idPagoMarleny;

  test('CP-07 · al pagar el mes adeudado el saldo queda en 0 y el estado AL_DIA', async () => {
    const r = await api('POST', '/api/pagos', {
      token: tokens.caja,
      cuerpo: { id_contrato: 4, meses: 1, monto: 250, medio_pago: 'YAPE', nro_operacion: 'YP-778899' }
    });
    assert.equal(r.status, 201);
    idPagoMarleny = r.datos.pago.id_pago;

    // El periodo empieza en la fecha de inicio del contrato (hace 10 días)
    assert.equal(r.datos.pago.periodo_desde, sumarDias(hoy(), -10));
    assert.equal(r.datos.abonado.saldo_pendiente, 0);
    assert.equal(r.datos.abonado.estado, 'AL_DIA');

    const saldo = await api('GET', '/api/abonados/4/saldo', { token: tokens.caja });
    assert.equal(saldo.datos.saldo_pendiente, 0);
  });

  test('no acepta el mismo número de operación en otro pago', async () => {
    const r = await api('POST', '/api/pagos', {
      token: tokens.caja,
      cuerpo: { id_contrato: 5, meses: 1, monto: 200, medio_pago: 'YAPE', nro_operacion: 'YP-778899' }
    });
    assert.equal(r.status, 409);
  });

  test('CP-09 · un usuario CAJA no puede anular un pago (RN-05)', async () => {
    const r = await api('POST', `/api/pagos/${idPagoMarleny}/anular`, {
      token: tokens.caja, cuerpo: { motivo: 'Se registró por error' }
    });
    assert.equal(r.status, 403);
    assert.match(r.datos.mensaje, /Acceso denegado/);
  });

  test('RN-05 · GERENCIA anula el pago: queda el registro y vuelve la deuda', async () => {
    const sinMotivo = await api('POST', `/api/pagos/${idPagoMarleny}/anular`, { token: tokens.gerencia, cuerpo: {} });
    assert.equal(sinMotivo.status, 400);

    const r = await api('POST', `/api/pagos/${idPagoMarleny}/anular`, {
      token: tokens.gerencia, cuerpo: { motivo: 'Se registró al abonado equivocado' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.datos.abonado.saldo_pendiente, 250);
    assert.equal(r.datos.abonado.estado, 'VENCIDO');

    // El pago sigue en el historial, marcado como ANULADO y con quién lo anuló
    const historial = await api('GET', '/api/abonados/4/pagos', { token: tokens.gerencia });
    assert.equal(historial.datos.pagos.length, 1);
    assert.equal(historial.datos.pagos[0].estado, 'ANULADO');
    assert.equal(historial.datos.pagos[0].anulado_por, 'Gerente General');

    // No se puede anular dos veces
    const otraVez = await api('POST', `/api/pagos/${idPagoMarleny}/anular`, {
      token: tokens.gerencia, cuerpo: { motivo: 'Segundo intento' }
    });
    assert.equal(otraVez.status, 409);
  });

  test('CP-10 · el historial lista los 3 pagos del más reciente al más antiguo', async () => {
    // Julio (abonado 5, contrato 5 de S/ 200 que inicia hoy) paga tres veces
    for (const meses of [1, 1, 2]) {
      const r = await api('POST', '/api/pagos', {
        token: tokens.caja,
        cuerpo: { id_contrato: 5, meses, monto: 200 * meses, medio_pago: 'EFECTIVO' }
      });
      assert.equal(r.status, 201);
    }

    const r = await api('GET', '/api/abonados/5/pagos', { token: tokens.caja });
    assert.equal(r.status, 200);
    const pagos = r.datos.pagos;
    assert.equal(pagos.length, 3);
    assert.deepEqual(pagos.map(p => p.monto), [400, 200, 200]); // el último registrado va primero

    // Los periodos son continuos: cada uno empieza al día siguiente del anterior
    const [tercero, segundo, primero] = pagos;
    assert.equal(primero.periodo_desde, hoy());
    assert.equal(segundo.periodo_desde, sumarDias(primero.periodo_hasta, 1));
    assert.equal(tercero.periodo_desde, sumarDias(segundo.periodo_hasta, 1));
    assert.equal(pagos[0].registrado_por, 'Cajero de Turno');

    assert.equal(r.datos.abonado.estado, 'AL_DIA');
    assert.equal(r.datos.abonado.saldo_pendiente, 0);
  });

  test('solo se puede anular el último pago del contrato', async () => {
    const historial = await api('GET', '/api/abonados/5/pagos', { token: tokens.gerencia });
    const masAntiguo = historial.datos.pagos.at(-1);
    const r = await api('POST', `/api/pagos/${masAntiguo.id_pago}/anular`, {
      token: tokens.gerencia, cuerpo: { motivo: 'Intento de anular un pago intermedio' }
    });
    assert.equal(r.status, 409);
  });

  test('el resumen del panel cuadra con el listado', async () => {
    const [resumen, lista] = await Promise.all([
      api('GET', '/api/resumen', { token: tokens.gerencia }),
      api('GET', '/api/abonados', { token: tokens.gerencia })
    ]);
    assert.equal(resumen.status, 200);
    const d = resumen.datos;
    assert.equal(d.contratos_vigentes, lista.datos.length);
    assert.equal(d.al_dia + d.por_vencer + d.vencidos, d.contratos_vigentes);
    const suma = lista.datos.reduce((total, item) => total + item.saldo_pendiente, 0);
    assert.equal(d.saldo_total, Math.round(suma * 100) / 100);
    assert.equal(d.espacios.libres + d.espacios.ocupados, d.espacios.total);
  });
});

describe('Errores generales', () => {
  test('un JSON mal escrito responde 400, no 500', async () => {
    const respuesta = await fetch(urlBase + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"usuario": '
    });
    assert.equal(respuesta.status, 400);
  });

  test('una ruta que no existe responde 404 en JSON', async () => {
    const r = await api('GET', '/api/no-existe', { token: tokens.caja });
    assert.equal(r.status, 404);
    assert.equal(typeof r.datos.mensaje, 'string');
  });

  test('el servidor también entrega el frontend', async () => {
    const respuesta = await fetch(urlBase + '/');
    assert.equal(respuesta.status, 200);
    assert.match(await respuesta.text(), /SIGEA/);
  });
});
