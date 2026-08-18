// ========= CONFIGURACIÓN =========
// PEGA AQUÍ LA URL QUE TE DIO GOOGLE APPS SCRIPT
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgT6MA0b00y8ylbjN-ql9ihKw1KnrXPJl08D1rRBw7_1Q4BuC6spkFs4vCjfRR8QKM/exec'; 
// =================================

let registrosCargados = [];
let calendar;

// Inicializar app cuando el HTML cargue
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDesdeGoogle();
});

// 1. Obtener datos de Google Sheets
async function cargarDatosDesdeGoogle() {
  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    registrosCargados = await respuesta.json();
    
    document.getElementById('loader').style.display = 'none';
    document.getElementById('calendarContainer').classList.remove('hidden');
    
    inicializarCalendario();
  } catch (error) {
    console.error("Error cargando datos:", error);
    alert("Error al conectar con Google Sheets. Revisa la consola.");
  }
}

// 2. Renderizar Calendario
function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  
  const eventos = registrosCargados
    .filter(r => r.estado !== 'Cancelado' && r.fecha)
    .map(r => {
      let color = '#000000'; // Negro por defecto
      if(r.estado === 'Confirmado') color = '#E3173E'; // Rojo marca
      if(r.estado === 'En espera') color = '#696A6d'; // Gris marca

      return {
        title: `[${r.tablet}] ${r.area}`,
        start: r.fecha.split('T')[0], // Limpiar formato fecha
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          ticket: r.ticket,
          evento: r.tipoEvento,
          estado: r.estado
        }
      };
    });

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
    events: eventos,
    eventClick: (info) => {
      const props = info.event.extendedProps;
      alert(`Evento: ${props.evento}\nTicket: ${props.ticket}\nEstado: ${props.estado}\nTablet: ${info.event.title.split(']')[0].replace('[','')}`);
    }
  });
  calendar.render();
}

// 3. Manejo de la Ventana Modal (Animaciones)
window.abrirModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.remove('hidden');
  
  // Pequeño delay para que la transición de CSS funcione correctamente
  setTimeout(() => {
    overlay.classList.remove('opacity-0');
    box.classList.remove('scale-95');
    box.classList.add('scale-100');
  }, 10);
  document.getElementById('alertaConflicto').classList.add('hidden');
}

window.cerrarModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  overlay.classList.add('opacity-0');
  box.classList.remove('scale-100');
  box.classList.add('scale-95');
  
  setTimeout(() => {
    overlay.classList.add('hidden');
    document.getElementById('formActivacion').reset();
  }, 300);
}

// 4. Guardar datos y Validar
document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fecha = document.getElementById('fechaEvento').value;
  const tablet = document.getElementById('tablet').value;

  // VALIDACIÓN ESTRICTA: ¿Existe la tablet ese día?
  const conflicto = registrosCargados.find(r => 
    r.fecha && r.fecha.startsWith(fecha) && 
    r.tablet === tablet && 
    r.estado !== 'Cancelado'
  );

  if (conflicto) {
    document.getElementById('mensajeConflicto').innerText = `La ${tablet} ya está asignada el ${fecha} para "${conflicto.tipoEvento}" (Ticket #${conflicto.ticket} del área ${conflicto.area}).`;
    document.getElementById('alertaConflicto').classList.remove('hidden');
    return; // Detiene el proceso
  }

  // Preparar botón para cargar
  const btn = document.getElementById('btnGuardar');
  btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Guardando...`;
  btn.disabled = true;

  const nuevoRegistro = {
    ticket: document.getElementById('ticket').value,
    tipoEvento: document.getElementById('tipoEvento').value,
    area: document.getElementById('area').value,
    solicita: document.getElementById('solicita').value,
    centroCostos: document.getElementById('costos').value,
    tipoServicio: document.getElementById('servicio').value,
    estado: document.getElementById('estado').value,
    tablet: tablet,
    fecha: fecha,
    cantPersonas: document.getElementById('personas').value || "",
    cantFotos: document.getElementById('fotos').value || "",
    costo: "",
    observaciones: document.getElementById('observaciones').value
  };

  try {
    // Enviar a Google Apps Script
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(nuevoRegistro)
    });

    // Actualizar la interfaz sin recargar la página entera
    registrosCargados.push(nuevoRegistro);
    calendar.destroy(); // Destruimos el calendario viejo
    inicializarCalendario(); // Creamos uno nuevo con los datos actualizados
    cerrarModal();
    
  } catch (error) {
    alert("Ocurrió un error al guardar. Revisa tu conexión.");
  } finally {
    // Restaurar el botón
    btn.innerHTML = "Guardar Registro";
    btn.disabled = false;
  }
});
