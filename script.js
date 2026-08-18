// ========= CONFIGURACIÓN =========
// Pega aquí la URL que obtuviste al implementar tu Google Apps Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwc0rgJ6XbYNVR6CubKD7fhkSVPKkTrj-oyaaiCHK1Dr9tWeY9nBinwOLAC_1LGvp1J/exec'; 
// =================================

let registrosCargados = [];
let calendar;

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosDesdeGoogle();
});

/**
 * Convierte cualquier formato de fecha (DD/MM/YYYY o YYYY-MM-DD)
 * a un formato estándar YYYY-MM-DD interpretable por el navegador.
 */
function normalizarFechaISO(fechaStr) {
  if (!fechaStr) return '';
  const str = String(fechaStr).trim();
  
  // Si la fecha viene como DD/MM/YYYY (ej: 14/08/2026)
  if (str.includes('/')) {
    const partes = str.split('/');
    if (partes.length === 3) {
      const dia = partes[0].padStart(2, '0');
      const mes = partes[1].padStart(2, '0');
      const anio = partes[2];
      return `${anio}-${mes}-${dia}`;
    }
  }
  
  // Si la fecha viene como ISO (ej: 2026-08-14T05:00:00.000Z)
  return str.split('T')[0];
}

// 1. Obtener registros de Google Sheets
async function cargarDatosDesdeGoogle() {
  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    registrosCargados = await respuesta.json();
    
    // Ocultar pantalla de carga y mostrar el contenedor del calendario
    document.getElementById('loader').style.display = 'none';
    document.getElementById('calendarContainer').classList.remove('hidden');
    
    inicializarCalendario();
  } catch (error) {
    console.error("Error al obtener datos:", error);
    alert("Error al conectar con la base de datos de Google Sheets.");
  }
}

// 2. Renderizar Calendario con FullCalendar
function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  
  // Mapear eventos desde los registros traídos de la hoja
  const eventos = registrosCargados
    .filter(r => r.estado !== 'Cancelado' && r.fecha)
    .map(r => {
      const fechaISO = normalizarFechaISO(r.fecha);
      
      // Asignar colores de acuerdo con el estado y la marca
      let color = '#000000'; // Negro corporativo por defecto
      if (r.estado === 'Confirmado') color = '#E3173E'; // Rojo corporativo
      if (r.estado === 'En espera') color = '#696A6d';  // Gris corporativo

      return {
        title: `[${r.tablet}] ${r.tipoEvento || r.area}`,
        start: fechaISO,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          ticket: r.ticket,
          area: r.area,
          evento: r.tipoEvento,
          estado: r.estado,
          solicita: r.solicita
        }
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
    eventClick: (info) => {
      const p = info.event.extendedProps;
      alert(`📌 ACTIVACIÓN REGISTRADA\n\n• Evento: ${p.evento}\n• Ticket: ${p.ticket}\n• Área: ${p.area}\n• Solicita: ${p.solicita || 'N/A'}\n• Estado: ${p.estado}`);
    }
  });
  
  calendar.render();
}

// 3. Funciones para Abrir y Cerrar Ventana Modal
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
  }, 300);
};

// 4. Validación de Cruce de Fechas y Envío de Datos
document.getElementById('formActivacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fechaIngresada = document.getElementById('fechaEvento').value; // Formato HTML input: YYYY-MM-DD
  const tabletIngresada = document.getElementById('tablet').value;

  // VERIFICACIÓN DE CONFLICTO (Misma Fecha + Misma Tablet)
  const conflicto = registrosCargados.find(r => {
    const fechaRegistroISO = normalizarFechaISO(r.fecha);
    return fechaRegistroISO === fechaIngresada && 
           r.tablet === tabletIngresada && 
           r.estado !== 'Cancelado';
  });

  if (conflicto) {
    const mensaje = `La ${tabletIngresada} ya está ocupada el día ${fechaIngresada} por el evento "${conflicto.tipoEvento}" (Ticket #${conflicto.ticket} - Área: ${conflicto.area}).`;
    document.getElementById('mensajeConflicto').innerText = mensaje;
    document.getElementById('alertaConflicto').classList.remove('hidden');
    return; // Cancela el guardado
  }

  // Deshabilitar botón durante el proceso de guardado
  const btn = document.getElementById('btnGuardar');
  btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Guardando...`;
  btn.disabled = true;

  // Estructura de objeto sincronizada con las variables del Apps Script
  const nuevoRegistro = {
    ticket: document.getElementById('ticket').value,
    tipoEvento: document.getElementById('tipoEvento').value,
    area: document.getElementById('area').value,
    solicita: document.getElementById('solicita').value,
    centroCostos: document.getElementById('costos').value,
    tipoServicio: document.getElementById('servicio').value,
    estado: document.getElementById('estado').value,
    tablet: tabletIngresada,
    fecha: fechaIngresada, // Envía YYYY-MM-DD; el Apps Script lo transforma a DD/MM/YYYY
    cantPersonas: document.getElementById('personas').value || "",
    cantFotos: document.getElementById('fotos').value || "",
    costo: "",
    observaciones: document.getElementById('observaciones').value
  };

  try {
    // Petición POST a Google Apps Script
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(nuevoRegistro)
    });

    // Actualizar datos locales y refrescar interfaz
    registrosCargados.push(nuevoRegistro);
    calendar.destroy();
    inicializarCalendario();
    cerrarModal();
    
  } catch (error) {
    console.error("Error al registrar:", error);
    alert("Hubo un error al guardar la información. Por favor revisa la conexión.");
  } finally {
    btn.innerHTML = "Guardar Registro";
    btn.disabled = false;
  }
});
