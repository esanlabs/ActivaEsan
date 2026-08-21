const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtCB66dij-pTgxM7D9fDuXZV4E1x2pSmbEZODgIjkwg5L64jiOLbbGbGT2737vUdjn/exec'; 

let currentUser = null; 
let registrosCargados = [];
let listaAdmins = [];
let calendarObj = null;
let idEventoEditando = null;
let contadorFilas = 0;

// --- LOGIN DE GOOGLE ---
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

  currentUser = { email: email, name: data.name };

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainHeader').classList.remove('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  document.getElementById('userNombre').innerText = currentUser.name;
  document.getElementById('solicita').value = currentUser.name;

  await cargarDatosDesdeGoogle();
};

function cerrarSesion() {
  location.reload();
}

// --- TOASTS ---
function mostrarToast(mensaje, tipo = 'exito') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const bgColor = tipo === 'exito' ? 'bg-emerald-600' : 'bg-marca-rojo';
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-3 pointer-events-auto transition-all z-50`;
  toast.innerHTML = `<span>${mensaje}</span><button onclick="this.parentElement.remove()" class="ml-auto font-bold">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- CARGA DE DATOS ---
async function cargarDatosDesdeGoogle() {
  document.getElementById('loader').classList.remove('hidden');

  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    const resData = await respuesta.json();

    if (resData.status === 'error') {
      throw new Error(`[Google Apps Script] ${resData.error || resData.errorDetallado}`);
    }

    registrosCargados = resData.registros || [];
    listaAdmins = resData.admins || ['mtello@esan.edu.pe'];

    const esAdmin = listaAdmins.includes(currentUser.email);
    currentUser.role = esAdmin ? 'SUPERADMIN' : 'CLIENTE';

    configurarInterfazSegunRol();

    document.getElementById('loader').classList.add('hidden');
    document.getElementById('calendarContainer').classList.remove('hidden');

    requestAnimationFrame(() => {
      inicializarCalendario();
    });
  } catch (error) {
    console.error("Error al cargar datos:", error);
    mostrarToast(`Error: ${error.message}`, "error");
    document.getElementById('loader').classList.add('hidden');
  }
}

function configurarInterfazSegunRol() {
  const badge = document.getElementById('badgeRol');
  const filtroArea = document.getElementById('filtroArea');
  const filtroServicio = document.getElementById('filtroServicio');

  if (currentUser.role === 'SUPERADMIN') {
    badge.innerText = 'Super Admin';
    badge.className = 'text-xs bg-red-100 text-marca-rojo px-2 py-0.5 rounded-full uppercase ml-2 font-bold';
    document.getElementById('btnGestionAdmins').classList.remove('hidden');
    document.getElementById('btnExcel').classList.remove('hidden');

    if (filtroArea) filtroArea.classList.remove('hidden');
    if (filtroServicio) filtroServicio.classList.remove('hidden');
  } else {
    badge.innerText = 'Cliente';
    badge.className = 'text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full uppercase ml-2 font-bold';
    document.getElementById('btnGestionAdmins').classList.add('hidden');
    document.getElementById('btnExcel').classList.add('hidden');

    if (filtroArea) filtroArea.classList.add('hidden');
    if (filtroServicio) filtroServicio.classList.add('hidden');
  }
}

// --- CALENDARIO Y FILTROS ---
function generarEventosProcesados() {
  const areaFiltro = document.getElementById('filtroArea')?.value || 'TODAS';
  const servicioFiltro = document.getElementById('filtroServicio')?.value || 'TODOS';
  const busquedaTexto = (document.getElementById('buscadorTexto')?.value || '').toLowerCase().trim();

  return registrosCargados
    .filter(r => r && r.fecha)
    .filter(r => {
      if (areaFiltro !== 'TODAS' && (r.area || '') !== areaFiltro) return false;
      if (servicioFiltro !== 'TODOS' && (r.tipoServicio || '') !== servicioFiltro) return false;
      
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
      const servicio = r.tipoServicio || '';
      
      const correoReg = (r.correoSolicitante || '').toLowerCase().trim();
      const esMiEvento = correoReg === currentUser.email;
      const esSuperUsuario = currentUser.role === 'SUPERADMIN';
      const tienePermiso = esSuperUsuario || esMiEvento;

      if (!tienePermiso) {
        return {
          id: r.numEvento,
          title: r.tipoEvento || 'Sin título',
          start: fechaISO,
          backgroundColor: '#000000',
          borderColor: '#000000',
          textColor: '#ffffff',
          extendedProps: { permitirClick: false }
        };
      }

      let color = '#000000'; 
      if (esCancelado) {
        color = '#000000'; 
      } else if (servicio.includes('Foto Gif')) {
        color = '#E3173E'; 
      } else if (servicio === 'Foto Booth') {
        color = '#2563EB'; 
      } else if (servicio === '360°') {
        color = '#16A34A'; 
      }

      return {
        id: r.numEvento,
        title: `${r.tipoEvento || 'Sin título'} [${servicio}]`,
        start: fechaISO,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { ...r, permitirClick: true } 
      };
    });
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (calendarObj) calendarObj.destroy(); 

  calendarObj = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    contentHeight: 'auto',
    handleWindowResize: true,
    headerToolbar: { 
      left: 'prev,next today', 
      center: 'title', 
      right: 'dayGridMonth,timeGridWeek,listWeek' 
    },
    events: generarEventosProcesados(),
    
    dateClick: function(info) {
      abrirModalNuevo(info.dateStr);
    },

    eventClick: (info) => {
      const p = info.event.extendedProps;
      
      if (!p.permitirClick) return; 
      
      const esDuenio = (p.correoSolicitante || '').toLowerCase().trim() === currentUser.email;
      
      if (currentUser.role !== 'SUPERADMIN' && !esDuenio) {
        mostrarToast("Solo puedes editar tus propias activaciones.", "error");
        return;
      }

      idEventoEditando = p.numEvento; 
      document.getElementById('modalTitulo').innerText = "Editar Activación";
      document.getElementById('btnGuardar').innerText = "Actualizar";
      document.getElementById('btnCancelar').classList.remove('hidden');

      if (currentUser.role === 'SUPERADMIN') {
        document.getElementById('contenedorEdicion').classList.remove('hidden');
      } else {
        document.getElementById('contenedorEdicion').classList.add('hidden');
      }

      document.getElementById('chkUnificarCostos').checked = true;
      toggleUnificarCostos();

      document.getElementById('area').value = p.area || "DPA";
      document.getElementById('solicita').value = p.solicita || currentUser.name;
      document.getElementById('costos').value = p.centroCostos || "";
      document.getElementById('observaciones').value = p.observaciones || "";

      document.getElementById('contenedorBloques').innerHTML = "";
      contadorFilas = 0;
      
      agregarFilaActivacion(String(p.fecha).split('T')[0], p.tipoServicio || "", p.tipoEvento || "", p.centroCostos || "", p.observaciones || "");

      if (currentUser.role === 'SUPERADMIN') {
        document.getElementById('tablet').value = p.tablet || "";
        document.getElementById('fotos').value = p.cantFotos || "";
        document.getElementById('link').value = p.link || ""; 
      }

      abrirModal();
    }
  });

  calendarObj.render();

  setTimeout(() => {
    calendarObj.updateSize();
  }, 100);
}

window.aplicarFiltros = () => {
  if (calendarObj) {
    calendarObj.removeAllEvents();
    calendarObj.addEventSource(generarEventosProcesados());
  }
};

function agregarFilaActivacion(fechaPorDefecto = "", servicioDef = "", nombreDef = "", costoDef = "", obsDef = "") {
  const container = document.getElementById('contenedorBloques');
  const index = contadorFilas++;
  const esEdicion = idEventoEditando !== null;
  const hoyISO = new Date().toISOString().split('T')[0];
  const minAttr = (esEdicion || currentUser.role === 'SUPERADMIN') ? '' : `min="${hoyISO}"`;

  const unificado = document.getElementById('chkUnificarCostos') ? document.getElementById('chkUnificarCostos').checked : true;
  const estadoDisabled = unificado ? 'disabled' : '';
  const opacidad = unificado ? 'opacity-50' : '';

  const div = document.createElement('div');
  div.className = "bg-white p-4 rounded-xl border border-gray-200 space-y-3 relative fila-activacion";
  div.id = `fila_${index}`;

  const tieneFecha = !!fechaPorDefecto;

  div.innerHTML = `
    <div class="flex justify-between items-center border-b pb-2">
      <span class="text-xs font-bold text-gray-500 uppercase">Activación #${container.children.length + 1}</span>
      ${(!esEdicion && container.children.length > 0) ? `<button type="button" onclick="eliminarFila(${index})" class="text-xs text-red-600 font-bold hover:underline">Quitar</button>` : ''}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Nombre del Evento *</label>
        <input type="text" id="nombreEvento_${index}" value="${nombreDef}" required class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Fecha *</label>
        <input type="date" id="fechaEvento_${index}" onchange="manejarCambioFecha(${index})" ${minAttr} value="${fechaPorDefecto}" required class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Servicio *</label>
        <select id="servicio_${index}" onchange="toggleImpresora(${index})" required class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed">
          <option value="">-- Seleccionar --</option>
          <option value="Foto Booth" ${servicioDef === 'Foto Booth' ? 'selected' : ''}>Foto Booth</option>
          <option value="Foto Gif" ${servicioDef.includes('Foto Gif') ? 'selected' : ''}>Foto Gif</option>
          <option value="360°" ${servicioDef === '360°' ? 'selected' : ''}>360°</option>
        </select>

        <div id="divImpresora_${index}" class="mt-2 ${servicioDef.includes('Foto Gif') ? '' : 'hidden'}">
          <label class="inline-flex items-center gap-1.5 text-xs font-bold text-marca-rojo cursor-pointer transition-all">
            <input type="checkbox" id="checkImpresora_${index}" onchange="validarImpresorasEnTiempoReal()" ${servicioDef === 'Foto Gif Impresión' ? 'checked' : ''} class="rounded text-marca-rojo focus:ring-marca-rojo">
            Con Impresora
          </label>
        </div>
      </div>
    </div>

    <div id="divCostosUnitario_${index}" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 pt-2 border-t border-gray-100 transition-opacity ${opacidad}">
      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Centro de Costos (Unitario)</label>
        <input type="text" id="costos_${index}" value="${costoDef}" ${estadoDisabled} class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo disabled:bg-gray-100">
      </div>
      <div>
        <label class="block text-xs font-bold text-gray-600 mb-1">Observaciones (Unitario)</label>
        <textarea id="observaciones_${index}" rows="1" ${estadoDisabled} class="w-full border-gray-300 rounded-lg p-2 text-xs border focus:outline-none focus:border-marca-rojo disabled:bg-gray-100">${obsDef}</textarea>
      </div>
    </div>
  `;

  container.appendChild(div);

  const selectServicio = document.getElementById(`servicio_${index}`);
  if (selectServicio) {
    selectServicio.disabled = !tieneFecha;
  }

  setTimeout(validarImpresorasEnTiempoReal, 50);
}

window.toggleImpresora = function(index) {
  const servicio = document.getElementById(`servicio_${index}`).value;
  const div = document.getElementById(`divImpresora_${index}`);
  const check = document.getElementById(`checkImpresora_${index}`);

  if (servicio === 'Foto Gif') {
    div.classList.remove('hidden');
  } else {
    div.classList.add('hidden');
    check.checked = false;
  }
  
  validarImpresorasEnTiempoReal();
};

window.eliminarFila = function(index) {
  const elem = document.getElementById(`fila_${index}`);
  if (elem) elem.remove();
  
  const container = document.getElementById('contenedorBloques');
  Array.from(container.children).forEach((child, i) => {
    child.querySelector('span.uppercase').innerText = `Activación #${i + 1}`;
  });

  validarImpresorasEnTiempoReal();
};

// --- MODALES Y GUARDADO ---
window.abrirModalNuevo = function(fechaInicial = "") {
  idEventoEditando = null; 
  document.getElementById('formActivacion').reset();
  
  document.getElementById('chkUnificarCostos').checked = true;
  toggleUnificarCostos();

  document.getElementById('modalTitulo').innerText = "Registrar Nueva Solicitud";
  document.getElementById('btnGuardar').innerText = "Guardar Solicitud";
  
  document.getElementById('solicita').value = currentUser.name;
  document.getElementById('contenedorEdicion').classList.add('hidden');
  document.getElementById('btnCancelar').classList.add('hidden');
  
  document.getElementById('contenedorBloques').innerHTML = "";
  contadorFilas = 0;
  agregarFilaActivacion(fechaInicial);
  
  abrirModal();
};

window.abrirModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    box.classList.remove('scale-95');
  }, 10);
};

window.cerrarModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.add('opacity-0');
  box.classList.add('scale-95');
  setTimeout(() => overlay.classList.add('hidden'), 300);
};

// --- GUARDADO ---
document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const filas = document.getElementById('contenedorBloques').children;
  if (filas.length === 0) return mostrarToast("Agrega al menos una activación.", "error");

  let payloadItems = [];

  const unificarCostos = document.getElementById('chkUnificarCostos') ? document.getElementById('chkUnificarCostos').checked : false;
  const costoGeneral = document.getElementById('costos').value;
  const obsGeneral = document.getElementById('observaciones').value;

  for (let i = 0; i < filas.length; i++) {
    const divId = filas[i].id;
    const index = divId.split('_')[1];

    const nombre = document.getElementById(`nombreEvento_${index}`).value;
    const fecha = document.getElementById(`fechaEvento_${index}`).value;
    const servicioBase = document.getElementById(`servicio_${index}`).value;
    const checkObj = document.getElementById(`checkImpresora_${index}`);
    
    const costoUnitario = document.getElementById(`costos_${index}`) ? document.getElementById(`costos_${index}`).value : "";
    const obsUnitaria = document.getElementById(`observaciones_${index}`) ? document.getElementById(`observaciones_${index}`).value : "";

    const quiereImpresora = !checkObj.disabled && checkObj.checked;

    let servicioFinal = servicioBase;
    if (servicioBase === 'Foto Gif') {
      servicioFinal = quiereImpresora ? 'Foto Gif Impresión' : 'Foto Gif Virtual';
    }

    payloadItems.push({
      numEvento: idEventoEditando, 
      tipoEvento: nombre,
      area: document.getElementById('area').value,
      solicita: currentUser.name,
      correoSolicitante: currentUser.email,
      
      centroCostos: unificarCostos ? costoGeneral : costoUnitario,
      observaciones: unificarCostos ? obsGeneral : obsUnitaria,
      
      tipoServicio: servicioFinal,
      estado: "Confirmado",
      tablet: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('tablet').value : "",
      fecha: fecha, 
      cantPersonas: 1,
      cantFotos: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('fotos').value : "",
      costo: 899,
      link: (currentUser.role === 'SUPERADMIN' && idEventoEditando) ? document.getElementById('link').value : ""
    });
  }

  // VALIDACIÓN DE SEGURIDAD PREVIA A GUARDAR (Evaluación de Rango de Impresoras)
  let impresorasBD = [];
  registrosCargados.forEach(r => {
    if (r.tipoServicio === 'Foto Gif Impresión' && r.estado !== 'Cancelado' && r.numEvento !== idEventoEditando) {
      const idx = obtenerDiaIndex(String(r.fecha));
      if (idx !== null) impresorasBD.push(idx);
    }
  });

  let impresorasForm = [];
  payloadItems.forEach(item => {
    if (item.tipoServicio === 'Foto Gif Impresión') {
      const idx = obtenerDiaIndex(item.fecha);
      if (idx !== null) impresorasForm.push(idx);
    }
  });

  let hayConflicto = false;
  let impresorasProcesadasForm = [];

  for (let fIdx of impresorasForm) {
    const diasAProbar = [fIdx - 1, fIdx, fIdx + 1];
    const todasMenosEsta = [...impresorasBD, ...impresorasProcesadasForm];

    for (let d of diasAProbar) {
      let conteo = 0;
      todasMenosEsta.forEach(eIdx => {
        if (Math.abs(d - eIdx) <= 1) conteo++;
      });

      if (conteo >= 2) {
        hayConflicto = true;
        break;
      }
    }

    if (hayConflicto) break;
    impresorasProcesadasForm.push(fIdx);
  }

  if (hayConflicto) {
    alert(`Atención\nNo contamos con la cantidad de impresoras para atender su fotogif`);
    return;
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

// --- CANCELAR EVENTO ---
window.cancelarRegistro = async function() {
  if (!idEventoEditando) return;
  if (!confirm("¿Seguro que deseas cancelar este evento? (Pasará a color negro)")) return;

  const btn = document.getElementById('btnCancelar');
  btn.innerText = "Cancelando...";
  btn.disabled = true;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'cancel', numEvento: idEventoEditando })
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
};

// --- GESTIÓN DE ADMINS ---
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

// --- VALIDACIÓN EN TIEMPO REAL DE IMPRESORAS ---
function obtenerDiaIndex(fechaStr) {
  if (!fechaStr) return null;
  const parts = fechaStr.split('T')[0].split('-');
  if (parts.length !== 3) return null;
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}

window.validarImpresorasEnTiempoReal = function() {
  const filas = Array.from(document.getElementById('contenedorBloques').children);

  let listaImpresorasDB = [];
  registrosCargados.forEach(r => {
    if (r.tipoServicio === 'Foto Gif Impresión' && r.estado !== 'Cancelado' && r.numEvento !== idEventoEditando) {
      const idx = obtenerDiaIndex(String(r.fecha));
      if (idx !== null) listaImpresorasDB.push(idx);
    }
  });

  filas.forEach(fila => {
    const index = fila.id.split('_')[1];
    const fechaInput = document.getElementById(`fechaEvento_${index}`)?.value;
    const servicio = document.getElementById(`servicio_${index}`)?.value;
    const checkImpresora = document.getElementById(`checkImpresora_${index}`);

    if (!checkImpresora) return;
    if (servicio !== 'Foto Gif' || !fechaInput) return;

    const candidatoDiaIdx = obtenerDiaIndex(fechaInput);
    if (candidatoDiaIdx === null) return;

    let listaImpresorasForm = [];
    filas.forEach(otraFila => {
      if (otraFila.id === fila.id) return;
      const otroIndex = otraFila.id.split('_')[1];
      const otraFecha = document.getElementById(`fechaEvento_${otroIndex}`)?.value;
      const otroServicio = document.getElementById(`servicio_${otroIndex}`)?.value;
      const otroCheck = document.getElementById(`checkImpresora_${otroIndex}`)?.checked;

      if (otroServicio === 'Foto Gif' && otroCheck && otraFecha) {
        const oIdx = obtenerDiaIndex(otraFecha);
        if (oIdx !== null) listaImpresorasForm.push(oIdx);
      }
    });

    const todasImpresoras = [...listaImpresorasDB, ...listaImpresorasForm];
    const diasAProbar = [candidatoDiaIdx - 1, candidatoDiaIdx, candidatoDiaIdx + 1];

    let bloqueado = false;
    for (let d of diasAProbar) {
      let conteoEnDia = 0;
      todasImpresoras.forEach(eDiaIdx => {
        if (Math.abs(d - eDiaIdx) <= 1) {
          conteoEnDia++;
        }
      });

      if (conteoEnDia >= 2) {
        bloqueado = true;
        break;
      }
    }

    if (bloqueado) {
      if (!checkImpresora.checked) {
        checkImpresora.disabled = true;
        checkImpresora.title = "Agotado: Las impresoras están al límite en este rango de fechas.";
        checkImpresora.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
      }
    } else {
      checkImpresora.disabled = false;
      checkImpresora.title = "";
      checkImpresora.parentElement.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
};

window.toggleUnificarCostos = function() {
  const chkElement = document.getElementById('chkUnificarCostos');
  if (!chkElement) return;

  const unificado = chkElement.checked;
  const contenedorGeneral = document.getElementById('contenedorCostosGeneral');
  
  if(contenedorGeneral) {
    contenedorGeneral.classList.toggle('opacity-50', !unificado);
  }
  
  const costoGeneral = document.getElementById('costos');
  const obsGeneral = document.getElementById('observaciones');
  if(costoGeneral) costoGeneral.disabled = !unificado;
  if(obsGeneral) obsGeneral.disabled = !unificado;

  const filas = document.getElementById('contenedorBloques').children;
  for (let i = 0; i < filas.length; i++) {
    const index = filas[i].id.split('_')[1];
    const divUnitario = document.getElementById(`divCostosUnitario_${index}`);
    const inputCosto = document.getElementById(`costos_${index}`);
    const inputObs = document.getElementById(`observaciones_${index}`);
    
    if (divUnitario && inputCosto && inputObs) {
      divUnitario.classList.toggle('opacity-50', unificado);
      inputCosto.disabled = unificado;
      inputObs.disabled = unificado;
    }
  }
};

window.manejarCambioFecha = function(index) {
  const inputFecha = document.getElementById(`fechaEvento_${index}`);
  const selectServicio = document.getElementById(`servicio_${index}`);

  if (inputFecha && selectServicio) {
    if (inputFecha.value) {
      selectServicio.disabled = false;
    } else {
      selectServicio.disabled = true;
      selectServicio.value = "";
      toggleImpresora(index);
    }
  }
  validarImpresorasEnTiempoReal();
};
