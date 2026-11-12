/* =========================================================
   SIGEA · Registro de abonado y contrato (T03 - HU-01)
   JavaScript puro (sin librerías, solo Bootstrap para el modal)

   Partes del archivo:
     1. Configuración
     2. Datos simulados (mientras no exista la API)
     3. Referencias a los elementos del HTML
     4. Utilidades de fechas
     5. Reglas de validación (RN-03 y reglas del contrato)
     6. Mostrar / limpiar errores
     7. Select de espacios libres (RN-04)
     8. Armar los datos y enviarlos (simulado o con fetch)
     9. Confirmación y limpieza del formulario
    10. Eventos (lo que pasa cuando el usuario interactúa)
   ========================================================= */

'use strict'; // modo estricto: el navegador avisa de errores comunes

/* ---------------------------------------------------------
   1. CONFIGURACIÓN
   USAR_API = false -> trabaja con datos simulados.
   Cuando Fernando termine POST /api/abonados, se cambia a true.
   --------------------------------------------------------- */
const CONFIG = {
  USAR_API: false,
  API_URL: 'http://localhost:3000/api'
};

/* ---------------------------------------------------------
   2. DATOS SIMULADOS
   Arreglo de espacios del estacionamiento. Cada espacio tiene
   un tipo y un estado (LIBRE u OCUPADO).
   --------------------------------------------------------- */
const espaciosSimulados = [
  // Mismos datos y nombres de columna que database/seed.sql (tabla espacio)
  { id_espacio: 1,  codigo: 'T-01', tipo: 'TECHADO',  estado: 'OCUPADO' },
  { id_espacio: 2,  codigo: 'T-02', tipo: 'TECHADO',  estado: 'OCUPADO' },
  { id_espacio: 3,  codigo: 'T-03', tipo: 'TECHADO',  estado: 'LIBRE' },
  { id_espacio: 4,  codigo: 'T-04', tipo: 'TECHADO',  estado: 'LIBRE' },
  { id_espacio: 5,  codigo: 'E-01', tipo: 'EXTERIOR', estado: 'OCUPADO' },
  { id_espacio: 6,  codigo: 'E-02', tipo: 'EXTERIOR', estado: 'OCUPADO' },
  { id_espacio: 7,  codigo: 'E-03', tipo: 'EXTERIOR', estado: 'OCUPADO' },
  { id_espacio: 8,  codigo: 'E-04', tipo: 'EXTERIOR', estado: 'LIBRE' },
  { id_espacio: 9,  codigo: 'E-05', tipo: 'EXTERIOR', estado: 'LIBRE' },
  { id_espacio: 10, codigo: 'A-01', tipo: 'ALMACEN',  estado: 'LIBRE' }
];

// Aquí se guardan los abonados registrados en modo simulado (solo en memoria)
const abonadosSimulados = [];

/* ---------------------------------------------------------
   3. REFERENCIAS AL HTML
   Se buscan una sola vez y se reutilizan (más eficiente).
   --------------------------------------------------------- */
const form = document.getElementById('formAbonado');
const selectTipoEspacio = document.getElementById('tipoEspacio');
const selectEspacio = document.getElementById('espacio');
const ayudaEspacio = document.getElementById('ayuda-espacio');
const inputFechaInicio = document.getElementById('fechaInicio');
const inputFechaFin = document.getElementById('fechaFin');
const btnGuardar = document.getElementById('btnGuardar');
const btnLimpiar = document.getElementById('btnLimpiar');
const alertaGeneral = document.getElementById('alertaGeneral');

// Lista de todos los campos que se validan (en el orden del formulario)
const CAMPOS = [
  'nombres', 'apellidos', 'dni', 'celular', 'direccion',
  'tipoVehiculo', 'placa',
  'tipoEspacio', 'espacio', 'tarifa', 'fechaInicio', 'fechaFin'
];

// Se vuelve true después del primer intento de guardar.
// Desde ese momento los errores se actualizan mientras el usuario escribe.
let intentoEnvio = false;

/* ---------------------------------------------------------
   4. UTILIDADES DE FECHAS
   Ojo: new Date().toISOString() usa hora UTC. En Perú (UTC-5),
   después de las 7 p. m. daría la fecha de MAÑANA. Por eso
   armamos la fecha con la hora local.
   --------------------------------------------------------- */
function fechaLocalISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // getMonth() va de 0 a 11
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`; // formato que usa <input type="date">
}

// Convierte "2026-11-09" en un objeto Date a medianoche local
function textoAFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

// Suma días a una fecha en texto y devuelve otra fecha en texto
function sumarDias(texto, dias) {
  const f = textoAFecha(texto);
  f.setDate(f.getDate() + dias);
  return fechaLocalISO(f);
}

/* ---------------------------------------------------------
   5. REGLAS DE VALIDACIÓN
   Cada regla recibe el valor del campo y devuelve:
     - ''        si es válido
     - 'mensaje' si hay error
   Tenerlas en un objeto permite validar un campo o todos
   con la misma función.
   --------------------------------------------------------- */
const REGEX_DNI = /^\d{8}$/;      // exactamente 8 dígitos
const REGEX_CELULAR = /^9\d{8}$/; // empieza en 9 + 8 dígitos = 9 en total
const REGEX_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/; // solo letras, espacios, apóstrofo y guion
const REGEX_PLACA = /^[A-Z0-9-]{3,15}$/; // VARCHAR(15) en la BD // letras, números y guion

const reglas = {
  // RN-03: nombres obligatorios
  nombres(valor) {
    if (!valor.trim()) return 'Los nombres son obligatorios.';
    if (!REGEX_NOMBRE.test(valor.trim())) return 'Los nombres solo deben contener letras.';
    return '';
  },

  apellidos(valor) {
    if (!valor.trim()) return 'Los apellidos son obligatorios.';
    if (!REGEX_NOMBRE.test(valor.trim())) return 'Los apellidos solo deben contener letras.';
    return '';
  },

  // RN-03: DNI de 8 dígitos
  dni(valor) {
    if (!valor) return 'El DNI es obligatorio.';
    if (!REGEX_DNI.test(valor)) return 'El DNI debe tener 8 dígitos.';
    return '';
  },

  // RN-03: celular de 9 dígitos que empiece en 9
  celular(valor) {
    if (!valor) return 'El celular es obligatorio.';
    if (!REGEX_CELULAR.test(valor)) return 'El celular debe tener 9 dígitos y empezar en 9.';
    return '';
  },

  // RN-03: dirección obligatoria
  direccion(valor) {
    if (!valor.trim()) return 'La dirección es obligatoria.';
    if (valor.trim().length < 5) return 'Ingrese una dirección más completa.';
    return '';
  },

  // RN-03: tipo de vehículo obligatorio
  tipoVehiculo(valor) {
    return valor ? '' : 'Seleccione el tipo de vehículo.';
  },

  placa(valor) {
    if (!valor.trim()) return 'La placa o código es obligatorio.';
    if (!REGEX_PLACA.test(valor.trim().toUpperCase())) {
      return 'Use solo letras, números y guion (3 a 15 caracteres).';
    }
    return '';
  },

  // RN-03: espacio obligatorio
  tipoEspacio(valor) {
    return valor ? '' : 'Seleccione el tipo de espacio.';
  },

  espacio(valor) {
    if (!valor) return 'Seleccione un espacio libre.';
    // RN-04: comprobar que el espacio siga libre (otra persona pudo ocuparlo)
    if (CONFIG.USAR_API) return ''; // con API, el backend valida RN-04 (responde 409)
    const esp = espaciosSimulados.find(e => e.id_espacio === Number(valor));
    if (!esp || esp.estado !== 'LIBRE') return 'Este espacio ya tiene un contrato vigente.';
    return '';
  },

  // La tarifa debe ser mayor a 0
  tarifa(valor) {
    if (valor === '') return 'La tarifa mensual es obligatoria.';
    const numero = Number(valor);
    if (Number.isNaN(numero)) return 'Ingrese un monto válido.';
    if (numero <= 0) return 'La tarifa debe ser mayor a 0.';
    return '';
  },

  fechaInicio(valor) {
    return valor ? '' : 'La fecha de inicio es obligatoria.';
  },

  // La fecha de fin debe ser POSTERIOR a la de inicio
  fechaFin(valor) {
    if (!valor) return 'La fecha de fin es obligatoria.';
    const inicio = inputFechaInicio.value;
    if (inicio && textoAFecha(valor) <= textoAFecha(inicio)) {
      return 'La fecha de fin debe ser posterior a la fecha de inicio.';
    }
    return '';
  }
};

/* ---------------------------------------------------------
   6. MOSTRAR / LIMPIAR ERRORES
   Bootstrap pinta en rojo el campo con la clase .is-invalid
   y muestra el <div class="invalid-feedback"> que está debajo.
   --------------------------------------------------------- */
function mostrarEstado(campo, mensaje) {
  const input = document.getElementById(campo);
  const cajaError = document.getElementById(`error-${campo}`);

  cajaError.textContent = mensaje;
  input.classList.toggle('is-invalid', mensaje !== ''); // rojo si hay mensaje
  input.classList.toggle('is-valid', mensaje === '');   // verde si está bien
  input.setAttribute('aria-invalid', mensaje !== '' ? 'true' : 'false'); // accesibilidad
}

// Valida UN campo y devuelve true si está correcto
function validarCampo(campo) {
  const valor = document.getElementById(campo).value;
  const mensaje = reglas[campo](valor);
  mostrarEstado(campo, mensaje);
  return mensaje === '';
}

// Valida TODOS los campos. Devuelve true solo si todos están bien.
function validarFormulario() {
  let todoValido = true;
  CAMPOS.forEach(campo => {
    // Se valida cada campo aunque uno anterior haya fallado,
    // así el usuario ve TODOS los errores de una vez.
    if (!validarCampo(campo)) todoValido = false;
  });
  return todoValido;
}

function limpiarEstados() {
  CAMPOS.forEach(campo => {
    const input = document.getElementById(campo);
    input.classList.remove('is-invalid', 'is-valid');
    input.removeAttribute('aria-invalid');
    document.getElementById(`error-${campo}`).textContent = '';
  });
}

function mostrarAlertaGeneral(mensaje) {
  alertaGeneral.textContent = mensaje;
  alertaGeneral.classList.remove('d-none');
  alertaGeneral.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ocultarAlertaGeneral() {
  alertaGeneral.classList.add('d-none');
  alertaGeneral.textContent = '';
}

/* ---------------------------------------------------------
   7. SELECT DE ESPACIOS LIBRES (RN-04)
   Solo se ofrecen espacios LIBRES del tipo elegido, así la
   caja no puede asignar un espacio que ya tiene contrato.
   --------------------------------------------------------- */

// Hoy filtra el arreglo simulado. Con API sería:
//   GET /api/espacios?tipo=TECHADO&estado=LIBRE
async function obtenerEspaciosLibres(tipo) {
  if (CONFIG.USAR_API) {
    const respuesta = await fetch(
      `${CONFIG.API_URL}/espacios?tipo=${encodeURIComponent(tipo)}&estado=LIBRE`,
      { headers: obtenerCabeceras() }
    );
    if (!respuesta.ok) throw new Error('No se pudieron cargar los espacios.');
    return respuesta.json();
  }
  return espaciosSimulados.filter(e => e.tipo === tipo && e.estado === 'LIBRE');
}

async function cargarEspacios(tipo) {
  // Se vacía el select antes de llenarlo de nuevo
  selectEspacio.innerHTML = '';
  ayudaEspacio.textContent = '';

  if (!tipo) {
    selectEspacio.add(new Option('Primero elija el tipo de espacio', ''));
    selectEspacio.disabled = true;
    return;
  }

  try {
    const libres = await obtenerEspaciosLibres(tipo);

    if (libres.length === 0) {
      selectEspacio.add(new Option('No hay espacios libres de este tipo', ''));
      selectEspacio.disabled = true;
      ayudaEspacio.textContent = 'Elija otro tipo de espacio.';
      return;
    }

    selectEspacio.add(new Option('Seleccione...', ''));
    // new Option(texto, valor) crea un <option> de forma segura
    libres.forEach(esp => selectEspacio.add(new Option(esp.codigo, esp.id_espacio)));
    selectEspacio.disabled = false;
    ayudaEspacio.textContent = `${libres.length} espacio(s) libre(s).`;
  } catch (error) {
    selectEspacio.add(new Option('Error al cargar espacios', ''));
    selectEspacio.disabled = true;
    mostrarAlertaGeneral(error.message);
  }
}

/* ---------------------------------------------------------
   8. ARMAR LOS DATOS Y ENVIARLOS
   --------------------------------------------------------- */

// Construye el objeto JSON que espera POST /api/abonados.
// Los nombres son IGUALES a las columnas de database/schema.sql (Fernando),
// así el backend puede insertarlos sin traducir nada.
function obtenerDatosFormulario() {
  const valor = id => document.getElementById(id).value.trim();
  return {
    abonado: {
      nombres: valor('nombres'),
      apellidos: valor('apellidos'),
      dni: valor('dni'),
      direccion: valor('direccion'),
      celular: valor('celular')
    },
    vehiculo: {
      tipo: valor('tipoVehiculo'),                 // CARRO | MOTO | CARRETA
      placa_codigo: valor('placa').toUpperCase(),
      descripcion: valor('descripcion') || null    // opcional
    },
    contrato: {
      id_espacio: Number(valor('espacio')),
      tarifa_mensual: Number(valor('tarifa')),
      fecha_inicio: valor('fechaInicio'),          // "YYYY-MM-DD"
      fecha_fin: valor('fechaFin')
    }
  };
}

// Cabeceras con el token JWT guardado al iniciar sesión (RN-06)
function obtenerCabeceras() {
  const cabeceras = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  return cabeceras;
}

/**
 * Envía el abonado a la API REST (lista para cuando Fernando la termine).
 * POST /api/abonados
 */
async function enviarAbonadoAPI(datos) {
  const respuesta = await fetch(`${CONFIG.API_URL}/abonados`, {
    method: 'POST',
    headers: obtenerCabeceras(),
    body: JSON.stringify(datos) // el objeto JS se convierte en texto JSON
  });

  // Se intenta leer la respuesta como JSON (puede venir vacía)
  let cuerpo = {};
  try { cuerpo = await respuesta.json(); } catch { /* sin cuerpo */ }

  if (respuesta.ok) return cuerpo; // 201 Created

  // Errores típicos de la API
  if (respuesta.status === 401) {
    throw new Error('Su sesión expiró. Vuelva a iniciar sesión.'); // RN-06: 8 horas
  }
  if (respuesta.status === 409) {
    throw new Error(cuerpo.mensaje || 'El DNI o el espacio ya están registrados.'); // RN-04
  }
  throw new Error(cuerpo.mensaje || `Error del servidor (${respuesta.status}).`);
}

// Simula lo que hará el backend: guardar y ocupar el espacio
function guardarSimulado(datos) {
  return new Promise((resolve, reject) => {
    setTimeout(() => { // espera 600 ms para parecer una petición real
      const espacio = espaciosSimulados.find(e => e.id_espacio === datos.contrato.id_espacio);

      // RN-04: un espacio solo puede tener un contrato vigente
      if (!espacio || espacio.estado !== 'LIBRE') {
        reject(new Error('El espacio seleccionado ya tiene un contrato vigente.'));
        return;
      }
      // Evitar abonados duplicados por DNI
      if (abonadosSimulados.some(a => a.abonado.dni === datos.abonado.dni)) {
        reject(new Error('Ya existe un abonado registrado con ese DNI.'));
        return;
      }

      espacio.estado = 'OCUPADO';
      const registro = { id: abonadosSimulados.length + 1, ...datos, espacioCodigo: espacio.codigo };
      abonadosSimulados.push(registro);
      console.log('Abonado guardado (simulado):', registro);
      resolve(registro);
    }, 600);
  });
}

// Decide si usa la API real o la simulación
function guardarAbonado(datos) {
  return CONFIG.USAR_API ? enviarAbonadoAPI(datos) : guardarSimulado(datos);
}

// Bloquea el botón mientras se guarda (evita doble clic = doble registro)
function setCargando(cargando) {
  btnGuardar.disabled = cargando;
  document.getElementById('spinnerGuardar').classList.toggle('d-none', !cargando);
  document.getElementById('iconoGuardar').classList.toggle('d-none', cargando);
  document.getElementById('textoGuardar').textContent = cargando ? 'Guardando...' : 'Guardar abonado';
}

/* ---------------------------------------------------------
   9. CONFIRMACIÓN Y LIMPIEZA
   --------------------------------------------------------- */
function mostrarConfirmacion(datos) {
  const espacioTexto = selectEspacio.options[selectEspacio.selectedIndex]?.text || '';
  const filas = [
    ['Abonado', `${datos.abonado.nombres} ${datos.abonado.apellidos}`],
    ['DNI', datos.abonado.dni],
    ['Vehículo', `${datos.vehiculo.tipo} · ${datos.vehiculo.placa_codigo}`],
    ['Espacio', `${espacioTexto} (${selectTipoEspacio.value})`],
    ['Tarifa', `S/ ${datos.contrato.tarifa_mensual.toFixed(2)}`],
    ['Vigencia', `${datos.contrato.fecha_inicio} al ${datos.contrato.fecha_fin}`]
  ];

  const lista = document.getElementById('resumenRegistro');
  lista.innerHTML = '';
  filas.forEach(([etiqueta, valor]) => {
    // Se usa textContent (no innerHTML) para que nadie pueda inyectar código HTML
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between gap-2 px-0';
    const strong = document.createElement('strong');
    strong.textContent = etiqueta;
    const span = document.createElement('span');
    span.className = 'text-end';
    span.textContent = valor;
    li.append(strong, span);
    lista.appendChild(li);
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmacion')).show();
}

function limpiarFormulario() {
  form.reset();                 // vacía todos los campos
  limpiarEstados();             // quita rojo/verde y mensajes
  ocultarAlertaGeneral();
  intentoEnvio = false;
  cargarEspacios('');           // el select de espacios vuelve a bloquearse
  ponerFechasPorDefecto();
  document.getElementById('nombres').focus();
}

// Fecha de inicio = hoy; la fecha de fin no puede ser antes del día siguiente
function ponerFechasPorDefecto() {
  inputFechaInicio.value = fechaLocalISO(new Date());
  inputFechaFin.min = sumarDias(inputFechaInicio.value, 1);
}

/* ---------------------------------------------------------
   10. EVENTOS
   --------------------------------------------------------- */

// DNI y celular: borrar todo lo que no sea número mientras se escribe
['dni', 'celular'].forEach(id => {
  document.getElementById(id).addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, ''); // \D = cualquier NO dígito
  });
});

// Placa en mayúsculas al escribir
document.getElementById('placa').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

// Al cambiar el tipo de espacio se recarga el select de espacios
selectTipoEspacio.addEventListener('change', async () => {
  await cargarEspacios(selectTipoEspacio.value);
  if (intentoEnvio) validarCampo('espacio');
});

// Al cambiar la fecha de inicio se actualiza el mínimo de la fecha de fin
inputFechaInicio.addEventListener('change', () => {
  if (inputFechaInicio.value) inputFechaFin.min = sumarDias(inputFechaInicio.value, 1);
  if (intentoEnvio || inputFechaFin.value) validarCampo('fechaFin');
});

// Validación en vivo:
//  - 'blur' (al salir del campo): valida si el usuario ya escribió algo
//  - 'input'/'change': después del primer intento de guardar, corrige el error al instante
CAMPOS.forEach(campo => {
  const input = document.getElementById(campo);
  input.addEventListener('blur', () => {
    if (intentoEnvio || input.value !== '') validarCampo(campo);
  });
  const evento = input.tagName === 'SELECT' ? 'change' : 'input';
  input.addEventListener(evento, () => {
    if (intentoEnvio || input.classList.contains('is-invalid')) validarCampo(campo);
  });
});

// ENVÍO DEL FORMULARIO
form.addEventListener('submit', async e => {
  e.preventDefault(); // evita que la página se recargue
  intentoEnvio = true;
  ocultarAlertaGeneral();

  // 1) Validar en el navegador antes de enviar
  if (!validarFormulario()) {
    // Lleva al usuario al primer campo con error (útil en celular)
    const primerError = form.querySelector('.is-invalid');
    primerError?.focus();
    primerError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // 2) Guardar
  const datos = obtenerDatosFormulario();
  setCargando(true);
  try {
    await guardarAbonado(datos);
    mostrarConfirmacion(datos); // 3) Mensaje de confirmación
    limpiarFormulario();        // 4) Formulario limpio
  } catch (error) {
    mostrarAlertaGeneral(error.message);
  } finally {
    setCargando(false); // se ejecuta siempre, haya error o no
  }
});

// Botón Limpiar
btnLimpiar.addEventListener('click', limpiarFormulario);

// Al cargar la página
ponerFechasPorDefecto();