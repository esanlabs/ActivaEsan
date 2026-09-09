// Registrar plugin para mostrar siempre las etiquetas en los gráficos
Chart.register(ChartDataLabels);
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoxLf6Au7NsKGunDpDcl_4sUCbZZVZ_vuz5DenBjzw6l4WOCiFH8CvPxGtpEpzNkqy/exec';

let datosOriginales = [];
let chartServicios = null;
let chartAreas = null;
let chartDinero = null;

document.addEventListener('DOMContentLoaded', () => {
  if (verificarAcceso()) {
    cargarDatosDashboard();
  }
});

// Valida que solo el SuperAdmin pueda ingresar a este archivo
function verificarAcceso() {
  const sesion = sessionStorage.getItem('currentUser');
  const usuario = sesion ? JSON.parse(sesion) : null;

  if (!usuario || usuario.role !== 'SUPERADMIN') {
    alert("Acceso denegado: Esta vista es exclusiva para Super Administradores.");
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

async function cargarDatosDashboard() {
  const loader = document.getElementById('loaderDashboard');
  if (loader) loader.classList.remove('hidden');

  try {
    const respuesta = await fetch(GOOGLE_SCRIPT_URL);
    const resData = await respuesta.json();

    if (resData.status === 'error') {
      throw new Error(resData.error || resData.errorDetallado);
    }

    datosOriginales = resData.registros || [];

    // 👈 Ejecutar la auditoría de calidad sobre los registros cargados
    ejecutarAuditoriaCalidad(datosOriginales);
    
    // Llenar dinámicamente las opciones de Checkboxes y buscadores
    poblarFiltros(datosOriginales);

    // Renderizar tarjetas y gráficos
    filtrarYRenderizar();

  } catch (error) {
    console.error("Error al cargar datos del dashboard:", error);
    alert(`Error al cargar datos: ${error.message}`);
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

/* ==========================================================
   LÓGICA DE FILTROS MULTI-SELECCIÓN CON BUSCADOR INTERNO
   ========================================================== */

// Mostrar / Ocultar menús desplegables
function toggleDropdown(event, id) {
  event.stopPropagation();
  const target = document.getElementById(id);
  const estaOculto = target.classList.contains('hidden');

  // Cerrar otros desplegables abiertos
  document.querySelectorAll('.dropdown-container > div').forEach(div => div.classList.add('hidden'));

  if (estaOculto) {
    target.classList.remove('hidden');
    // Enfocar automáticamente la caja de búsqueda del desplegable abierto
    const inputBuscar = target.querySelector('input[type="text"]');
    if (inputBuscar) inputBuscar.focus();
  }
}

// Cerrar desplegables al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-container')) {
    document.querySelectorAll('.dropdown-container > div').forEach(div => div.classList.add('hidden'));
  }
});

// Función para filtrar las opciones dentro del menú desplegable en tiempo real
function filtrarOpcionesDropdown(input) {
  const texto = input.value.toLowerCase().trim();
  const contenedor = input.closest('.dropdown-container');
  const opciones = contenedor.querySelectorAll('.option-item');

  opciones.forEach(label => {
    const textoOpcion = label.textContent.toLowerCase();
    if (textoOpcion.includes(texto)) {
      label.classList.remove('hidden');
      label.classList.add('flex');
    } else {
      label.classList.add('hidden');
      label.classList.remove('flex');
    }
  });
}

// Poblar dinámicamente las listas de Checkboxes con Input de Búsqueda
function poblarFiltros(registros) {
  // 1. Meses
  const dropMes = document.getElementById('dropMes');
  if (dropMes) {
    const meses = [
      { val: '01', nombre: 'Enero' }, { val: '02', nombre: 'Febrero' },
      { val: '03', nombre: 'Marzo' }, { val: '04', nombre: 'Abril' },
      { val: '05', nombre: 'Mayo' }, { val: '06', nombre: 'Junio' },
      { val: '07', nombre: 'Julio' }, { val: '08', nombre: 'Agosto' },
      { val: '09', nombre: 'Septiembre' }, { val: '10', nombre: 'Octubre' },
      { val: '11', nombre: 'Noviembre' }, { val: '12', nombre: 'Diciembre' }
    ];
    dropMes.innerHTML = `
      <div class="sticky top-0 bg-white pb-1.5 mb-1 border-b border-gray-100 z-10">
        <input type="text" placeholder="🔍 Buscar mes..." onclick="event.stopPropagation()" oninput="filtrarOpcionesDropdown(this)" class="w-full text-xs p-1.5 border border-gray-200 rounded focus:outline-none focus:border-marca-rojo">
      </div>
      ` + meses.map(m => `
      <label class="option-item flex items-center gap-2 text-xs p-1.5 hover:bg-gray-50 rounded cursor-pointer select-none">
        <input type="checkbox" value="${m.val}" class="chk-mes rounded border-gray-300 text-marca-rojo focus:ring-0" onchange="filtrarYRenderizar()">
        <span>${m.nombre}</span>
      </label>
    `).join('');
  }

  // 2. Activaciones (Servicios)
  const dropServicio = document.getElementById('dropServicio');
  if (dropServicio) {
    const servicios = [...new Set(registros.map(r => r.tipoServicio).filter(Boolean))].sort();
    dropServicio.innerHTML = `
      <div class="sticky top-0 bg-white pb-1.5 mb-1 border-b border-gray-100 z-10">
        <input type="text" placeholder="🔍 Buscar activación..." onclick="event.stopPropagation()" oninput="filtrarOpcionesDropdown(this)" class="w-full text-xs p-1.5 border border-gray-200 rounded focus:outline-none focus:border-marca-rojo">
      </div>
      ` + servicios.map(s => `
      <label class="option-item flex items-center gap-2 text-xs p-1.5 hover:bg-gray-50 rounded cursor-pointer select-none">
        <input type="checkbox" value="${s}" class="chk-servicio rounded border-gray-300 text-marca-rojo focus:ring-0" onchange="filtrarYRenderizar()">
        <span>${s}</span>
      </label>
    `).join('');
  }

  // 3. Áreas
  const dropArea = document.getElementById('dropArea');
  if (dropArea) {
    const areas = [...new Set(registros.map(r => r.area).filter(Boolean))].sort();
    dropArea.innerHTML = `
      <div class="sticky top-0 bg-white pb-1.5 mb-1 border-b border-gray-100 z-10">
        <input type="text" placeholder="🔍 Buscar área..." onclick="event.stopPropagation()" oninput="filtrarOpcionesDropdown(this)" class="w-full text-xs p-1.5 border border-gray-200 rounded focus:outline-none focus:border-marca-rojo">
      </div>
      ` + areas.map(a => `
      <label class="option-item flex items-center gap-2 text-xs p-1.5 hover:bg-gray-50 rounded cursor-pointer select-none">
        <input type="checkbox" value="${a}" class="chk-area rounded border-gray-300 text-marca-rojo focus:ring-0" onchange="filtrarYRenderizar()">
        <span>${a}</span>
      </label>
    `).join('');
  }

  // 4. Estados
  const dropEstado = document.getElementById('dropEstado');
  if (dropEstado) {
    const estados = ['Confirmado', 'Pendiente', 'Culminado', 'Cancelado'];
    dropEstado.innerHTML = `
      <div class="sticky top-0 bg-white pb-1.5 mb-1 border-b border-gray-100 z-10">
        <input type="text" placeholder="🔍 Buscar estado..." onclick="event.stopPropagation()" oninput="filtrarOpcionesDropdown(this)" class="w-full text-xs p-1.5 border border-gray-200 rounded focus:outline-none focus:border-marca-rojo">
      </div>
      ` + estados.map(e => `
      <label class="option-item flex items-center gap-2 text-xs p-1.5 hover:bg-gray-50 rounded cursor-pointer select-none">
        <input type="checkbox" value="${e}" class="chk-estado rounded border-gray-300 text-marca-rojo focus:ring-0" onchange="filtrarYRenderizar()">
        <span>${e}</span>
      </label>
    `).join('');
  }
}

// Leer las casillas marcadas
function obtenerSeleccionados(selector) {
  return Array.from(document.querySelectorAll(`${selector}:checked`)).map(cb => cb.value);
}

// Actualizar texto descriptivo del botón desplegable
function actualizarEtiquetasFiltros(selMeses, selServicios, selAreas, selEstados) {
  document.getElementById('labelMes').innerText = selMeses.length ? `${selMeses.length} seleccionado(s)` : 'Todos los meses';
  document.getElementById('labelServicio').innerText = selServicios.length ? `${selServicios.length} seleccionada(s)` : 'Todas las activaciones';
  document.getElementById('labelArea').innerText = selAreas.length ? `${selAreas.length} seleccionada(s)` : 'Todas las áreas';
  document.getElementById('labelEstado').innerText = selEstados.length ? `${selEstados.length} seleccionado(s)` : 'Todos los estados';
}

// Botón para desmarcar todo, limpiar texto buscado y resetear
function limpiarFiltros() {
  document.querySelectorAll('.chk-mes, .chk-servicio, .chk-area, .chk-estado').forEach(chk => {
    chk.checked = false;
  });
  document.querySelectorAll('.dropdown-container input[type="text"]').forEach(input => {
    input.value = '';
    filtrarOpcionesDropdown(input);
  });
  filtrarYRenderizar();
}

// Filtrar según múltiples selecciones
function filtrarYRenderizar() {
  const selMeses = obtenerSeleccionados('.chk-mes');
  const selServicios = obtenerSeleccionados('.chk-servicio');
  const selAreas = obtenerSeleccionados('.chk-area');
  const selEstados = obtenerSeleccionados('.chk-estado');

  actualizarEtiquetasFiltros(selMeses, selServicios, selAreas, selEstados);

  const filtrados = datosOriginales.filter(r => {
    if (!r.fecha) return false;

    const fechaStr = String(r.fecha).split('T')[0];
    const partesFecha = fechaStr.split('-');
    const mesRegistro = partesFecha[1];

    if (selMeses.length > 0 && !selMeses.includes(mesRegistro)) return false;
    if (selServicios.length > 0 && !selServicios.includes(r.tipoServicio)) return false;
    if (selAreas.length > 0 && !selAreas.includes(r.area)) return false;
    if (selEstados.length > 0 && !selEstados.includes(r.estado)) return false;

    return true;
  });

  // Cálculo del Total Recaudado (S/)
  const totalDinero = filtrados.reduce((acc, r) => {
    if (r.estado === 'Cancelado' || !r.costo) return acc;
    const monto = parseFloat(String(r.costo).replace(/[^0-9.]/g, '')) || 0;
    return acc + monto;
  }, 0);

  // 1. Actualizar Tarjetas de Métricas (KPIs)
  document.getElementById('kpiTotal').innerText = filtrados.length;
  document.getElementById('kpiConfirmados').innerText = filtrados.filter(r => r.estado === 'Confirmado' || !r.estado).length;
  document.getElementById('kpiPendientes').innerText = filtrados.filter(r => r.estado === 'Pendiente').length;
  document.getElementById('kpiCulminados').innerText = filtrados.filter(r => r.estado === 'Culminado').length;
  document.getElementById('kpiCancelados').innerText = filtrados.filter(r => r.estado === 'Cancelado').length;
  
  const elemRecaudado = document.getElementById('kpiRecaudado');
  if (elemRecaudado) {
    elemRecaudado.innerText = `S/ ${totalDinero.toFixed(2)}`;
  }

  // 2. Renderizar los 3 Gráficos
  renderizarGraficoServicios(filtrados);
  renderizarGraficoAreas(filtrados);
  renderizarGraficaDinero(filtrados);
}

/* ==========================================================
   FUNCIONES DE GRÁFICOS
   ========================================================== */

function renderizarGraficoServicios(datos) {
  const ctx = document.getElementById('chartServicios')?.getContext('2d');
  if (!ctx) return;

  const conteo = {};
  datos.forEach(r => {
    const s = r.tipoServicio || 'Sin Especificar';
    conteo[s] = (conteo[s] || 0) + 1;
  });

  if (chartServicios) chartServicios.destroy();

  chartServicios = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        data: Object.values(conteo),
        backgroundColor: ['#E3173E', '#2563EB', '#16A34A', '#F59E0B', '#8B5CF6'],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: '#ffffff',
          font: { weight: 'bold', size: 12 },
          formatter: (val) => val > 0 ? val : ''
        },
        legend: { 
          position: 'bottom',
          labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
        }
      },
      layout: { padding: { bottom: 10, top: 5 } }
    }
  });
}

function renderizarGraficoAreas(datos) {
  const ctx = document.getElementById('chartAreas')?.getContext('2d');
  if (!ctx) return;

  const conteo = {};
  datos.forEach(r => {
    const a = r.area || 'Sin Área';
    conteo[a] = (conteo[a] || 0) + 1;
  });

  if (chartAreas) chartAreas.destroy();

  chartAreas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        label: 'Activaciones',
        data: Object.values(conteo),
        backgroundColor: '#E3173E'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#333333',
          font: { weight: 'bold', size: 11 },
          formatter: (val) => val > 0 ? val : ''
        }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grace: '10%',
          ticks: { precision: 0 } 
        }
      }
    }
  });
}

function renderizarGraficaDinero(registros) {
  const ctx = document.getElementById('graficaDinero')?.getContext('2d');
  if (!ctx) return;

  const ingresosPorMes = {};

  registros.forEach(r => {
    if (!r.costo || r.estado === "Cancelado") return;

    const textoLimpio = String(r.costo).replace(/[^0-9.]/g, '');
    const monto = parseFloat(textoLimpio) || 0;
    const mes = r.fecha ? String(r.fecha).substring(0, 7) : "Sin fecha";

    ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + monto;
  });

  if (chartDinero) chartDinero.destroy();

  chartDinero = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(ingresosPorMes),
      datasets: [{
        label: 'Ahorro (S/)',
        data: Object.values(ingresosPorMes),
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 25
        }
      },
      plugins: {
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#047857',
          font: { weight: 'bold', size: 10 },
          formatter: (val) => val > 0 ? `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''
        },
        tooltip: {
          callbacks: {
            label: (context) => ` Total: S/ ${context.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grace: '20%',
          ticks: { precision: 0 }
        }
      }
    }
  });
}

// Variable global para almacenar los registros con errores
let registrosIncompletos = [];

// Función para auditoría de calidad de datos
function ejecutarAuditoriaCalidad(registros) {
  registrosIncompletos = [];
  
  let req2025 = 0;
  let req2026 = 0;
  let ser2025 = 0;
  let ser2026 = 0;

  registros.forEach((r, idx) => {
    const faltantes = [];

    // Validar campos obligatorios o vacíos
    if (!r.fecha) faltantes.push('Fecha');
    if (!r.tipoServicio) faltantes.push('Tipo Servicio');
    if (!r.area) faltantes.push('Área');
    if (!r.costo && r.costo !== 0) faltantes.push('Costo');
    if (!r.estado) faltantes.push('Estado');

    // Si tiene campos nulos/incompletos
    if (faltantes.length > 0) {
      registrosIncompletos.push({
        numFila: idx + 1,
        data: r,
        faltantes: faltantes
      });

      // Extraer año para la sub-clasificación (o por defecto 2025/2026)
      const fechaStr = r.fecha ? String(r.fecha) : '';
      const anio = fechaStr.includes('2026') ? '2026' : '2025';
      const tipo = String(r.tipoServicio || '').toUpperCase();

      const esServicio = tipo.includes('SER') || tipo.includes('SERVICIO');

      if (esServicio) {
        if (anio === '2026') ser2026++; else ser2025++;
      } else {
        if (anio === '2026') req2026++; else req2025++;
      }
    }
  });

  // Actualizar totales en el Banner
  document.getElementById('lblTotalExcluidos').innerText = registrosIncompletos.length;
  document.getElementById('auditReq2025').innerText = req2025;
  document.getElementById('auditReq2026').innerText = req2026;
  document.getElementById('auditSer2025').innerText = ser2025;
  document.getElementById('auditSer2026').innerText = ser2026;
}

// Abrir el modal y renderizar la tabla con los fallos
function abrirModalAuditoria() {
  const tbody = document.getElementById('tablaAuditBody');
  if (!tbody) return;

  if (registrosIncompletos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center p-6 text-emerald-600 font-bold text-xs">
          ✅ ¡Excelente! No se encontraron registros con campos vacíos o inconsistentes.
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = registrosIncompletos.map(item => {
      const r = item.data;
      const chipsFaltantes = item.faltantes.map(f => 
        `<span class="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200 mr-1">${f}</span>`
      ).join('');

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 font-mono font-bold text-slate-500">#${item.numFila}</td>
          <td class="p-3 ${!r.fecha ? 'text-rose-500 italic' : 'text-slate-700'}">${r.fecha || 'Sin fecha'}</td>
          <td class="p-3 ${!r.tipoServicio ? 'text-rose-500 italic' : 'text-slate-700'}">${r.tipoServicio || 'Sin especificar'}</td>
          <td class="p-3 ${!r.area ? 'text-rose-500 italic' : 'text-slate-700'}">${r.area || 'Sin área'}</td>
          <td class="p-3 ${!r.costo ? 'text-rose-500 italic' : 'text-slate-700'}">${r.costo ? 'S/ ' + r.costo : 'Sin costo'}</td>
          <td class="p-3 ${!r.estado ? 'text-rose-500 italic' : 'text-slate-700'}">${r.estado || 'Sin estado'}</td>
          <td class="p-3">${chipsFaltantes}</td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('modalAuditoria').classList.remove('hidden');
}

// Cerrar el modal
function cerrarModalAuditoria() {
  document.getElementById('modalAuditoria').classList.add('hidden');
}
