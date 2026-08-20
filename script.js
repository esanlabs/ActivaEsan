const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzdEBj55fO1ZvkxL2o-6Fyrry2w5fP7KeJ-dupAWd_MNpsr-ela-FiTEtgocGnVvREX/exec"; // Asegúrate de tener tu URL desplegada

let currentUser = { email: "", name: "", role: "CLIENTE" };
let registrosCargados = [];
let listaAdmins = [];
let idEventoEditando = null;
let calendarObj = null;
let contadorFilas = 0;

// --- LOGIN DE GOOGLE ---
function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  if (!data.email.endsWith('@esan.edu.pe')) {
    mostrarErrorLogin('Acceso denegado: Solo cuentas @esan.edu.pe');
    return;
  }

  currentUser.email = data.email.toLowerCase();
  currentUser.name = data.name;
  
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainHeader').classList.remove('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  document.getElementById('userNombre').innerText = currentUser.name;
  document.getElementById('solicita').value = currentUser.name;

  cargarDatosDesdeGoogle();
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
}

function mostrarErrorLogin(msg) {
  const errBox = document.getElementById('loginError');
  errBox.innerText = msg;
  errBox.classList.remove('hidden');
}

function cerrarSesion() {
  location.reload();
}

// --- CARGA DE DATOS ---
async function cargarDatosDesdeGoogle() {
  document.getElementById('loader').classList.remove('hidden');
  document.getElementById('calendarContainer').classList.add('hidden');

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const json = await res.json();
    
    registrosCargados = json.registros || [];
    listaAdmins = json.admins || [];

    // Evaluar Rol
    if (listaAdmins.includes(currentUser.email)) {
      currentUser.role = "SUPERADMIN";
      document.getElementById('badgeRol').innerText = "SuperAdmin";
      document.getElementById('badgeRol').className = "text-xs px-2 py-0.5 rounded-full uppercase ml-2 bg-red-100 text-marca-rojo font-bold";
      document.getElementById('btnGestionAdmins').classList.remove('hidden');
      document.getElementById('btnExcel').classList.remove('hidden');
    } else {
      currentUser.role = "CLIENTE";
      document.getElementById('badgeRol').innerText = "Cliente";
      document.getElementById('badgeRol').className = "text-xs px-2 py-0.5 rounded-full uppercase ml-2 bg-gray-100 text-gray-700 font-bold";
    }

    inicializarCalendario();
  } catch (e) {
    mostrarToast("Error al cargar registros", "error");
  } finally {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('calendarContainer').classList.remove('hidden');
  }
}

// --- INICIALIZAR FULLCALENDAR ---
function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (calendarObj) calendarObj.destroy();

  calendarObj = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
    events: mapearEventos(),
    
    // CLIC EN EL DIA DEL CALENDARIO
    dateClick: function(info) {
      abrirModalNuevo(info.dateStr);
    },

    eventClick: function(info) {
      const ev = info.event.extendedProps;
      // Clientes solo ven/editan sus propios eventos
      if (currentUser.role !== 'SUPERADMIN' && ev.correoSolicitante !== currentUser.email) {
        mostrarToast("Solo puedes consultar tus propias activaciones.", "error");
        return;
      }
      abrirModalEdicion(ev);
    }
  });

  calendarObj.render();
}

function mapearEventos() {
  return registrosCargados
    .filter(r => {
      // Si es cliente, solo sus eventos
      if (currentUser.role !== 'SUPERADMIN') {
        return r.correoSolicitante === currentUser.email;
      }
      return true;
    })
    .map(r => {
      let color = '#2563EB'; // Foto Booth
      if (r.tipoServicio.includes('Foto Gif')) color = '#E3173E';
      if (r.tipoServicio === '360°') color = '#16A34A';
      if (r.estado === 'Cancelado') color = '#000000';

      return {
        id: r.numEvento,
        title: `${r.tipoEvento} (${r.area})`,
        start: r.fecha,
        backgroundColor: color,
        borderColor: color,
        extendedProps: r
      };
    });
}

// --- GESTIÓN DE FILAS DINÁMICAS ---
function agregarFilaActivacion(fechaPorDefecto = "", servicioDef = "", nombreDef = "") {
  const container = document.getElementById('contenedorBloques');
  const index = contadorFilas++;

  const div = document.createElement('div');
  div.className = "bg-white p-4 rounded-xl border border-gray-200 space-y-3 relative fila-activacion";
  div.id = `fila_${index}`;

  div.innerHTML = `
    <div class="flex justify-between items-center border-b pb-2">
      <span class="text-xs font-bold text-gray-500 uppercase">Activación #${container.children.length + 1}</span>
      ${container.children.length > 0 ? `<button type="button" onclick="eliminarFila(${index})" class="text-xs text-red-600 font-bold hover:underline">Quitar</button>` : ''}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Nombre del Evento *</label>
        <input type="text" id="nombreEvento_${index}" value="${nombreDef}" required class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Fecha *</label>
        <input type="date" id="fechaEvento_${index}" value="${fechaPorDefecto}" required class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Servicio *</label>
        <select id="servicio_${index}" onchange="toggleImpresora(${index})" required class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo">
          <option value="">-- Seleccionar --</option>
          <option value="Foto Booth" ${servicioDef === 'Foto Booth' ? 'selected' : ''}>Foto Booth</option>
          <option value="Foto Gif" ${servicioDef.includes('Foto Gif') ? 'selected' : ''}>Foto Gif</option>
          <option value="360°" ${servicioDef === '360°' ? 'selected' : ''}>360°</option>
        </select>

        <div id="divImpresora_${index}" class="mt-2 ${servicioDef.includes('Foto Gif') ? '' : 'hidden'}">
          <label class="inline-flex items-center gap-1.5 text-xs font-bold text-marca-rojo cursor-pointer">
            <input type="checkbox" id="checkImpresora_${index}" ${servicioDef === 'Foto Gif Impresión' ? 'checked' : ''} class="rounded text-marca-rojo focus:ring-marca-rojo">
            Con Impresora
          </label>
        </div>
      </div>
    </div>
  `;

  container.appendChild(div);
}

function toggleImpresora(index) {
  const servicio = document.getElementById(`servicio_${index}`).value;
  const div = document.getElementById(`divImpresora_${index}`);
  const check = document.getElementById(`checkImpresora_${index}`);

  if (servicio === 'Foto Gif') {
    div.classList.remove('hidden');
  } else {
    div.classList.add('hidden');
    check.checked = false;
  }
}

function eliminarFila(index) {
  const elem = document.getElementById(`fila_${index}`);
  if (elem) elem.remove();
}

// --- MODALES ---
function abrirModalNuevo(fechaInicial = "") {
  idEventoEditando = null;
  document.getElementById('formActivacion').reset();
  document.getElementById('modalTitulo').innerText = "Registrar Nueva Activación";
  document.getElementById('solicita').value = currentUser.name;
  document.getElementById('contenedorEdicion').classList.add('hidden');
  document.getElementById('btnCancelar').classList.add('hidden');
  document.getElementById('btnAgregarFila').classList.remove('hidden');

  document.getElementById('contenedorBloques').innerHTML = "";
  contadorFilas = 0;
  agregarFilaActivacion(fechaInicial);

  mostrarModal();
}

function abrirModalEdicion(ev) {
  idEventoEditando = ev.numEvento;
  document.getElementById('modalTitulo').innerText = `Editar Activación #${ev.numEvento}`;
  document.getElementById('solicita').value = ev.solicita;
  document.getElementById('area').value = ev.area;
  document.getElementById('costos').value = ev.centroCostos;
  document.getElementById('observaciones').value = ev.observaciones;

  // Renderizar única fila
  document.getElementById('contenedorBloques').innerHTML = "";
  contadorFilas = 0;
  agregarFilaActivacion(ev.fecha, ev.tipoServicio, ev.tipoEvento);
  document.getElementById('btnAgregarFila').classList.add('hidden');

  if (currentUser.role === 'SUPERADMIN') {
    document.getElementById('contenedorEdicion').classList.remove('hidden');
    document.getElementById('tablet').value = ev.tablet || "";
    document.getElementById('fotos').value = ev.cantFotos || "";
    document.getElementById('link').value = ev.link || "";
  }

  document.getElementById('btnCancelar').classList.remove('hidden');
  mostrarModal();
}

function mostrarModal() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    box.classList.remove('scale-95');
  }, 10);
}

function cerrarModal() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.add('opacity-0');
  box.classList.add('scale-95');
  setTimeout(() => overlay.classList.add('hidden'), 300);
}

// --- GUARDAR Y REGLA DE 3 DÍAS ---
document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();

  const filas = document.getElementById('contenedorBloques').children;
  if (filas.length === 0) {
    mostrarToast("Agrega al menos una activación.", "error");
    return;
  }

  let payloadItems = [];

  for (let i = 0; i < filas.length; i++) {
    const divId = filas[i].id;
    const index = divId.split('_')[1];

    const nombre = document.getElementById(`nombreEvento_${index}`).value;
    const fecha = document.getElementById(`fechaEvento_${index}`).value;
    const servicioBase = document.getElementById(`servicio_${index}`).value;
    const quiereImpresora = document.getElementById(`checkImpresora_${index}`).checked;

    let servicioFinal = servicioBase;
    if (servicioBase === 'Foto Gif') {
      servicioFinal = quiereImpresora ? 'Foto Gif Impresión' : 'Foto Gif Virtual';
    }

    // --- REGLA DE 3 DÍAS MARGEN EN FOTO GIF IMPRESIÓN ---
    if (currentUser.role !== 'SUPERADMIN' && servicioFinal === 'Foto Gif Impresión' && fecha) {
      const fechaElegida = new Date(fecha + 'T00:00:00').getTime();
      const unDiaMs = 24 * 60 * 60 * 1000;

      const conflicto = registrosCargados.find(r => {
        if (r.tipoServicio !== 'Foto Gif Impresión' || r.estado === 'Cancelado' || r.numEvento === idEventoEditando) {
          return false;
        }
        const fechaExistente = new Date(String(r.fecha).split('T')[0] + 'T00:00:00').getTime();
        const difDias = Math.abs((fechaElegida - fechaExistente) / unDiaMs);
        return difDias <= 1; // Bloquea día anterior, mismo día y día posterior
      });

      if (conflicto) {
        const fechaConflicto = String(conflicto.fecha).split('T')[0];
        alert(`❌ SOLICITUD RECHAZADA: No se puede agendar "${nombre}".\n\nMotivo: Ya existe un 'Foto Gif con Impresora' el ${fechaConflicto}.\nEl servicio requiere un margen de descanso de 3 días (día previo, día del evento y día posterior).`);
        return;
      }
    }

    payloadItems.push({
      numEvento: idEventoEditando,
      tipoEvento: nombre,
      area: document.getElementById('area').value,
      solicita: currentUser.name,
      correoSolicitante: currentUser.email,
      centroCostos: document.getElementById('costos').value,
      tipoServicio: servicioFinal,
      estado: "Confirmado",
      fecha: fecha,
      observaciones: document.getElementById('observaciones').value,
      tablet: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('tablet').value : "",
      cantFotos: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('fotos').value : "",
      link: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('link').value : ""
    });
  }

  const btn = document.getElementById('btnGuardar');
  btn.innerText = "Procesando...";
  btn.disabled = true;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: idEventoEditando ? 'update' : 'create_multiple', items: payloadItems })
    });

    mostrarToast("Guardado con éxito");
    await cargarDatosDesdeGoogle();
    cerrarModal();
  } catch (err) {
    mostrarToast("Error al guardar en el servidor", "error");
  } finally {
    btn.innerText = "Guardar";
    btn.disabled = false;
  }
});

// --- REPARACIÓN BOTÓN CANCELAR REGISTRO ---
async function cancelarRegistro() {
  if (!idEventoEditando) return;

  if (!confirm("¿Seguro que deseas cancelar/eliminar este evento?")) return;

  const btn = document.getElementById('btnCancelar');
  btn.innerText = "Cancelando...";
  btn.disabled = true;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', numEvento: idEventoEditando })
    });

    mostrarToast("Evento cancelado correctamente");
    await cargarDatosDesdeGoogle();
    cerrarModal();
  } catch (e) {
    mostrarToast("Error al cancelar el evento", "error");
  } finally {
    btn.innerText = "Cancelar Evento";
    btn.disabled = false;
  }
}

// --- FILTROS Y TOASTS ---
function aplicarFiltros() {
  if (!calendarObj) return;
  calendarObj.refetchEvents();
}

function mostrarToast(msg, tipo = "success") {
  const toast = document.createElement('div');
  toast.className = `p-3 rounded-lg text-white text-xs font-bold shadow-lg transition-all ${tipo === 'error' ? 'bg-red-600' : 'bg-black'}`;
  toast.innerText = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
