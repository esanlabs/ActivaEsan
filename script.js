const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdEBj55fO1ZvkxL2o-6Fyrry2w5fP7KeJ-dupAWd_MNpsr-ela-FiTEtgocGnVvREX/exec'; 

let currentUser = null; 
let registrosCargados = [];
let listaAdmins = [];
let calendar;
let idEventoEditando = null;

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return JSON.parse(jsonPayload);
}

window.handleCredentialResponse = async function(response) {
  const data = parseJwt(response.credential);
  const email = data.email.toLowerCase().trim();

  if (!email.endsWith('@esan.edu.pe')) {
    const err = document.getElementById('loginError');
    err.innerText = "Acceso denegado: Se requiere una cuenta con dominio @esan.edu.pe";
    err.classList.remove('hidden');
    return;
  }

  currentUser = {
    email: email,
    name: data.name
  };

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainHeader').classList.remove('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  document.getElementById('userNombre').innerText = currentUser.name;

  await cargarDatosDesdeGoogle();
};

function cerrarSesion() {
  location.reload();
}

function mostrarToast(mensaje, tipo = 'exito') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const bgColor = tipo === 'exito' ? 'bg-emerald-600' : 'bg-marca-rojo';
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-3 pointer-events-auto`;
  toast.innerHTML = `<span>${mensaje}</span><button onclick="this.parentElement.remove()" class="ml-auto font-bold">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

async function cargarDatosDesdeGoogle() {
  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    const resData = await respuesta.json();

    registrosCargados = resData.registros || [];
    listaAdmins = resData.admins || ['mtello@esan.edu.pe'];

    const esAdmin = listaAdmins.includes(currentUser.email);
    currentUser.role = esAdmin ? 'SUPERADMIN' : 'CLIENTE';

    configurarInterfazSegunRol();

    document.getElementById('loader').style.display = 'none';
    document.getElementById('calendarContainer').classList.remove('hidden');
    inicializarCalendario();
  } catch (error) {
    mostrarToast("Error al cargar datos desde el servidor.", "error");
  }
}

function configurarInterfazSegunRol() {
  const badge = document.getElementById('badgeRol');
  if (currentUser.role === 'SUPERADMIN') {
    badge.innerText = 'Super Admin';
    badge.className = 'text-xs bg-red-100 text-marca-rojo px-2 py-0.5 rounded-full uppercase ml-2 font-bold';
    document.getElementById('btnGestionAdmins').classList.remove('hidden');
    document.getElementById('btnExcel').classList.remove('hidden');
  } else {
    badge.innerText = 'Cliente';
    badge.className = 'text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full uppercase ml-2 font-bold';
    document.getElementById('btnGestionAdmins').classList.add('hidden');
    document.getElementById('btnExcel').classList.add('hidden');
  }
}

function generarEventosProcesados() {
  const areaFiltro = document.getElementById('filtroArea')?.value || 'TODAS';
  const servicioFiltro = document.getElementById('filtroServicio')?.value || 'TODOS';
  const busquedaTexto = (document.getElementById('buscadorTexto')?.value || '').toLowerCase().trim();

  return registrosCargados
    .filter(r => r.fecha)
    .filter(r => {
      if (currentUser.role === 'CLIENTE') {
        const correoReg = (r.correoSolicitante || '').toLowerCase().trim();
        if (correoReg !== currentUser.email) return false;
      }

      if (areaFiltro !== 'TODAS' && r.area !== areaFiltro) return false;
      if (servicioFiltro !== 'TODOS' && r.tipoServicio !== servicioFiltro) return false;
      
      if (busquedaTexto) {
        const matchEvento = (r.tipoEvento || '').toLowerCase().includes(busquedaTexto);
        const matchSolicita = (r.solicita || '').toLowerCase().includes(busquedaTexto);
        if (!matchEvento && !matchSolicita) return false;
      }

      return true;
    })
    .map(r => {
      const fechaISO = String(r.fecha).split('T')[0];
      const esCancelado = r.estado === 'Cancelado';
      let color = '#000000'; 

      if (esCancelado) {
        color = '#000000'; 
      } else if (r.tipoServicio.includes('Foto Gif')) {
        color = '#E3173E'; 
      } else if (r.tipoServicio === 'Foto Booth') {
        color = '#2563EB'; 
      } else if (r.tipoServicio === '360°') {
        color = '#16A34A'; 
      }

      return {
        title: `${r.tipoEvento} [${r.tipoServicio}]`,
        start: fechaISO,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { ...r } 
      };
    });
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (calendar) calendar.destroy(); 

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
    events: generarEventosProcesados(),
    
    eventClick: (info) => {
      const p = info.event.extendedProps;
      
      const esDuenio = (p.correoSolicitante || '').toLowerCase().trim() === currentUser.email;
      if (currentUser.role !== 'SUPERADMIN' && !esDuenio) return;

      idEventoEditando = p.numEvento; 

      document.getElementById('modalTitulo').innerText = "Editar Activación";
      document.getElementById('btnGuardar').innerText = "Actualizar";
      document.getElementById('contenedorCantidad').classList.add('hidden');
      document.getElementById('btnCancelar').classList.remove('hidden');

      if (currentUser.role === 'SUPERADMIN') {
        document.getElementById('contenedorEdicion').classList.remove('hidden');
      } else {
        document.getElementById('contenedorEdicion').classList.add('hidden');
      }

      document.getElementById('area').value = p.area || "DPA";
      document.getElementById('solicita').value = p.solicita || currentUser.name;
      document.getElementById('costos').value = p.centroCostos || "";
      document.getElementById('observaciones').value = p.observaciones || "";

      document.getElementById('cantActivaciones').value = 1;
      renderizarBloques(true);
      
      document.getElementById('nombreEvento_0').value = p.tipoEvento || "";
      document.getElementById('servicio_0').value = p.tipoServicio || "";
      document.getElementById('fechaEvento_0').value = String(p.fecha).split('T')[0];

      if (currentUser.role === 'SUPERADMIN') {
        document.getElementById('tablet').value = p.tablet || "";
        document.getElementById('fotos').value = p.cantFotos || "";
        document.getElementById('link').value = p.link || ""; 
      }

      abrirModal();
    }
  });
  calendar.render();
}

window.aplicarFiltros = () => {
  if (calendar) {
    calendar.removeAllEvents();
    calendar.addEventSource(generarEventosProcesados());
  }
};

window.renderizarBloques = function(esEdicion = false) {
  const container = document.getElementById('contenedorBloques');
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  const hoyISO = new Date().toISOString().split('T')[0];
  container.innerHTML = '';

  for (let i = 0; i < cant; i++) {
    const minAttr = (esEdicion || currentUser.role === 'SUPERADMIN') ? '' : `min="${hoyISO}"`;

    container.innerHTML += `
      <div class="border border-gray-200 p-4 rounded-xl relative">
        <div class="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-marca-gris">ACTIVACIÓN ${i + 1}</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Nombre del Evento *</label>
            <input type="text" id="nombreEvento_${i}" required class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Activación *</label>
            <select id="servicio_${i}" required class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none">
              <option value="Foto Booth">Foto Booth</option>
              <option value="360°">360°</option>
              <option value="Foto Gif Impresión">Foto Gif Impresión</option>
              <option value="Foto Gif Virtual">Foto Gif Virtual</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Fecha *</label>
            <input type="date" id="fechaEvento_${i}" ${minAttr} required class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none">
          </div>
        </div>
      </div>
    `;
  }
};

window.abrirModalNuevo = function() {
  idEventoEditando = null; 
  document.getElementById('formActivacion').reset();
  document.getElementById('modalTitulo').innerText = "Registrar Nueva Solicitud";
  document.getElementById('btnGuardar').innerText = "Guardar Solicitud";
  
  document.getElementById('solicita').value = currentUser.name;

  document.getElementById('contenedorCantidad').classList.remove('hidden');
  document.getElementById('contenedorEdicion').classList.add('hidden');
  document.getElementById('btnCancelar').classList.add('hidden');
  
  document.getElementById('cantActivaciones').value = 1;
  renderizarBloques(false);
  abrirModal();
};

window.abrirModal = function() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.remove('opacity-0'), 10);
};

window.cerrarModal = function() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('opacity-0');
  setTimeout(() => overlay.classList.add('hidden'), 300);
};

document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  let payloadItems = [];

  for (let i = 0; i < cant; i++) {
    payloadItems.push({
      numEvento: idEventoEditando, 
      tipoEvento: document.getElementById(`nombreEvento_${i}`).value,
      area: document.getElementById('area').value,
      solicita: currentUser.name,
      correoSolicitante: currentUser.email,
      centroCostos: document.getElementById('costos').value,
      tipoServicio: document.getElementById(`servicio_${i}`).value,
      estado: "Confirmado",
      tablet: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('tablet').value : "",
      fecha: document.getElementById(`fechaEvento_${i}`).value, 
      cantPersonas: 1, 
      cantFotos: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('fotos').value : "",
      costo: 899,
      link: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('link').value : "", 
      observaciones: document.getElementById('observaciones').value
    });
  }

  const btn = document.getElementById('btnGuardar');
  btn.innerText = `Procesando...`;
  btn.disabled = true;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: idEventoEditando ? 'update' : 'create_multiple', items: payloadItems })
    });

    mostrarToast("Procesado correctamente");
    await cargarDatosDesdeGoogle();
    cerrarModal();
  } catch (error) {
    mostrarToast("Error de conexión al guardar.", "error");
  } finally {
    btn.innerText = "Guardar";
    btn.disabled = false;
  }
});

window.abrirModalAdmins = function() {
  document.getElementById('modalAdminsOverlay').classList.remove('hidden');
  renderizarListaAdmins();
};

window.cerrarModalAdmins = function() {
  document.getElementById('modalAdminsOverlay').classList.add('hidden');
};

function renderizarListaAdmins() {
  const lista = document.getElementById('listaAdmins');
  lista.innerHTML = listaAdmins.map(adm => `
    <li class="py-2 flex justify-between items-center">
      <span>${adm}</span>
      ${adm !== 'mtello@esan.edu.pe' ? `<button onclick="eliminarAdmin('${adm}')" class="text-red-500 font-bold hover:underline">Eliminar</button>` : '<span class="text-gray-400 font-bold">Principal</span>'}
    </li>
  `).join('');
}

window.agregarAdmin = async function() {
  const input = document.getElementById('nuevoAdminEmail');
  const email = input.value.trim().toLowerCase();
  if (!email.endsWith('@esan.edu.pe')) return mostrarToast("Debe ser un correo @esan.edu.pe", "error");

  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'add_admin', email: email })
  });

  input.value = '';
  await cargarDatosDesdeGoogle();
  renderizarListaAdmins();
};

window.eliminarAdmin = async function(email) {
  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'remove_admin', email: email })
  });

  await cargarDatosDesdeGoogle();
  renderizarListaAdmins();
};
