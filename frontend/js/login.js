/* =========================================================
   SIGEA · Inicio de sesión (T08 - HU-02)
   Envía usuario y contraseña a POST /api/auth/login.
   Si son correctos, guarda el token y entra al panel.
   ========================================================= */

'use strict';

const form = document.getElementById('formLogin');
const inputUsuario = document.getElementById('usuario');
const inputContrasena = document.getElementById('contrasena');
const alerta = document.getElementById('alerta');
const btnIngresar = document.getElementById('btnIngresar');
const btnVer = document.getElementById('btnVer');

// Si ya hay una sesión abierta, no tiene sentido mostrar el login
if (SIGEA.sesion.token() && SIGEA.sesion.usuario()) {
  location.replace(SIGEA.paginas.panel);
}

// Cuando la API responde 401, sigea.js redirige aquí con ?expirada=1
if (new URLSearchParams(location.search).has('expirada')) {
  SIGEA.mostrarAlerta(alerta, 'Su sesión expiró. Vuelva a iniciar sesión.', 'warning');
}

function setCargando(cargando) {
  btnIngresar.disabled = cargando;
  document.getElementById('spinner').classList.toggle('d-none', !cargando);
  document.getElementById('textoIngresar').textContent = cargando ? 'Ingresando...' : 'Ingresar';
}

// Botón del ojo: muestra u oculta la contraseña
btnVer.addEventListener('click', () => {
  const visible = inputContrasena.type === 'text';
  inputContrasena.type = visible ? 'password' : 'text';
  btnVer.setAttribute('aria-pressed', String(!visible));
  btnVer.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  btnVer.firstElementChild.className = visible ? 'bi bi-eye' : 'bi bi-eye-slash';
});

form.addEventListener('submit', async e => {
  e.preventDefault(); // evita que la página se recargue
  SIGEA.ocultarAlerta(alerta);

  const usuario = inputUsuario.value.trim();
  const contrasena = inputContrasena.value;

  if (!usuario || !contrasena) {
    SIGEA.mostrarAlerta(alerta, 'Ingrese su usuario y su contraseña.');
    (usuario ? inputContrasena : inputUsuario).focus();
    return;
  }

  setCargando(true);
  try {
    const respuesta = await SIGEA.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { usuario, contrasena }
    });
    SIGEA.sesion.guardar(respuesta.token, respuesta.usuario);
    location.replace(SIGEA.paginas.panel);
  } catch (error) {
    // 401: usuario o contraseña incorrectos · 429: demasiados intentos
    SIGEA.mostrarAlerta(alerta, error.message);
    inputContrasena.value = '';
    inputContrasena.focus();
    setCargando(false);
  }
});

inputUsuario.focus();
