const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdEBj55fO1ZvkxL2o-6Fyrry2w5fP7KeJ-dupAWd_MNpsr-ela-FiTEtgocGnVvREX/exec'; 

let registrosCargados = [];
let calendar;
let idEventoEditando = null; 

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDesdeGoogle();
});

// SISTEMA DE NOTIFICACIONES FLOTANTES (TOASTS)
function mostrarToast(mensaje, tipo = 'exito') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColor = tipo === 'exito' ? 'bg-emerald-600' : tipo === 'error' ? 'bg-marca-rojo' : 'bg-gray-800';
  
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-3 transform translate-y-5 opacity-0 transition-all duration-300 pointer-events-auto`;
  toast.innerHTML = `
    <span>${mensaje}</span>
    <button onclick="this.parentElement.remove()" class="ml-auto text-white/80 hover:text-white font-bold">✕</button>
  `;

  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-y-5', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function normalizarFechaISO(fechaStr) {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();
  if (str.includes('/')) {
    const p = str.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return str.split('T')[0];
}

function obtenerFechaHoyISO() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function cargarDatosDesdeGoogle() {
  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    const textoRaw = await respuesta.text();

    try {
      registrosCargados = JSON.parse(textoRaw);
    } catch (e) {
      mostrarToast("Respuesta del servidor no válida.", "error");
      return;
    }

    document.getElementById('loader').style.display = 'none';
    document.getElementById('calendarContainer').classList.remove('hidden');
    inicializarCalendario();
  } catch (error) {
    mostrarToast("Error de conexión al cargar registros.", "error");
  }
}

function generarEventosProcesados() {
  const areaFiltro = document.getElementById('filtroArea')?.value || 'TODAS';
  const servicioFiltro = document.getElementById('filtroServicio')?.value || 'TODOS';
  const busquedaTexto = (document.getElementById('buscadorTexto')?.value || '').toLowerCase().trim();
  const hoyStr = obtenerFechaHoyISO();

  return registrosCargados
    .filter(r => r.fecha)
    .filter(r => {
      if (areaFiltro !== 'TODAS' && r.area !== areaFiltro) return false;
      if (servicioFiltro !== 'TODOS' && r.tipoServicio !== servicioFiltro) return false;
      
      // Filtro de búsqueda por nombre de evento o solicitante
      if (busquedaTexto) {
        const matchEvento = (r.tipoEvento || '').toLowerCase().includes(busquedaTexto);
        const matchSolicita = (r.solicita || '').toLowerCase().includes(busquedaTexto);
        if (!matchEvento && !matchSolicita) return false;
      }

      return true;
    })
    .map(r => {
      const fechaISO = normalizarFechaISO(r.fecha);
      const esPasado = fechaISO < hoyStr;
      const esCancelado = r.estado === 'Cancelado';

      let color = '#000000'; 
      let titulo = `${r.tipoEvento} [${r.tipoServicio}]`;

      if (esCancelado) {
        color = '#000000'; 
        titulo = `[CANCELADO] ${r.tipoEvento}`;
      } else if (esPasado) {
        color = '#333333'; 
      } else {
        if (r.tipoServicio.includes('Foto Gif')) {
          color = '#E3173E'; 
        } else if (r.tipoServicio === 'Foto Booth') {
          color = '#2563EB'; 
        } else if (r.tipoServicio === '360°') {
          color = '#16A34A'; 
        }
      }

      return {
        title: titulo, 
        start: fechaISO,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { ...r } 
      };
    });
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  const eventos = generarEventosProcesados();

  if (calendar) calendar.destroy(); 

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: { 
      left: 'prev,next today', 
      center: 'title', 
      right: 'dayGridMonth,timeGridWeek,listWeek' 
    },
    events: eventos,
    
    eventMouseEnter: function(info) {
      const p = info.event.extendedProps;
      tippy(info.el, {
        content: `
          <div style="text-align:left; font-size:13px;">
            <strong>Evento:</strong> ${p.tipoEvento}<br>
            <strong>Servicio:</strong> ${p.tipoServicio}<br>
            <strong>Solicita:</strong> ${p.solicita}<br>
            <strong>Estado:</strong> ${p.estado || 'Confirmado'}
          </div>
        `,
        allowHTML: true,
        theme: 'light',
        placement: 'top',
        animation: 'scale'
      });
    },

    eventClick: (info) => {
      const p = info.event.extendedProps;
      idEventoEditando = p.numEvento; 

      document.getElementById('modalTitulo').innerText = "Editar Activación (Vista Admin)";
      document.getElementById('btnGuardar').innerText = "Actualizar";
      
      document.getElementById('contenedorCantidad').classList.add('hidden');
      document.getElementById('contenedorEdicion').classList.remove('hidden');
      document.getElementById('accionesAdmin').classList.remove('hidden');

      document.getElementById('area').value = p.area || "DPA";
      document.getElementById('solicita').value = p.solicita || "";
      document.getElementById('costos').value = p.centroCostos || "";
      document.getElementById('observaciones').value = p.observaciones || "";

      document.getElementById('cantActivaciones').value = 1;
      renderizarBloques(true); // Permite editar fechas pasadas si es admin
      
      document.getElementById('nombreEvento_0').value = p.tipoEvento || "";
      document.getElementById('servicio_0').value = p.tipoServicio || "";
      document.getElementById('fechaEvento_0').value = normalizarFechaISO(p.fecha);

      document.getElementById('tablet').value = p.tablet || "";
      document.getElementById('fotos').value = p.cantFotos || "";
      document.getElementById('link').value = p.link || ""; 

      actualizarOpcionesDisponibilidad();
      abrirModal();
    }
  });
  calendar.render();
}

window.aplicarFiltros = function() {
  if (calendar) {
    calendar.removeAllEvents();
    calendar.addEventSource(generarEventosProcesados());
  }
};

function calcularDisponibilidadGif(fechaEval, blockIndexActual) {
  if (!fechaEval) return 2;
  
  const msPorDia = 24 * 60 * 60 * 1000;
  const tEval = new Date(fechaEval).getTime();
  
  const diasVentana = [tEval - msPorDia, tEval, tEval + msPorDia];
  let maxOcupadosEnVentana = 0;

  diasVentana.forEach(tDia => {
    let ocupadosEnEsteDia = 0;

    registrosCargados.forEach(r => {
      if (r.estado === 'Cancelado' || r.estado === 'Disponible') return;
      if (r.tipoServicio !== 'Foto Gif Impresión') return;
      if (String(r.numEvento).trim() === String(idEventoEditando).trim()) return;

      const tReg = new Date(normalizarFechaISO(r.fecha)).getTime();
      if (Math.abs((tReg - tDia) / msPorDia) <= 1) {
        ocupadosEnEsteDia++;
      }
    });

    const cant = parseInt(document.getElementById('cantActivaciones')?.value) || 1;
    for (let j = 0; j < cant; j++) {
      if (j === blockIndexActual) continue;
      
      const servJ = document.getElementById(`servicio_${j}`)?.value;
      const fechaJ = document.getElementById(`fechaEvento_${j}`)?.value;

      if (servJ === 'Foto Gif Impresión' && fechaJ) {
        const tJ = new Date(fechaJ).getTime();
        if (Math.abs((tJ - tDia) / msPorDia) <= 1) {
          ocupadosEnEsteDia++;
        }
      }
    }

    if (ocupadosEnEsteDia > maxOcupadosEnVentana) {
      maxOcupadosEnVentana = ocupadosEnEsteDia;
    }
  });

  return Math.max(0, 2 - maxOcupadosEnVentana);
}

window.actualizarOpcionesDisponibilidad = function() {
  const cant = parseInt(document.getElementById('cantActivaciones')?.value) || 1;

  for (let i = 0; i < cant; i++) {
    const selectServicio = document.getElementById(`servicio_${i}`);
    const inputFecha = document.getElementById(`fechaEvento_${i}`);
    if (!selectServicio || !inputFecha) continue;

    const fechaVal = inputFecha.value;
    const disponibles = calcularDisponibilidadGif(fechaVal, i);

    for (let opt of selectServicio.options) {
      if (opt.value === 'Foto Gif Impresión') {
        if (disponibles >= 2) {
          opt.text = "Foto Gif Impresión (2 disponibles)";
          opt.disabled = false;
        } else if (disponibles === 1) {
          opt.text = "Foto Gif Impresión (1 disponible)";
          opt.disabled = false;
        } else {
          opt.text = "Foto Gif Impresión (Agotado)";
          opt.disabled = true;
          if (selectServicio.value === 'Foto Gif Impresión') {
            selectServicio.value = 'Foto Booth';
          }
        }
      }
    }
  }
};

window.renderizarBloques = function(esEdicion = false) {
  const container = document.getElementById('contenedorBloques');
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  const hoyISO = obtenerFechaHoyISO();
  container.innerHTML = '';

  for (let i = 0; i < cant; i++) {
    // Si es una solicitud nueva, se aplica min="${hoyISO}" para bloquear fechas pasadas
    const minAttr = esEdicion ? '' : `min="${hoyISO}"`;

    const bloque = `
      <div class="border border-gray-200 p-4 rounded-xl relative">
        <div class="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-marca-gris">ACTIVACIÓN ${i + 1}</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          
          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Nombre del Evento *</label>
            <input type="text" id="nombreEvento_${i}" required placeholder="Ej: Feria de Ciencias" class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none focus:border-marca-rojo">
          </div>

          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Activación *</label>
            <select id="servicio_${i}" required onchange="actualizarOpcionesDisponibilidad()" class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none focus:border-marca-rojo">
              <option value="Foto Booth">Foto Booth</option>
              <option value="360°">360°</option>
              <option value="Foto Gif Impresión">Foto Gif Impresión (2 disponibles)</option>
              <option value="Foto Gif Virtual">Foto Gif Virtual</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Fecha *</label>
            <input type="date" id="fechaEvento_${i}" ${minAttr} required onchange="actualizarOpcionesDisponibilidad()" class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none focus:border-marca-rojo">
          </div>

        </div>
      </div>
    `;
    container.innerHTML += bloque;
  }
  actualizarOpcionesDisponibilidad();
};

window.abrirModalNuevo = function() {
  idEventoEditando = null; 
  document.getElementById('formActivacion').reset();
  
  document.getElementById('modalTitulo').innerText = "Registrar Nueva Solicitud";
  document.getElementById('btnGuardar').innerText = "Guardar Solicitud";
  
  document.getElementById('contenedorCantidad').classList.remove('hidden');
  document.getElementById('contenedorEdicion').classList.add('hidden');
  document.getElementById('accionesAdmin').classList.add('hidden');
  
  document.getElementById('cantActivaciones').value = 1;
  renderizarBloques(false);
  
  abrirModal();
};

window.abrirModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    box.classList.add('scale-100');
  }, 10);
  document.getElementById('alertaConflicto').classList.add('hidden');
};

window.cerrarModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.add('opacity-0');
  box.classList.remove('scale-100');
  box.classList.add('scale-95');
  setTimeout(() => {
    overlay.classList.add('hidden');
    idEventoEditando = null;
  }, 300);
};

function obtenerCosto(servicio) {
  if (servicio === 'Foto Gif Impresión' || servicio === 'Foto Gif Virtual') return 899;
  return "";
}

document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  let bloqueosDetectados = [];
  let payloadItems = [];

  const areaG = document.getElementById('area').value;
  const solicitaG = document.getElementById('solicita').value;
  const costosG = document.getElementById('costos').value;
  const obsG = document.getElementById('observaciones').value;

  for (let i = 0; i < cant; i++) {
    const fecha = document.getElementById(`fechaEvento_${i}`).value;
    const servicio = document.getElementById(`servicio_${i}`).value;
    const nombre = document.getElementById(`nombreEvento_${i}`).value;

    if (servicio === 'Foto Gif Impresión') {
      const disp = calcularDisponibilidadGif(fecha, i);
      if (disp <= 0) {
        bloqueosDetectados.push(`- Límite excedido para "Foto Gif Impresión" cerca al ${fecha}.`);
      }
    }

    payloadItems.push({
      numEvento: idEventoEditando, 
      tipoEvento: nombre,
      area: areaG,
      solicita: solicitaG,
      centroCostos: costosG,
      tipoServicio: servicio,
      estado: "Confirmado",
      tablet: idEventoEditando ? document.getElementById('tablet').value : "",
      fecha: fecha, 
      cantPersonas: 1, 
      cantFotos: idEventoEditando ? document.getElementById('fotos').value : "",
      costo: obtenerCosto(servicio),
      link: idEventoEditando ? document.getElementById('link').value : "", 
      observaciones: obsG
    });
  }

  if (bloqueosDetectados.length > 0) {
    const alerta = document.getElementById('alertaConflicto');
    alerta.innerHTML = `<strong>Conflicto de Inventario:</strong><br>${bloqueosDetectados.join('<br>')}`;
    alerta.classList.remove('hidden');
    return;
  }

  const payloadCompleto = {
    action: idEventoEditando ? 'update' : 'create_multiple',
    items: payloadItems
  };

  const btn = document.getElementById('btnGuardar');
  btn.innerHTML = `Procesando...`;
  btn.disabled = true;

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payloadCompleto)
    });

    const textoRespuesta = await res.text();
    let resJson;
    try {
      resJson = JSON.parse(textoRespuesta);
    } catch (e) {
      mostrarToast("Error en formato de respuesta del servidor.", "error");
      return;
    }

    if (resJson.status === 'error') {
      mostrarToast(`Error: ${resJson.message || resJson.errorDetallado}`, "error");
    } else {
      mostrarToast(idEventoEditando ? "Registro actualizado correctamente" : "Solicitud registrada con éxito", "exito");
      await cargarDatosDesdeGoogle();
      cerrarModal();
    }
  } catch (error) {
    mostrarToast("Error de conexión al guardar.", "error");
  } finally {
    btn.innerHTML = idEventoEditando ? "Actualizar" : "Guardar";
    btn.disabled = false;
  }
});

// CANCELAR REGISTRO
window.cancelarRegistro = async function() {
  if (!idEventoEditando) return;
  if (!confirm("¿Estás seguro de que deseas marcar este evento como CANCELADO?")) return;

  const btn = document.getElementById('btnCancelar');
  btn.innerHTML = `Cancelando...`;
  btn.disabled = true;

  const registroActual = registrosCargados.find(r => String(r.numEvento).trim() === String(idEventoEditando).trim());
  if (!registroActual) {
    mostrarToast("No se encontró el registro.", "error");
    btn.innerHTML = `Cancelar Evento`;
    btn.disabled = false;
    return;
  }

  const payloadItem = {
    numEvento: idEventoEditando,
    tipoEvento: registroActual.tipoEvento,
    area: registroActual.area,
    solicita: registroActual.solicita,
    centroCostos: registroActual.centroCostos,
    tipoServicio: registroActual.tipoServicio,
    estado: "Cancelado",
    tablet: registroActual.tablet || "",
    fecha: normalizarFechaISO(registroActual.fecha),
    cantPersonas: registroActual.cantPersonas || 1,
    cantFotos: registroActual.cantFotos || "",
    costo: registroActual.costo || "",
    link: registroActual.link || "",
    observaciones: registroActual.observaciones || ""
  };

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'update',
        items: [payloadItem]
      })
    });

    const textoRespuesta = await res.text();
    let resJson;
    try {
      resJson = JSON.parse(textoRespuesta);
    } catch (e) {
      mostrarToast("Error al procesar la respuesta.", "error");
      return;
    }

    if (resJson.status === 'error') {
      mostrarToast(`Error al cancelar: ${resJson.errorDetallado}`, "error");
    } else {
      mostrarToast("Evento cancelado correctamente", "exito");
      await cargarDatosDesdeGoogle();
      cerrarModal();
    }
  } catch (error) {
    mostrarToast("Error de conexión al intentar cancelar.", "error");
  } finally {
    btn.innerHTML = `Cancelar Evento`;
    btn.disabled = false;
  }
};
