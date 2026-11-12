/* =========================================================
   SIGEA · Validaciones de abonado, vehículo y contrato (RN-03)
   El navegador ya valida, pero la API SIEMPRE vuelve a validar:
   cualquiera puede llamar a la API sin pasar por el formulario
   (por ejemplo con Postman).

   Cada función devuelve los datos ya limpios (sin espacios de
   más, placa en mayúsculas...) o lanza un error 400 con el
   mensaje de cada campo.
   ========================================================= */

'use strict';

const { esFechaValida } = require('../utils/fechas');
const { lanzarSiHayErrores } = require('../utils/errores');

const REGEX_DNI = /^\d{8}$/;                 // exactamente 8 dígitos
const REGEX_CELULAR = /^9\d{8}$/;            // 9 dígitos y empieza en 9
const REGEX_NOMBRE = /^[\p{L}' -]+$/u;       // letras de cualquier idioma, espacio, apóstrofo y guion
const REGEX_PLACA = /^[A-Z0-9-]{3,15}$/;     // VARCHAR(15) en la base de datos

const TIPOS_VEHICULO = ['CARRO', 'MOTO', 'CARRETA'];
const TARIFA_MAXIMA = 999999.99;             // DECIMAL(8,2)

// Devuelve el texto sin espacios a los lados ('' si no es texto)
function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarDatosPersonales(datos, errores) {
  const limpio = {
    nombres: texto(datos.nombres),
    apellidos: texto(datos.apellidos),
    dni: texto(datos.dni),
    direccion: texto(datos.direccion),
    celular: texto(datos.celular) || null       // el celular es opcional
  };

  if (!limpio.nombres) errores.nombres = 'Los nombres son obligatorios.';
  else if (!REGEX_NOMBRE.test(limpio.nombres) || limpio.nombres.length > 100) {
    errores.nombres = 'Los nombres solo deben contener letras (máximo 100).';
  }

  if (!limpio.apellidos) errores.apellidos = 'Los apellidos son obligatorios.';
  else if (!REGEX_NOMBRE.test(limpio.apellidos) || limpio.apellidos.length > 100) {
    errores.apellidos = 'Los apellidos solo deben contener letras (máximo 100).';
  }

  if (!limpio.dni) errores.dni = 'El DNI es obligatorio.';
  else if (!REGEX_DNI.test(limpio.dni)) errores.dni = 'El DNI debe tener 8 dígitos.';

  if (!limpio.direccion) errores.direccion = 'La dirección es obligatoria.';
  else if (limpio.direccion.length > 150) errores.direccion = 'La dirección admite máximo 150 caracteres.';

  if (limpio.celular && !REGEX_CELULAR.test(limpio.celular)) {
    errores.celular = 'El celular debe tener 9 dígitos y empezar en 9.';
  }

  return limpio;
}

function validarVehiculo(datos, errores) {
  const limpio = {
    tipo: texto(datos.tipo).toUpperCase(),
    placa_codigo: texto(datos.placa_codigo).toUpperCase(),
    descripcion: texto(datos.descripcion) || null
  };

  if (!TIPOS_VEHICULO.includes(limpio.tipo)) {
    errores.tipo_vehiculo = 'Seleccione el tipo de vehículo (carro, moto o carreta).';
  }
  if (!limpio.placa_codigo) errores.placa_codigo = 'La placa o código es obligatorio.';
  else if (!REGEX_PLACA.test(limpio.placa_codigo)) {
    errores.placa_codigo = 'La placa o código solo admite letras, números y guion (3 a 15 caracteres).';
  }
  if (limpio.descripcion && limpio.descripcion.length > 100) {
    errores.descripcion = 'La descripción admite máximo 100 caracteres.';
  }

  return limpio;
}

function validarContrato(datos, errores) {
  const limpio = {
    id_espacio: Number(datos.id_espacio),
    tarifa_mensual: Number(datos.tarifa_mensual),
    fecha_inicio: texto(datos.fecha_inicio),
    fecha_fin: texto(datos.fecha_fin)
  };

  if (!Number.isInteger(limpio.id_espacio) || limpio.id_espacio < 1) {
    errores.id_espacio = 'Seleccione un espacio.';
  }

  if (datos.tarifa_mensual === '' || datos.tarifa_mensual === null ||
      datos.tarifa_mensual === undefined || Number.isNaN(limpio.tarifa_mensual)) {
    errores.tarifa_mensual = 'La tarifa mensual es obligatoria.';
  } else if (limpio.tarifa_mensual <= 0) {
    errores.tarifa_mensual = 'La tarifa debe ser mayor a 0.';
  } else if (limpio.tarifa_mensual > TARIFA_MAXIMA) {
    errores.tarifa_mensual = 'La tarifa es demasiado alta.';
  } else {
    limpio.tarifa_mensual = Math.round(limpio.tarifa_mensual * 100) / 100; // 2 decimales
  }

  if (!esFechaValida(limpio.fecha_inicio)) errores.fecha_inicio = 'La fecha de inicio no es válida.';
  if (!esFechaValida(limpio.fecha_fin)) errores.fecha_fin = 'La fecha de fin no es válida.';
  else if (!errores.fecha_inicio && limpio.fecha_fin <= limpio.fecha_inicio) {
    errores.fecha_fin = 'La fecha de fin debe ser posterior a la fecha de inicio.';
  }

  return limpio;
}

// POST /api/abonados  →  { abonado: {...}, vehiculo: {...}, contrato: {...} }
function validarRegistro(cuerpo) {
  const errores = {};
  const datos = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};

  // Se aceptan los datos personales dentro de "abonado" o directamente en la raíz
  const abonado = validarDatosPersonales(datos.abonado || datos, errores);
  const vehiculo = validarVehiculo(datos.vehiculo || {}, errores);
  const contrato = validarContrato(datos.contrato || {}, errores);

  lanzarSiHayErrores(errores);
  return { abonado, vehiculo, contrato };
}

// PUT /api/abonados/:id  →  solo datos personales
function validarEdicion(cuerpo) {
  const errores = {};
  const datos = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  const abonado = validarDatosPersonales(datos.abonado || datos, errores);
  lanzarSiHayErrores(errores);
  return abonado;
}

module.exports = { validarRegistro, validarEdicion };
