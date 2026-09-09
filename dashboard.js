// Registrar plugin para mostrar siempre las etiquetas en los gráficos
Chart.register(ChartDataLabels);
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoxLf6Au7NsKGunDpDcl_4sUCbZZVZ_vuz5DenBjzw6l4WOCiFH8CvPxGtpEpzNkqy/exec';

// Variables Globales de Estado
let datosOriginales = [];
let registrosModalActuales = []; // Movida al inicio
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

    // Ejecutar la auditoría de calidad sobre los registros cargados
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

function toggleDropdown(event, id) {
  event.stopPropagation();
  const target = document.getElementById(id);
  const estaOculto = target.classList.contains('hidden');

  document.querySelectorAll('.dropdown-container > div').forEach(div => div.classList.add('hidden'));

  if (estaOculto) {
    target.classList.remove('hidden');
    const inputBuscar = target.querySelector('input[type="text"]');
    if (inputBuscar) inputBuscar.focus();
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-container')) {
    document.querySelectorAll('.dropdown-container > div').forEach(div => div.classList.add('hidden'));
  }
});

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

function obtenerSeleccionados(selector) {
  return Array.from(document.querySelectorAll(`${selector}:checked`)).map(cb => cb.value);
}

function actualizarEtiquetasFiltros(selMeses, selServicios, selAreas, selEstados) {
  document.getElementById('labelMes').innerText = selMeses.length ? `${selMeses.length} seleccionado(s)` : 'Todos los meses';
  document.getElementById('labelServicio').innerText = selServicios.length ? `${selServicios.length} seleccionada(s)` : 'Todas las activaciones';
  document.getElementById('labelArea').innerText = selAreas.length ? `${selAreas.length} seleccionada(s)` : 'Todas las áreas';
  document.getElementById('labelEstado').innerText = selEstados.length ? `${selEstados.length} seleccionado(s)` : 'Todos los estados';
}

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

function obtenerDatosFiltradosActuales() {
  const selMeses = obtenerSeleccionados('.chk-mes');
  const selServicios = obtenerSeleccionados('.chk-servicio');
  const selAreas = obtenerSeleccionados('.chk-area');
  const selEstados = obtenerSeleccionados('.chk-estado');

  return datosOriginales.filter(r => {
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
}

function filtrarYRenderizar() {
  const selMeses = obtenerSeleccionados('.chk-mes');
  const selServicios = obtenerSeleccionados('.chk-servicio');
  const selAreas = obtenerSeleccionados('.chk-area');
  const selEstados = obtenerSeleccionados('.chk-estado');

  actualizarEtiquetasFiltros(selMeses, selServicios, selAreas, selEstados);

  const filtrados = obtenerDatosFiltradosActuales();

  // Total Recaudado (S/)
  const totalDinero = filtrados.reduce((acc, r) => {
    if (r.estado === 'Cancelado' || !r.costo) return acc;
    const monto = parseFloat(String(r.costo).replace(/[^0-9.]/g, '')) || 0;
    return acc + monto;
  }, 0);

  // 1. Actualizar KPIs
  document.getElementById('kpiTotal').innerText = filtrados.length;
  document.getElementById('kpiConfirmados').innerText = filtrados.filter(r => r.estado === 'Confirmado' || !r.estado).length;
  document.getElementById('kpiPendientes').innerText = filtrados.filter(r => r.estado === 'Pendiente').length;
  document.getElementById('kpiCulminados').innerText = filtrados.filter(r => r.estado === 'Culminado').length;
  document.getElementById('kpiCancelados').innerText = filtrados.filter(r => r.estado === 'Cancelado').length;
  
  const elemRecaudado = document.getElementById('kpiRecaudado');
  if (elemRecaudado) {
    elemRecaudado.innerText = `S/ ${totalDinero.toFixed(2)}`;
  }

  // 2. Renderizar Gráficos
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
          color: '#FFFFFF',
          font: { weight: 'bold', size: 12 },
          formatter: (val) => (val > 0 ? val : '')
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (event, activeElements, chart) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const etiqueta = chart.data.labels[index];
          abrirDetalleGrafico('servicio', etiqueta);
        }
      }
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
      layout: { padding: { top: 20 } },
      scales: {
        y: { beginAtZero: true, grace: '25%' }
      },
      plugins: {
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#1F2937',
          font: { weight: 'bold', size: 11 },
          formatter: (val) => (val > 0 ? val : '')
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (event, activeElements, chart) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const etiqueta = chart.data.labels[index];
          abrirDetalleGrafico('area', etiqueta);
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
      scales: {
        y: { beginAtZero: true, grace: '18%' }
      },
      plugins: {
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#065F46',
          font: { weight: 'bold', size: 10 },
          formatter: (val) => (val > 0 ? `S/ ${Math.round(val).toLocaleString('es-PE')}` : '')
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      },
      onClick: (event, activeElements, chart) => {
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          const etiqueta = chart.data.labels[index];
          abrirDetalleGrafico('mes', etiqueta);
        }
      }
    }
  });
}

/* ==========================================================
   AUDITORÍA DE DATOS
   ========================================================== */

let registrosIncompletos = [];

function ejecutarAuditoriaCalidad(registros) {
  registrosIncompletos = [];
  
  let req2025 = 0, req2026 = 0, ser2025 = 0, ser2026 = 0;

  registros.forEach((r, idx) => {
    const faltantes = [];

    if (!r.fecha) faltantes.push('Fecha');
    if (!r.tipoServicio) faltantes.push('Tipo Servicio');
    if (!r.area) faltantes.push('Área');
    if (!r.costo && r.costo !== 0) faltantes.push('Costo');
    if (!r.estado) faltantes.push('Estado');

    if (faltantes.length > 0) {
      registrosIncompletos.push({
        numFila: idx + 1,
        data: r,
        faltantes: faltantes
      });

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

  document.getElementById('lblTotalExcluidos').innerText = registrosIncompletos.length;
  document.getElementById('auditReq2025').innerText = req2025;
  document.getElementById('auditReq2026').innerText = req2026;
  document.getElementById('auditSer2025').innerText = ser2025;
  document.getElementById('auditSer2026').innerText = ser2026;
}

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

function cerrarModalAuditoria() {
  document.getElementById('modalAuditoria').classList.add('hidden');
}

/* ==========================================================
   MODAL DE DETALLE AL HACER CLIC EN GRÁFICOS
   ========================================================== */

function abrirDetalleGrafico(tipoFiltro, valorEtiqueta) {
  // 1. Obtener registros que cumplen con los checkboxes actuales
  const datosFiltrados = obtenerDatosFiltradosActuales(); 

  // 2. Filtrar adicionalmente según la barra/porción clickeada
  const registrosFinales = datosFiltrados.filter(item => {
    if (tipoFiltro === 'servicio') return item.tipoServicio === valorEtiqueta;
    if (tipoFiltro === 'area') return item.area === valorEtiqueta;
    if (tipoFiltro === 'mes') {
      const fechaStr = item.fecha ? String(item.fecha) : '';
      return fechaStr.includes(valorEtiqueta);
    }
    return true;
  });

  // Guardar en la variable global para exportación a Excel (CORREGIDO)
  registrosModalActuales = registrosFinales;

  // 3. Inyectar datos en la tabla del modal
  const tbody = document.getElementById('tablaDetalleBody');
  tbody.innerHTML = '';

  if (registrosFinales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">No se encontraron registros para esta selección.</td></tr>`;
  } else {
    registrosFinales.forEach((row, idx) => {
      const fechaCorta = row.fecha ? String(row.fecha).split('T')[0] : '-';
      const costoNum = parseFloat(String(row.costo || 0).replace(/[^0-9.]/g, '')) || 0;

      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="p-3 font-semibold text-gray-700">${row.id || row.codigo || `#${idx + 1}`}</td>
          <td class="p-3 text-gray-600">${fechaCorta}</td>
          <td class="p-3 font-medium text-gray-800">${row.tipoServicio || '-'}</td>
          <td class="p-3 text-gray-600">${row.area || '-'}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeColor(row.estado)}">
              ${row.estado || 'Pendiente'}
            </span>
          </td>
          <td class="p-3 text-right font-bold text-gray-800">S/ ${costoNum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });
  }

  // 4. Actualizar títulos y contador
  document.getElementById('modalDetalleTitulo').innerText = `Detalle: ${valorEtiqueta}`;
  document.getElementById('modalDetalleContador').innerText = `Total: ${registrosFinales.length} registro(s)`;

  // 5. Abrir Modal
  document.getElementById('modalDetalleGrafico').classList.remove('hidden');
}

function cerrarModalDetalle() {
  document.getElementById('modalDetalleGrafico').classList.add('hidden');
}

function getBadgeColor(estado) {
  switch (String(estado).toLowerCase()) {
    case 'confirmado': return 'bg-emerald-100 text-emerald-800';
    case 'culminado': return 'bg-blue-100 text-blue-800';
    case 'pendiente': return 'bg-amber-100 text-amber-800';
    case 'cancelado': return 'bg-rose-100 text-rose-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

/* ==========================================================
   VER TODOS LOS REGISTROS DE UN GRÁFICO ESPECÍFICO
   ========================================================== */

function verRegistrosGrafico(tipoGrafico) {
  // 1. Obtener los registros filtrados globalmente por los checkboxes superiores
  const datosFiltrados = obtenerDatosFiltradosActuales();
  let registrosFinales = [];
  let tituloModal = '';

  // 2. Determinar la data según el gráfico seleccionado
  if (tipoGrafico === 'servicios') {
    registrosFinales = datosFiltrados;
    tituloModal = 'Todos los Registros - Tipos de Servicio';
  } else if (tipoGrafico === 'areas') {
    registrosFinales = datosFiltrados;
    tituloModal = 'Todos los Registros - Activaciones por Área';
  } else if (tipoGrafico === 'dinero') {
    registrosFinales = datosFiltrados.filter(r => r.costo && r.estado !== 'Cancelado');
    tituloModal = 'Todos los Registros - Ahorro / Montos';
  }

  // Guardar en la variable global para exportación a Excel (CORREGIDO)
  registrosModalActuales = registrosFinales;

  // 3. Renderizar la tabla en el modal de detalle existente
  const tbody = document.getElementById('tablaDetalleBody');
  tbody.innerHTML = '';

  if (registrosFinales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">No hay registros con los filtros actuales.</td></tr>`;
  } else {
    registrosFinales.forEach((row, idx) => {
      const fechaCorta = row.fecha ? String(row.fecha).split('T')[0] : '-';
      const costoNum = parseFloat(String(row.costo || 0).replace(/[^0-9.]/g, '')) || 0;

      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="p-3 font-semibold text-gray-700">${row.id || row.codigo || `#${idx + 1}`}</td>
          <td class="p-3 text-gray-600">${fechaCorta}</td>
          <td class="p-3 font-medium text-gray-800">${row.tipoServicio || '-'}</td>
          <td class="p-3 text-gray-600">${row.area || '-'}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeColor(row.estado)}">
              ${row.estado || 'Pendiente'}
            </span>
          </td>
          <td class="p-3 text-right font-bold text-gray-800">S/ ${costoNum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });
  }

  // 4. Actualizar cabecera del modal y mostrar
  document.getElementById('modalDetalleTitulo').innerText = tituloModal;
  document.getElementById('modalDetalleContador').innerText = `Total: ${registrosFinales.length} registro(s)`;
  document.getElementById('modalDetalleGrafico').classList.remove('hidden');
}

/* ==========================================================
   EXPORTACIONES (CORREGIDAS)
   ========================================================== */

// EXPORTAR TABLA DE DATOS A PDF (DISEÑO EJECUTIVO Y FORMAL) 
async function exportarTablaPDF() {
  // Toma los registros del modal si está abierto, o la lista filtrada actual
  const registros = (registrosModalActuales && registrosModalActuales.length > 0)
    ? registrosModalActuales
    : obtenerDatosFiltradosActuales();

  if (!registros || registros.length === 0) {
    alert("No hay registros disponibles para exportar.");
    return;
  }

  const loader = document.getElementById('loaderDashboard');
  if (loader) loader.classList.remove('hidden');

  try {
    // Cálculo de acumulados para la cabecera
    const totalRegistros = registros.length;
    const totalMonto = registros.reduce((acc, r) => {
      if (r.estado === 'Cancelado' || !r.costo) return acc;
      const monto = parseFloat(String(r.costo).replace(/[^0-9.]/g, '')) || 0;
      return acc + monto;
    }, 0);

    const fechaActual = new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Helper para badges de estado dentro de la tabla
    const getBadgeStyle = (estado) => {
      switch (String(estado).toLowerCase()) {
        case 'confirmado': return 'background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;';
        case 'culminado': return 'background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;';
        case 'pendiente': return 'background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a;';
        case 'cancelado': return 'background-color: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3;';
        default: return 'background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;';
      }
    };

    // 1. Crear documento HTML invisible con estilos ejecutivos
    const contenedor = document.createElement('div');
    contenedor.style.padding = '25px 30px';
    contenedor.style.fontFamily = "'Helvetica Neue', Arial, sans-serif";
    contenedor.style.color = '#1e293b';
    contenedor.style.backgroundColor = '#ffffff';

    // Construcción de filas
    const filasHTML = registros.map((r, idx) => {
      const id = r.id || r.codigo || r.codigoSolicitud || `#${idx + 1}`;
      const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
      const servicio = r.tipoServicio || '-';
      const area = r.area || '-';
      const estado = r.estado || 'Pendiente';
      const costo = parseFloat(String(r.costo || 0).replace(/[^0-9.]/g, '')) || 0;
      const bgFila = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background-color: ${bgFila}; border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 7px 10px; font-size: 10px; font-weight: bold; color: #475569;">${id}</td>
          <td style="padding: 7px 10px; font-size: 10px; color: #334155;">${fecha}</td>
          <td style="padding: 7px 10px; font-size: 10px; font-weight: 600; color: #0f172a;">${servicio}</td>
          <td style="padding: 7px 10px; font-size: 10px; color: #334155;">${area}</td>
          <td style="padding: 7px 10px; font-size: 10px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; ${getBadgeStyle(estado)}">
              ${estado}
            </span>
          </td>
          <td style="padding: 7px 10px; font-size: 10px; text-align: right; font-weight: bold; color: #0f172a;">
            S/ ${costo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    }).join('');

    // Estructura completa del PDF
    contenedor.innerHTML = `
      <!-- Encabezado Corporativo -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #E3173E; padding-bottom: 12px; margin-bottom: 18px;">
        <div>
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">REPORTE DE ACTIVACIONES Y SERVICIOS</h1>
          <p style="margin: 3px 0 0 0; font-size: 10px; color: #64748b;">Consolidado de Registros del Dashboard</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 9px; color: #64748b;"><strong>Fecha de Emisión:</strong> ${fechaActual}</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #64748b;"><strong>Estado:</strong> Documento Oficial</p>
        </div>
      </div>

      <!-- Tarjetas de Resumen Ejecutivo -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
        <tr>
          <td style="width: 50%; padding-right: 8px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
              <span style="font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; display: block;">Total Solicitudes</span>
              <span style="font-size: 15px; font-weight: bold; color: #0f172a;">${totalRegistros} registros</span>
            </div>
          </td>
          <td style="width: 50%; padding-left: 8px;">
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px;">
              <span style="font-size: 9px; color: #166534; text-transform: uppercase; font-weight: bold; display: block;">Monto Total Consolidado</span>
              <span style="font-size: 15px; font-weight: bold; color: #15803d;">S/ ${totalMonto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Tabla Principal -->
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 8px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase; border-top-left-radius: 4px;">ID / CÓDIGO</th>
            <th style="padding: 8px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase;">FECHA</th>
            <th style="padding: 8px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase;">ACTIVACIÓN</th>
            <th style="padding: 8px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase;">ÁREA</th>
            <th style="padding: 8px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase; text-align: center;">ESTADO</th>
            <th style="padding: 8px 10px; font-size: 9px; font-weight: bold; text-transform: uppercase; text-align: right; border-top-right-radius: 4px;">COSTO (S/)</th>
          </tr>
        </thead>
        <tbody>
          ${filasHTML}
        </tbody>
      </table>

      <!-- Pie de página -->
      <div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8;">
        <span>Sistema de Gestión de Activaciones - Uso Confidencial</span>
        <span>Generado automáticamente</span>
      </div>
    `;

    document.body.appendChild(contenedor);

    // 2. Configurar la salida a PDF (Vertical A4)
    const opciones = {
      margin:       [0.3, 0.3, 0.4, 0.3],
      filename:     `Reporte_Tabla_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opciones).from(contenedor).save();
    document.body.removeChild(contenedor);

  } catch (error) {
    console.error("Error al exportar PDF de la tabla:", error);
    alert("Hubo un error al generar el PDF de la tabla.");
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

// 2. EXPORTAR A EXCEL (CSV con UTF-8 BOM)
function exportarDetalleExcel() {
  if (!registrosModalActuales || registrosModalActuales.length === 0) {
    alert("No hay registros en la tabla para exportar.");
    return;
  }

  let csvContent = '\uFEFF'; 
  csvContent += 'ID / Codigo;Fecha;Tipo Servicio;Area;Estado;Costo (S/)\n';

  registrosModalActuales.forEach((r, idx) => {
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const costo = parseFloat(String(r.costo || 0).replace(/[^0-9.]/g, '')) || 0;
    
    // CORRECCIÓN: Se busca cualquier campo de ID posible o se asigna el número correlativo (#1, #2...)
    const valorId = r.id || r.codigo || r.codigoSolicitud || r.idRegistro || `#${idx + 1}`;
    const id = String(valorId).replace(/"/g, '""');
    const servicio = String(r.tipoServicio || '-').replace(/"/g, '""');
    const area = String(r.area || '-').replace(/"/g, '""');
    const estado = String(r.estado || 'Pendiente').replace(/"/g, '""');

    csvContent += `"${id}";"${fecha}";"${servicio}";"${area}";"${estado}";"${costo.toFixed(2)}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  
  enlace.setAttribute('href', url);
  enlace.setAttribute('download', `Detalle_Registros_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
}

/* ==========================================================
   LÓGICA DE FILTRADO CON BUSCADOR GLOBAL (DETECCIÓN DE EVENTO)
   ========================================================== */

function obtenerDatosFiltradosActuales() {
  const selMeses = obtenerSeleccionados('.chk-mes');
  const selServicios = obtenerSeleccionados('.chk-servicio');
  const selAreas = obtenerSeleccionados('.chk-area');
  const selEstados = obtenerSeleccionados('.chk-estado');
  
  const inputBusqueda = document.getElementById('inputBusquedaGlobal');
  const textoBusqueda = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';

  const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
  if (btnLimpiar) {
    if (textoBusqueda.length > 0) btnLimpiar.classList.remove('hidden');
    else btnLimpiar.classList.add('hidden');
  }

  return datosOriginales.filter(r => {
    if (!r.fecha) return false;

    const fechaStr = String(r.fecha).split('T')[0];
    const partesFecha = fechaStr.split('-');
    const mesRegistro = partesFecha[1];

    // 1. Filtros Multi-selección
    if (selMeses.length > 0 && !selMeses.includes(mesRegistro)) return false;
    if (selServicios.length > 0 && !selServicios.includes(r.tipoServicio)) return false;
    if (selAreas.length > 0 && !selAreas.includes(r.area)) return false;
    if (selEstados.length > 0 && !selEstados.includes(r.estado)) return false;

    // 2. Filtro por coincidencia de texto (Buscador Global + Evento / Tipo de Evento)
    if (textoBusqueda !== '') {
      const id = String(r.id || r.codigo || r.codigoSolicitud || '').toLowerCase();
      const servicio = String(r.tipoServicio || '').toLowerCase();
      const area = String(r.area || '').toLowerCase();
      const estado = String(r.estado || '').toLowerCase();
      const costo = String(r.costo || '').toLowerCase();
      
      // Mapeo exhaustivo para "Tipo de evento", "Nombre del Proyecto" y variantes
      const evento = String(
        r.tipoEvento || 
        r.tipo_evento || 
        r['Tipo de evento'] || 
        r['tipo de evento'] || 
        r.nombreEvento || 
        r.evento || 
        r.nombre_proyecto || 
        r.tipo_edicion || 
        r.solicitante || 
        ''
      ).toLowerCase();

      const coincide = id.includes(textoBusqueda) ||
                       servicio.includes(textoBusqueda) ||
                       area.includes(textoBusqueda) ||
                       estado.includes(textoBusqueda) ||
                       fechaStr.includes(textoBusqueda) ||
                       costo.includes(textoBusqueda) ||
                       evento.includes(textoBusqueda);

      if (!coincide) return false;
    }

    return true;
  });
}
