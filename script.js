const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwc0rgJ6XbYNVR6CubKD7fhkSVPKkTrj-oyaaiCHK1Dr9tWeY9nBinwOLAC_1LGvp1J/exec'; 

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
      let color = '#000000'; 
      
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

  if(calendar) calendar.destroy(); 

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
      
      document.getElementById('contenedorCantidad').classList.add('hidden');
      document.getElementById('contenedorEdicion').classList.remove('hidden');
      document.getElementById('btnEliminar').classList.remove('hidden');

      document.getElementById('area').value = p.area || "DPA";
      document.getElementById('solicita').value = p.solicita || "";
      document.getElementById('costos').value = p.centroCostos || "";
      document.getElementById('observaciones').value = p.observaciones || "";

      document.getElementById('cantActivaciones').value = 1;
      renderizarBloques();
      
      document.getElementById('nombreEvento_0').value = p.tipoEvento || "";
      document.getElementById('servicio_0').value = p.tipoServicio || "";
      document.getElementById('fechaEvento_0').value = normalizarFechaISO(p.fecha);

      document.getElementById('tablet').value = p.tablet || "";
      document.getElementById('fotos').value = p.cantFotos || "";
      document.getElementById('link').value = p.link || ""; 

      abrirModal();
    }
  });
  calendar.render();
}

window.renderizarBloques = function() {
  const container = document.getElementById('contenedorBloques');
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  container.innerHTML = '';

  for (let i = 0; i < cant; i++) {
    // AQUI SE REMOVIERON LOS SERVICIOS ANTIGUOS
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

// Función para contar cruces en la BASE DE DATOS
function contarOcupadosBD(fechaEvaluada, idEvadiendo) {
  const msPorDia = 24 * 60 * 60 * 1000;
  const tEvaluado = new Date(fechaEvaluada).getTime();
  let ocupados = 0;
  
  registrosCargados.forEach(r => {
    if (r.estado === 'Cancelado' || r.estado === 'Disponible') return;
    if (r.tipoServicio !== 'Foto Gif Impresión') return;
    if (r.numEvento === idEvadiendo) return; 
    
    const tRegistro = new Date(normalizarFechaISO(r.fecha)).getTime();
    if (Math.abs((tRegistro - tEvaluado) / msPorDia) <= 1) { 
      ocupados++;
    }
  });
  return ocupados;
}

function obtenerCosto(servicio) {
  if (servicio === 'Foto Gif Impresión') return 899;
  return "";
}

document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const cant = parseInt(document.getElementById('cantActivaciones').value) || 1;
  let bloqueosDetectados = [];
  let payloadItems = [];
  let fechasGifFormulario = []; // Memoria temporal para evitar trampas en el mismo form

  const areaG = document.getElementById('area').value;
  const solicitaG = document.getElementById('solicita').value;
  const costosG = document.getElementById('costos').value;
  const obsG = document.getElementById('observaciones').value;

  for (let i = 0; i < cant; i++) {
    const fecha = document.getElementById(`fechaEvento_${i}`).value;
    const servicio = document.getElementById(`servicio_${i}`).value;
    const nombre = document.getElementById(`nombreEvento_${i}`).value;

    if (servicio === 'Foto Gif Impresión') {
      const msPorDia = 24 * 60 * 60 * 1000;
      const tEvaluado = new Date(fecha).getTime();
      
      let ocupadosTotal = contarOcupadosBD(fecha, idEventoEditando);
      
      // Validar también contra las fechas que ya pusimos en este mismo formulario
      fechasGifFormulario.forEach(f => {
        const tTemp = new Date(f).getTime();
        if (Math.abs((tTemp - tEvaluado) / msPorDia) <= 1) {
          ocupadosTotal++;
        }
      });

      if (ocupadosTotal >= 2) {
        bloqueosDetectados.push(`- Límite excedido para "Foto Gif Impresión" cerca al ${fecha}.`);
      } else {
        fechasGifFormulario.push(fecha); // Aprobarlo temporalmente y añadirlo a la memoria
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

  const btn = document.getElementById('btnGuardar');
  btn.innerHTML = `Procesando...`;
  btn.disabled = true;

  try {
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
