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
    const partes = str.split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
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
      if (r.estado === 'Confirmado') color = '#E3173E'; 
      if (r.estado === 'En Espera' || r.estado === 'En espera') color = '#696A6d';  

      return {
        title: `${r.tipoEvento || r.area} [${r.tablet}]`, 
        start: fechaISO,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { ...r } 
      };
    });

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
            <strong>Evento:</strong> ${p.tipoEvento || p.area}<br>
            <strong>Solicita:</strong> ${p.solicita || 'N/A'}<br>
            <strong>Tablet:</strong> ${p.tablet}
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

      // Cambiamos el título
      document.getElementById('modalTitulo').innerText = "Editar Activación";
      document.getElementById('btnGuardar').innerText = "Actualizar Registro";
      
      // MOSTRAMOS los campos de Fotos y Link al Editar
      document.getElementById('contenedorFotos').classList.remove('hidden');
      document.getElementById('contenedorLink').classList.remove('hidden');

      // Llenamos el formulario
      document.getElementById('ticket').value = p.ticket || "";
      document.getElementById('tipoEvento').value = p.tipoEvento || "";
      document.getElementById('area').value = p.area || "";
      document.getElementById('solicita').value = p.solicita || "";
      document.getElementById('costos').value = p.centroCostos || "";
      document.getElementById('servicio').value = p.tipoServicio || "";
      document.getElementById('estado').value = p.estado || "";
      document.getElementById('tablet').value = p.tablet || "";
      document.getElementById('fechaEvento').value = normalizarFechaISO(p.fecha);
      document.getElementById('personas').value = p.cantPersonas || "";
      document.getElementById('fotos').value = p.cantFotos || "";
      document.getElementById('link').value = p.link || ""; 
      document.getElementById('observaciones').value = p.observaciones || "";

      abrirModal();
    }
  });
  
  calendar.render();
}

window.abrirModalNuevo = function() {
  idEventoEditando = null; 
  document.getElementById('formActivacion').reset();
  
  document.getElementById('modalTitulo').innerText = "Registrar Activación";
  document.getElementById('btnGuardar').innerText = "Guardar Registro";
  
  // OCULTAMOS los campos de Fotos y Link al Crear
  document.getElementById('contenedorFotos').classList.add('hidden');
  document.getElementById('contenedorLink').classList.add('hidden');
  
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
    document.getElementById('formActivacion').reset();
    idEventoEditando = null;
  }, 300);
};

document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fechaIngresada = document.getElementById('fechaEvento').value; 
  const tabletIngresada = document.getElementById('tablet').value;

  const conflicto = registrosCargados.find(r => {
    const fechaRegistroISO = normalizarFechaISO(r.fecha);
    return fechaRegistroISO === fechaIngresada && 
           r.tablet === tabletIngresada && 
           r.estado !== 'Cancelado' &&
           r.numEvento !== idEventoEditando; 
  });

  if (conflicto) {
    const mensaje = `La ${tabletIngresada} ya está ocupada el día ${fechaIngresada} por "${conflicto.tipoEvento}".`;
    document.getElementById('mensajeConflicto').innerText = mensaje;
    document.getElementById('alertaConflicto').classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btnGuardar');
  btn.innerHTML = `Guardando...`;
  btn.disabled = true;

  const payload = {
    action: idEventoEditando ? 'update' : 'create', 
    numEvento: idEventoEditando, 
    ticket: document.getElementById('ticket').value,
    tipoEvento: document.getElementById('tipoEvento').value,
    area: document.getElementById('area').value,
    solicita: document.getElementById('solicita').value,
    centroCostos: document.getElementById('costos').value,
    tipoServicio: document.getElementById('servicio').value,
    estado: document.getElementById('estado').value,
    tablet: tabletIngresada,
    fecha: fechaIngresada, 
    cantPersonas: document.getElementById('personas').value || "",
    cantFotos: document.getElementById('fotos').value || "",
    link: document.getElementById('link').value || "", 
    observaciones: document.getElementById('observaciones').value
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    await cargarDatosDesdeGoogle();
    cerrarModal();
  } catch (error) {
    console.error("Error al registrar:", error);
    alert("Hubo un error al guardar.");
  } finally {
    btn.innerHTML = idEventoEditando ? "Actualizar Registro" : "Guardar Registro";
    btn.disabled = false;
  }
});
