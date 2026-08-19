const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdEBj55fO1ZvkxL2o-6Fyrry2w5fP7KeJ-dupAWd_MNpsr-ela-FiTEtgocGnVvREX/exec'; 

let registrosCargados = [];
let calendar;
let idEventoEditando = null; 

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDesdeGoogle();
});

function normalizarFechaISO(fechaStr) {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();
  if (str.includes('/')) {
    const p = str.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return str.split('T')[0];
}

async function cargarDatosDesdeGoogle() {
  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    registrosCargados = await respuesta.json();
    document.getElementById('loader').style.display = 'none';
    document.getElementById('calendarContainer').classList.remove('hidden');
    inicializarCalendario();
  } catch (error) {
    console.error("Error al obtener datos:", error);
    alert("Error al conectar con la base de datos de Google Sheets.");
  }
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  
  const eventos = registrosCargados
    .filter(r => r.estado !== 'Cancelado' && r.fecha)
    .map(r => {
      const fechaISO = normalizarFechaISO(r.fecha);
      let color = '#000000'; // Default
      
      // Construir título: Nombre del Evento [Servicio] - [Tablet si existe]
      let titulo = `${r.tipoEvento} [${r.tipoServicio}]`;
      if (r.tablet) titulo += ` [${r.tablet}]`;

      return {
        title: titulo, 
        start: fechaISO,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { ...r } 
      };
    });

  if(calendar) calendar.destroy(); // Limpiar antes de re-renderizar

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
            <strong>Tablet:</strong> ${p.tablet || 'Pendiente de asignar'}
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
      
      // Ocultar campo de cantidad y mostrar sección de admin/tablet
      document.getElementById('contenedorCantidad').classList.add('hidden');
      document.getElementById('contenedorEdicion').classList.remove('hidden');
      document.getElementById('btnEliminar').classList.remove('hidden');

      // Llenar datos generales
      document.getElementById('area').value = p.area || "DPA";
      document.getElementById('solicita').value = p.solicita || "";
      document.getElementById('costos').value = p.centroCostos || "";
      document.getElementById('observaciones').value = p.observaciones || "";

      // Forzar 1 solo bloque en edición
      document.getElementById('cantActivaciones').value = 1;
      renderizarBloques();
      
      // Llenar bloque 0 con datos del evento
      document.getElementById('nombreEvento_0').value = p.tipoEvento || "";
      document.getElementById('servicio_0').value = p.tipoServicio || "";
      document.getElementById('fechaEvento_0').value = normalizarFechaISO(p.fecha);

      // Llenar datos Admin
      document.getElementById('tablet').value = p.tablet || "";
      document.getElementById('fotos').value = p.cantFotos || "";
      document.getElementById('link').value = p.link || ""; 

      abrirModal();
    }
  });
  calendar.render();
}

// Generador de bloques dinámicos
window.renderizarBloques = function() {
  const container = document.getElementById('contenedorBloques');
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  container.innerHTML = '';

  for (let i = 0; i < cant; i++) {
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
            <select id="servicio_${i}" required class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none focus:border-marca-rojo">
              <option value="Foto Booth">Foto Booth</option>
              <option value="360°">360°</option>
              <option value="Foto Gif Impresión">Foto Gif Impresión</option>
              <option value="Foto Gif Virtual">Foto Gif Virtual</option>
              <option value="Foto con QR">Foto con QR</option>
              <option value="Foto Correo">Foto Correo</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-marca-gris mb-1">Fecha *</label>
            <input type="date" id="fechaEvento_${i}" required class="w-full border-gray-300 rounded-lg p-2.5 text-sm border focus:outline-none focus:border-marca-rojo">
          </div>

        </div>
      </div>
    `;
    container.innerHTML += bloque;
  }
};

window.abrirModalNuevo = function() {
  idEventoEditando = null; 
  document.getElementById('formActivacion').reset();
  
  document.getElementById('modalTitulo').innerText = "Registrar Nueva Solicitud";
  document.getElementById('btnGuardar').innerText = "Guardar Solicitud";
  
  // Mostrar cantidad, ocultar admin
  document.getElementById('contenedorCantidad').classList.remove('hidden');
  document.getElementById('contenedorEdicion').classList.add('hidden');
  document.getElementById('btnEliminar').classList.add('hidden');
  
  document.getElementById('cantActivaciones').value = 1;
  renderizarBloques();
  
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

// Validar bloqueo de Foto Gif Impresión (Regla 3 días, Max 2 unidades)
function validarBloqueo(fechaEvaluada, idEvadiendo) {
  const msPorDia = 24 * 60 * 60 * 1000;
  const tEvaluado = new Date(fechaEvaluada).getTime();
  
  let ocupados = 0;
  
  registrosCargados.forEach(r => {
    if (r.estado === 'Cancelado' || r.estado === 'Disponible') return;
    if (r.tipoServicio !== 'Foto Gif Impresión') return;
    if (r.numEvento === idEvadiendo) return; // Si estamos editando, ignorar este
    
    const tRegistro = new Date(normalizarFechaISO(r.fecha)).getTime();
    const diferenciaDias = Math.abs((tRegistro - tEvaluado) / msPorDia);
    
    if (diferenciaDias <= 1) { // Día previo, mismo día o día posterior
      ocupados++;
    }
  });
  
  return ocupados >= 2;
}

// Asignador automático de Costos
function obtenerCosto(servicio) {
  if (servicio === 'Foto con QR') return 600;
  if (servicio === 'Foto Correo' || servicio === 'Foto Gif Impresión') return 899;
  return "";
}

document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  let bloqueosDetectados = [];
  let payloadItems = [];

  // Recolectar datos generales
  const areaG = document.getElementById('area').value;
  const solicitaG = document.getElementById('solicita').value;
  const costosG = document.getElementById('costos').value;
  const obsG = document.getElementById('observaciones').value;

  // Revisar bloqueos y construir payloads por cada cajita
  for (let i = 0; i < cant; i++) {
    const fecha = document.getElementById(`fechaEvento_${i}`).value;
    const servicio = document.getElementById(`servicio_${i}`).value;
    const nombre = document.getElementById(`nombreEvento_${i}`).value;

    if (servicio === 'Foto Gif Impresión') {
      if (validarBloqueo(fecha, idEventoEditando)) {
        bloqueosDetectados.push(`- No hay "Foto Gif Impresión" disponible para el ${fecha} (ocupado por regla de 3 días).`);
      }
    }

    payloadItems.push({
      numEvento: idEventoEditando, 
      tipoEvento: nombre,
      area: areaG,
      solicita: solicitaG,
      centroCostos: costosG,
      tipoServicio: servicio,
      estado: "Confirmado", // Automático
      tablet: idEventoEditando ? document.getElementById('tablet').value : "", // Solo en edición
      fecha: fecha, 
      cantPersonas: 1, // Automático
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

  const btn = document.getElementById('btnGuardar');
  btn.innerHTML = `Procesando...`;
  btn.disabled = true;

  try {
    // Mandamos todo como un arreglo al backend
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: idEventoEditando ? 'update' : 'create_multiple',
        items: payloadItems
      })
    });

    await cargarDatosDesdeGoogle();
    cerrarModal();
  } catch (error) {
    console.error("Error:", error);
    alert("Hubo un error al guardar.");
  } finally {
    btn.innerHTML = idEventoEditando ? "Actualizar" : "Guardar";
    btn.disabled = false;
  }
});

// Botón para eliminar un registro (Admin)
window.eliminarRegistro = async function() {
  if (!idEventoEditando) return;
  if (!confirm("¿Estás seguro de que deseas eliminar este registro permanentemente del Excel?")) return;

  const btn = document.getElementById('btnEliminar');
  btn.innerHTML = `Borrando...`;
  btn.disabled = true;

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'delete',
        numEvento: idEventoEditando
      })
    });
    await cargarDatosDesdeGoogle();
    cerrarModal();
  } catch (error) {
    alert("Error al intentar borrar el registro.");
    btn.innerHTML = `Borrar Registro`;
    btn.disabled = false;
  }
}
