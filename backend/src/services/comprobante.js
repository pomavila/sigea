/* =========================================================
   SIGEA · Comprobante digital (Sprint 2 · HU-05 · T21 y T22)

   - generarPdf: arma el comprobante del pago en PDF (pdfkit).
   - enlaceWhatsapp: arma el enlace wa.me con el mensaje para el
     abonado. WhatsApp no permite adjuntar archivos por enlace:
     el mensaje lleva los datos del comprobante y su número.

   RN-09: cada pago tiene un comprobante con número correlativo;
   si el pago se anula, el comprobante sale marcado como ANULADO.
   ========================================================= */

'use strict';

const PDFDocument = require('pdfkit');
const pagoModel = require('../models/pago.model');
const { ErrorApi } = require('../utils/errores');

const EMPRESA = {
  nombre: 'UNICENTRO CAJAMARCA S.A.C.',
  ruc: '20486675978',
  direccion: 'Jr. Cajamarca N.° 344, Huancayo – Junín'
};
const MEDIOS = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia' };
const VEHICULOS = { CARRO: 'Carro', MOTO: 'Moto', CARRETA: 'Carreta' };
const ESPACIOS = { TECHADO: 'Techado', EXTERIOR: 'Exterior', ALMACEN: 'Almacén' };
const AZUL = '#1F3864';

// "2026-11-21" -> "21/11/2026"
function fecha(texto) {
  const [a, m, d] = String(texto).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function fechaHora(texto) {
  return `${fecha(texto)} ${String(texto).slice(11, 16)}`;
}
function moneda(monto) {
  return `S/ ${Number(monto).toFixed(2)}`;
}

async function obtener(idPago) {
  const datos = await pagoModel.datosComprobante(idPago);
  if (!datos) throw new ErrorApi(404, 'El pago no existe.');
  return datos;
}

/* ---------------------------------------------------------
   T21 · Comprobante en PDF (tamaño A5)
   --------------------------------------------------------- */
function dibujarPdf(c) {
  const doc = new PDFDocument({
    size: 'A5', margin: 36,
    info: { Title: `Comprobante ${c.codigo}`, Author: EMPRESA.nombre, Creator: 'SIGEA' }
  });
  const ancho = doc.page.width - 72;

  // Encabezado
  doc.rect(0, 0, doc.page.width, 78).fill(AZUL);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13).text(EMPRESA.nombre, 36, 20);
  doc.font('Helvetica').fontSize(8.5)
     .text(`RUC ${EMPRESA.ruc} · ${EMPRESA.direccion}`, 36, 38)
     .text('Estacionamiento – servicio de abonados', 36, 50);

  // Título y número
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(14).text('COMPROBANTE DE PAGO', 36, 98);
  doc.fontSize(11).text(c.codigo, 36, 98, { width: ancho, align: 'right' });
  doc.fillColor('#555').font('Helvetica').fontSize(8.5)
     .text(`Emitido: ${fechaHora(c.fecha_emision)}`, 36, 116, { width: ancho, align: 'right' });

  // Datos del pago
  const filas = [
    ['Abonado', `${c.nombres} ${c.apellidos}`],
    ['DNI', c.dni],
    ['Vehículo', `${VEHICULOS[c.tipo_vehiculo] || c.tipo_vehiculo} · ${c.placa_codigo}`],
    ['Espacio', `${c.codigo_espacio} (${ESPACIOS[c.tipo_espacio] || c.tipo_espacio})`],
    ['Periodo pagado', `${fecha(c.periodo_desde)} al ${fecha(c.periodo_hasta)}`],
    ['Fecha de pago', fechaHora(c.fecha_pago)],
    ['Medio de pago', MEDIOS[c.medio_pago] + (c.nro_operacion ? ` · Op. ${c.nro_operacion}` : '')],
    ['Atendido por', c.registrado_por]
  ];
  let y = 142;
  filas.forEach(([etiqueta, valor], i) => {
    if (i % 2 === 0) doc.rect(36, y - 4, ancho, 20).fill('#EEF2F8');
    doc.fillColor('#555').font('Helvetica').fontSize(9).text(etiqueta, 44, y);
    doc.fillColor('#111').font('Helvetica-Bold').text(String(valor), 150, y, { width: ancho - 120 });
    y += 20;
  });

  // Monto
  y += 10;
  doc.rect(36, y, ancho, 40).fill(AZUL);
  doc.fillColor('#fff').font('Helvetica').fontSize(10).text('MONTO PAGADO', 48, y + 14);
  doc.font('Helvetica-Bold').fontSize(18).text(moneda(c.monto), 36, y + 10, { width: ancho - 12, align: 'right' });
  y += 58;

  // Pie
  doc.fillColor('#666').font('Helvetica').fontSize(7.5)
     .text('Comprobante interno de pago de la mensualidad de estacionamiento. No reemplaza al comprobante de pago electrónico de SUNAT.', 36, y, { width: ancho })
     .moveDown(0.4)
     .text('Generado por SIGEA – Sistema Integral de Gestión de Estacionamiento.', { width: ancho });

  // RN-09: pago anulado
  if (c.estado_comprobante === 'ANULADO') {
    doc.save().rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] })
       .fillColor('#C00000').opacity(0.25).font('Helvetica-Bold').fontSize(64)
       .text('ANULADO', 0, doc.page.height / 2 - 30, { width: doc.page.width, align: 'center' })
       .restore();
  }
  return doc;
}

async function generarPdf(idPago) {
  const c = await obtener(idPago);
  const doc = dibujarPdf(c);
  const partes = [];
  doc.on('data', parte => partes.push(parte));
  const fin = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
  doc.end();
  await fin;
  return { codigo: c.codigo, pdf: Buffer.concat(partes) };
}

/* ---------------------------------------------------------
   T22 · Enlace de WhatsApp con los datos del comprobante
   --------------------------------------------------------- */
function mensajeWhatsapp(c) {
  const lineas = [
    `Hola, ${c.nombres}. ${EMPRESA.nombre} le confirma su pago:`,
    `Comprobante: ${c.codigo}`,
    `Monto: ${moneda(c.monto)}`,
    `Periodo: ${fecha(c.periodo_desde)} al ${fecha(c.periodo_hasta)}`,
    `Medio de pago: ${MEDIOS[c.medio_pago]}${c.nro_operacion ? ` (Op. ${c.nro_operacion})` : ''}`,
    `Vehículo: ${c.placa_codigo} · Espacio ${c.codigo_espacio}`,
    `Fecha: ${fechaHora(c.fecha_pago)}`
  ];
  if (c.estado_comprobante === 'ANULADO') lineas.push('Este comprobante fue ANULADO.');
  else lineas.push('¡Gracias por su puntualidad!');
  return lineas.join('\n');
}

async function enlaceWhatsapp(idPago) {
  const c = await obtener(idPago);
  if (!c.celular) {
    throw new ErrorApi(409, 'El abonado no tiene celular registrado. Agréguelo en sus datos para enviar el comprobante.');
  }
  const mensaje = mensajeWhatsapp(c);
  return {
    comprobante: c.codigo,
    celular: c.celular,
    mensaje,
    url: `https://wa.me/51${c.celular}?text=${encodeURIComponent(mensaje)}` // 51 = código de Perú
  };
}

module.exports = { generarPdf, enlaceWhatsapp, mensajeWhatsapp };
