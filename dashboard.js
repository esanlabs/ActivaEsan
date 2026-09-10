// Registrar plugin para mostrar siempre las etiquetas en los gráficos
Chart.register(ChartDataLabels);
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoxLf6Au7NsKGunDpDcl_4sUCbZZVZ_vuz5DenBjzw6l4WOCiFH8CvPxGtpEpzNkqy/exec';

// Variables Globales de Estado
let datosOriginales = [];
let registrosModalBase = [];
let registrosModalActuales = [];
let registrosIncompletos = [];
let chartServicios = null;
let chartAreas = null;
let chartDinero = null;

document.addEventListener('DOMContentLoaded', () => {
  if (verificarAcceso()) {
    cargarDatosDashboard();
  }
});

// Valida que solo el SuperAdmin pueda ingresar
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

// === CARGA DE DATOS CON CACHÉ (10 MINUTOS) Y VALIDACIÓN ROBUSTA DE JSON ===
async function cargarDatosDashboard(forceRefresh = false) {
  const loader = document.getElementById('loaderDashboard');
  const cacheData = localStorage.getItem('dashboard_cache');
  const cacheTime = localStorage.getItem('dashboard_cache_time');
  const DIEZ_MINUTOS = 10 * 60 * 1000;

  if (!forceRefresh && cacheData && cacheTime && (Date.now() - cacheTime < DIEZ_MINUTOS)) {
    try {
      datosOriginales = JSON.parse(cacheData);
      ejecutarAuditoriaCalidad(datosOriginales);
      poblarFiltros(datosOriginales);
      filtrarYRenderizar();
      if (loader) loader.classList.add('hidden');
      return;
    } catch (e) {
      console.warn("Caché corrupto, recargando desde servidor...");
      localStorage.removeItem('dashboard_cache');
    }
  }

  if (loader) loader.classList.remove('hidden');
  
  // Busca estas líneas dentro de async function cargarDatosDashboard(forceRefresh = false)
  
  if (loader) loader.classList.remove('hidden');
  
  try {
    // 🟢 Construimos la URL agregando refresh=true y el timestamp si forceRefresh es true
    const urlFinal = forceRefresh 
      ? `${GOOGLE_SCRIPT_URL}?refresh=true&t=${Date.now()}` 
      : GOOGLE_SCRIPT_URL;
  
    const respuesta = await fetch(urlFinal, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!respuesta.ok) {
      throw new Error(`Error HTTP en el servidor: ${respuesta.status} ${respuesta.statusText}`);
    }

    const textoRespuesta = await respuesta.text();

    // Validar si la respuesta devuelta es HTML en lugar de JSON (bloqueo de Google Apps Script)
    if (textoRespuesta.trim().startsWith('<') || textoRespuesta.trim().toLowerCase().startsWith('<!doctype')) {
      throw new Error("El script de Google devolvió una página HTML en lugar de datos JSON. Verifica en Google Apps Script que 'Quién tiene acceso' esté configurado como 'Cualquier persona' (Anyone).");
    }

    const resData = JSON.parse(textoRespuesta);

    if (resData.status === 'error') {
      throw new Error(resData.error || resData.errorDetallado || 'Error desconocido en Apps Script');
    }

    datosOriginales = resData.registros || [];
    localStorage.setItem('dashboard_cache', JSON.stringify(datosOriginales));
    localStorage.setItem('dashboard_cache_time', Date.now().toString());

    ejecutarAuditoriaCalidad(datosOriginales);
    poblarFiltros(datosOriginales);
    filtrarYRenderizar();

  } catch (error) {
    console.error("Error al cargar datos del dashboard:", error);
    alert(`Error de acceso/carga: ${error.message}`);
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

/* ==========================================================
   LÓGICA DE FILTROS Y BÚSQUEDA GLOBAL
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

// Inserción de la X individual justo al lado de la flecha en cada selector
function actualizarEtiquetasFiltros(selMeses, selServicios, selAreas, selEstados) {
  actualizarSelectorUI('labelMes', '.chk-mes', 'mes', selMeses.length, 'Todos los meses');
  actualizarSelectorUI('labelServicio', '.chk-servicio', 'servicio', selServicios.length, 'Todas las activaciones');
  actualizarSelectorUI('labelArea', '.chk-area', 'area', selAreas.length, 'Todas las áreas');
  actualizarSelectorUI('labelEstado', '.chk-estado', 'estado', selEstados.length, 'Todos los estados');
}

function actualizarSelectorUI(idLabel, selectorChk, tipo, cantidad, textoDefault) {
  const labelEl = document.getElementById(idLabel);
  if (!labelEl) return;

  labelEl.innerText = cantidad ? `${cantidad} seleccionado(s)` : textoDefault;

  let btnClear = labelEl.parentElement.querySelector(`.btn-clear-${tipo}`);

  if (cantidad > 0) {
    if (!btnClear) {
      btnClear = document.createElement('span');
      btnClear.className = `btn-clear-${tipo} ml-auto mr-1 text-slate-400 hover:text-rose-600 font-bold text-xs cursor-pointer px-1 py-0.5 rounded hover:bg-rose-100 transition-colors inline-flex items-center justify-center z-10`;
      btnClear.innerText = '✕';
      btnClear.title = 'Limpiar este filtro';
      btnClear.onclick = (e) => {
        e.stopPropagation();
        limpiarFiltroCategoria(selectorChk);
      };
      labelEl.insertAdjacentElement('afterend', btnClear);
    }
    btnClear.classList.remove('hidden');
  } else if (btnClear) {
    btnClear.classList.add('hidden');
  }
}

function limpiarFiltroCategoria(selectorChk) {
  document.querySelectorAll(selectorChk).forEach(chk => chk.checked = false);
  filtrarYRenderizar();
}

function limpiarFiltros() {
  document.querySelectorAll('.chk-mes, .chk-servicio, .chk-area, .chk-estado').forEach(chk => chk.checked = false);
  document.querySelectorAll('.dropdown-container input[type="text"]').forEach(input => {
    input.value = '';
    filtrarOpcionesDropdown(input);
  });
  limpiarBuscadorGlobal();
}

function limpiarBuscadorGlobal() {
  const input = document.getElementById('inputBusquedaGlobal');
  const btn = document.getElementById('btnLimpiarBusqueda');
  if (input) input.value = '';
  if (btn) btn.classList.add('hidden');
  filtrarYRenderizar();
}

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

    if (selMeses.length > 0 && !selMeses.includes(mesRegistro)) return false;
    if (selServicios.length > 0 && !selServicios.includes(r.tipoServicio)) return false;
    if (selAreas.length > 0 && !selAreas.includes(r.area)) return false;
    if (selEstados.length > 0 && !selEstados.includes(r.estado)) return false;

    if (textoBusqueda !== '') {
      const id = String(r.id || r.codigo || r.codigoSolicitud || '').toLowerCase();
      const servicio = String(r.tipoServicio || '').toLowerCase();
      const area = String(r.area || '').toLowerCase();
      const estado = String(r.estado || '').toLowerCase();
      const costo = String(r.costo || '').toLowerCase();
      const evento = String(obtenerNombreEvento(r)).toLowerCase();

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

function filtrarYRenderizar() {
  const selMeses = obtenerSeleccionados('.chk-mes');
  const selServicios = obtenerSeleccionados('.chk-servicio');
  const selAreas = obtenerSeleccionados('.chk-area');
  const selEstados = obtenerSeleccionados('.chk-estado');

  actualizarEtiquetasFiltros(selMeses, selServicios, selAreas, selEstados);

  const filtrados = obtenerDatosFiltradosActuales();

  const totalDinero = filtrados.reduce((acc, r) => {
    if (r.estado === 'Cancelado' || !r.costo) return acc;
    const monto = parseFloat(String(r.costo).replace(/[^0-9.]/g, '')) || 0;
    return acc + monto;
  }, 0);

  document.getElementById('kpiTotal').innerText = filtrados.length;
  document.getElementById('kpiConfirmados').innerText = filtrados.filter(r => r.estado === 'Confirmado' || !r.estado).length;
  document.getElementById('kpiPendientes').innerText = filtrados.filter(r => r.estado === 'Pendiente').length;
  document.getElementById('kpiCulminados').innerText = filtrados.filter(r => r.estado === 'Culminado').length;
  document.getElementById('kpiCancelados').innerText = filtrados.filter(r => r.estado === 'Cancelado').length;

  const elemRecaudado = document.getElementById('kpiRecaudado');
  if (elemRecaudado) elemRecaudado.innerText = `S/ ${totalDinero.toFixed(2)}`;

  renderizarGraficoServicios(filtrados);
  renderizarGraficoAreas(filtrados);
  renderizarGraficaDinero(filtrados);
}

/* ==========================================================
   GRÁFICOS CHART.JS
   ========================================================== */

function renderizarGraficoServicios(datos) {
  const ctx = document.getElementById('chartServicios')?.getContext('2d');
  if (!ctx) return;

  const conteo = {};
  datos.forEach(r => {
    const s = r.tipoServicio || 'Sin Especificar';
    conteo[s] = (conteo[s] || 0) + 1;
  });

  const mapaColores = {
    'foto gif': '#E3173E',
    'foto gif impresión': '#E3173E',
    'foto booth': '#2563EB',
    '360°': '#16A34A',
    'cancelado': '#000000'
  };
  const coloresFallback = ['#E3173E', '#2563EB', '#16A34A', '#F59E0B', '#8B5CF6'];

  const etiquetas = Object.keys(conteo);
  const coloresAsignados = etiquetas.map((label, idx) => {
    const key = label.toLowerCase().trim();
    return mapaColores[key] || coloresFallback[idx % coloresFallback.length];
  });

  if (chartServicios) chartServicios.destroy();

  chartServicios = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: etiquetas,
      datasets: [{
        data: Object.values(conteo),
        backgroundColor: coloresAsignados,
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
          const filtrados = obtenerDatosFiltradosActuales().filter(r => (r.tipoServicio || 'Sin Especificar') === etiqueta);
          abrirDetalleGrafico(`Activación: ${etiqueta}`, filtrados);
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
      scales: { y: { beginAtZero: true, grace: '25%' } },
      plugins: {
        datalabels: {
          anchor: 'end', align: 'end', color: '#1F2937', font: { weight: 'bold', size: 11 },
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
          const filtrados = obtenerDatosFiltradosActuales().filter(r => (r.area || 'Sin Área') === etiqueta);
          abrirDetalleGrafico(`Área: ${etiqueta}`, filtrados);
        }
      }
    }
  });
}

function renderizarGraficaDinero(registros) {
  const ctx = document.getElementById('graficaDinero')?.getContext('2d');
  if (!ctx) return;

  const primerRegistro = registros.find(r => r.fecha);
  const anio = primerRegistro ? String(primerRegistro.fecha).substring(0, 4) : '2026';

  const ingresosPorMes = {};
  for (let m = 1; m <= 12; m++) {
    const mesNum = m < 10 ? `0${m}` : `${m}`;
    ingresosPorMes[`${anio}-${mesNum}`] = 0;
  }

  registros.forEach(r => {
    if (!r.costo || r.estado === "Cancelado" || !r.fecha) return;
    const monto = parseFloat(String(r.costo).replace(/[^0-9.]/g, '')) || 0;
    const mesKey = String(r.fecha).substring(0, 7);

    if (ingresosPorMes.hasOwnProperty(mesKey)) {
      ingresosPorMes[mesKey] += monto;
    } else {
      ingresosPorMes[mesKey] = monto;
    }
  });

  const labelsOrdenadas = Object.keys(ingresosPorMes).sort();
  const valoresOrdenados = labelsOrdenadas.map(k => ingresosPorMes[k]);

  if (chartDinero) chartDinero.destroy();

  chartDinero = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labelsOrdenadas,
      datasets: [{
        label: 'Ahorro (S/)',
        data: valoresOrdenados,
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, grace: '18%' } },
      plugins: {
        datalabels: {
          anchor: 'end', align: 'end', color: '#065F46', font: { weight: 'bold', size: 10 },
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
          const filtrados = obtenerDatosFiltradosActuales().filter(r => {
            const m = r.fecha ? String(r.fecha).substring(0, 7) : "Sin fecha";
            return m === etiqueta && r.costo && r.estado !== 'Cancelado';
          });
          abrirDetalleGrafico(`Mes: ${etiqueta}`, filtrados);
        }
      }
    }
  });
}

/* ==========================================================
   AUDITORÍA DE DATOS
   ========================================================== */

function ejecutarAuditoriaCalidad(registros) {
  registrosIncompletos = [];
  let sinFecha = 0, sinCorreo = 0, sinArea = 0, sinSolicitante = 0;

  registros.forEach((r, idx) => {
    const faltantes = [];

    // Normalización de llaves considerando posibles variaciones entre las 3 activaciones
    const fecha = r.fecha ? String(r.fecha).trim() : '';
    const correo = (r.correoSolicitante || r.correo || r.email) ? String(r.correoSolicitante || r.correo || r.email).trim() : '';
    const area = r.area ? String(r.area).trim() : '';
    const solicitante = (r.solicita || r.nombreCliente || r.solicitante) ? String(r.solicita || r.nombreCliente || r.solicitante).trim() : '';

    // Evaluación de campos nulos / incompletos
    if (!fecha) { faltantes.push('Fecha'); sinFecha++; }
    if (!correo) { faltantes.push('Correo'); sinCorreo++; }
    if (!area) { faltantes.push('Área'); sinArea++; }
    if (!solicitante) { faltantes.push('Solicitante'); sinSolicitante++; }

    // Si le falta al menos un campo obligatorio, entra en la lista de excluidos
    if (faltantes.length > 0) {
      registrosIncompletos.push({
        numFila: idx + 1,
        data: { ...r, _correoNorm: correo, _solicitanteNorm: solicitante },
        faltantes: faltantes
      });
    }
  });

  // Actualización de contadores en el Banner superior
  document.getElementById('lblTotalExcluidos').innerText = registrosIncompletos.length;
  if (document.getElementById('auditSinFecha')) document.getElementById('auditSinFecha').innerText = sinFecha;
  if (document.getElementById('auditSinCorreo')) document.getElementById('auditSinCorreo').innerText = sinCorreo;
  if (document.getElementById('auditSinArea')) document.getElementById('auditSinArea').innerText = sinArea;
  if (document.getElementById('auditSinSolicitante')) document.getElementById('auditSinSolicitante').innerText = sinSolicitante;
}

function abrirModalAuditoria() {
  const tbody = document.getElementById('tablaAuditBody');
  if (!tbody) return;

  if (registrosIncompletos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-emerald-600 font-bold text-xs">✅ No se encontraron registros con campos vacíos.</td></tr>`;
  } else {
    tbody.innerHTML = registrosIncompletos.map(item => {
      const r = item.data;
      const chips = item.faltantes.map(f => `<span class="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200 mr-1 inline-block my-0.5">${f}</span>`).join('');

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3 font-mono font-bold text-slate-500">#${item.numFila}</td>
          <td class="p-3 ${!r.fecha ? 'text-rose-500 italic font-medium' : 'text-slate-700'}">${r.fecha || 'Sin fecha'}</td>
          <td class="p-3 ${!r._correoNorm ? 'text-rose-500 italic font-medium' : 'text-slate-700'}">${r._correoNorm || 'Sin correo'}</td>
          <td class="p-3 ${!r.area ? 'text-rose-500 italic font-medium' : 'text-slate-700'}">${r.area || 'Sin área'}</td>
          <td class="p-3 ${!r._solicitanteNorm ? 'text-rose-500 italic font-medium' : 'text-slate-700'}">${r._solicitanteNorm || 'Sin solicitante'}</td>
          <td class="p-3">${chips}</td>
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
   MODAL DE REGISTROS Y BÚSQUEDA INTERNA
   ========================================================== */

function obtenerNombreEvento(r) {
  return r.tipoEvento || r.tipo_evento || r['Tipo de evento'] || r['tipo de evento'] || r.nombreEvento || r.evento || r.nombre_proyecto || r.tipo_edicion || r.solicitante || '-';
}

function getBadgeColor(estado) {
  switch (String(estado).toLowerCase()) {
    case 'confirmado': return 'bg-emerald-100 text-emerald-800 font-semibold';
    case 'culminado': return 'bg-blue-100 text-blue-800 font-semibold';
    case 'pendiente': return 'bg-amber-100 text-amber-800 font-semibold';
    case 'cancelado': return 'bg-rose-100 text-rose-800 font-semibold';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function abrirDetalleGrafico(titulo, registros) {
  registrosModalBase = [...registros];
  registrosModalActuales = [...registros];

  const modal = document.getElementById('modalDetalleGrafico');
  const tituloEl = document.getElementById('modalTituloGrafico');
  const inputEl = document.getElementById('inputBusquedaModal');

  if (tituloEl) tituloEl.innerText = titulo;
  if (inputEl) inputEl.value = '';

  renderizarTablaModal(registrosModalActuales);
  if (modal) modal.classList.remove('hidden');
}

function filtrarTablaModal() {
  const inputEl = document.getElementById('inputBusquedaModal');
  const texto = inputEl ? inputEl.value.toLowerCase().trim() : '';

  if (texto === '') {
    registrosModalActuales = [...registrosModalBase];
  } else {
    registrosModalActuales = registrosModalBase.filter(r => {
      const id = String(r.id || r.codigo || r.codigoSolicitud || '').toLowerCase();
      const fecha = String(r.fecha || '').toLowerCase();
      const evento = String(obtenerNombreEvento(r)).toLowerCase();
      const servicio = String(r.tipoServicio || '').toLowerCase();
      const area = String(r.area || '').toLowerCase();
      const estado = String(r.estado || '').toLowerCase();
      const costo = String(r.costo || '').toLowerCase();

      return id.includes(texto) || fecha.includes(texto) || evento.includes(texto) || servicio.includes(texto) || area.includes(texto) || estado.includes(texto) || costo.includes(texto);
    });
  }

  renderizarTablaModal(registrosModalActuales);
}

function renderizarTablaModal(lista) {
  const tbody = document.getElementById('tbodyModalGrafico');
  const contadorEl = document.getElementById('modalDetalleContador');

  if (contadorEl) contadorEl.innerText = `Total: ${lista.length} registro(s)`;
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400 italic">No se encontraron registros.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((r, idx) => {
    const id = r.id || r.codigo || r.codigoSolicitud || `#${idx + 1}`;
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const evento = obtenerNombreEvento(r);
    const servicio = r.tipoServicio || '-';
    const area = r.area || '-';
    const estado = r.estado || 'Pendiente';
    const costo = parseFloat(String(r.costo || 0).replace(/[^0-9.]/g, '')) || 0;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors border-b border-gray-100">
        <td class="p-2.5 font-bold text-slate-700">${id}</td>
        <td class="p-2.5 text-gray-600">${fecha}</td>
        <td class="p-2.5 font-medium text-slate-800">${evento}</td>
        <td class="p-2.5 font-medium text-slate-900">${servicio}</td>
        <td class="p-2.5 text-gray-600">${area}</td>
        <td class="p-2.5 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] ${getBadgeColor(estado)}">${estado}</span>
        </td>
        <td class="p-2.5 text-right font-bold text-slate-800">
          S/ ${costo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    `;
  }).join('');
}

function verRegistrosGrafico(tipoGrafico) {
  const datosFiltrados = obtenerDatosFiltradosActuales();
  let registrosFinales = [];
  let tituloModal = '';

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

  abrirDetalleGrafico(tituloModal, registrosFinales);
}

function cerrarModalGrafico() {
  const modal = document.getElementById('modalDetalleGrafico');
  if (modal) modal.classList.add('hidden');
}

/* ==========================================================
   EXPORTACIONES (PDF Y EXCEL)
   ========================================================== */

async function exportarTablaPDF() {
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
    const totalRegistros = registros.length;
    const totalMonto = registros.reduce((acc, r) => {
      if (r.estado === 'Cancelado' || !r.costo) return acc;
      const monto = parseFloat(String(r.costo).replace(/[^0-9.]/g, '')) || 0;
      return acc + monto;
    }, 0);

    const fechaActual = new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const contenedor = document.createElement('div');
    contenedor.style.padding = '25px 30px';
    contenedor.style.fontFamily = "'Helvetica Neue', Arial, sans-serif";
    contenedor.style.color = '#1e293b';
    contenedor.style.backgroundColor = '#ffffff';

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
          <td style="padding: 7px 10px; font-size: 10px; text-align: center;">${estado}</td>
          <td style="padding: 7px 10px; font-size: 10px; text-align: right; font-weight: bold; color: #0f172a;">
            S/ ${costo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    }).join('');

    contenedor.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #E3173E; padding-bottom: 12px; margin-bottom: 18px;">
        <div>
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">REPORTE DE ACTIVACIONES Y SERVICIOS</h1>
          <p style="margin: 3px 0 0 0; font-size: 10px; color: #64748b;">Consolidado de Registros del Dashboard</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 9px; color: #64748b;"><strong>Fecha de Emisión:</strong> ${fechaActual}</p>
        </div>
      </div>

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

      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 8px 10px; font-size: 9px; text-transform: uppercase;">ID / CÓDIGO</th>
            <th style="padding: 8px 10px; font-size: 9px; text-transform: uppercase;">FECHA</th>
            <th style="padding: 8px 10px; font-size: 9px; text-transform: uppercase;">ACTIVACIÓN</th>
            <th style="padding: 8px 10px; font-size: 9px; text-transform: uppercase;">ÁREA</th>
            <th style="padding: 8px 10px; font-size: 9px; text-transform: uppercase; text-align: center;">ESTADO</th>
            <th style="padding: 8px 10px; font-size: 9px; text-transform: uppercase; text-align: right;">COSTO (S/)</th>
          </tr>
        </thead>
        <tbody>${filasHTML}</tbody>
      </table>
    `;

    document.body.appendChild(contenedor);

    const opciones = {
      margin: [0.3, 0.3, 0.4, 0.3],
      filename: `Reporte_Tabla_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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

function exportarDetalleExcel() {
  if (!registrosModalActuales || registrosModalActuales.length === 0) {
    alert("No hay registros en la tabla para exportar.");
    return;
  }

  let csvContent = '\uFEFF'; 
  csvContent += 'ID / Codigo;Fecha;Evento / Proyecto;Tipo Servicio;Area;Estado;Costo (S/)\n';

  registrosModalActuales.forEach((r, idx) => {
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const costo = parseFloat(String(r.costo || 0).replace(/[^0-9.]/g, '')) || 0;
    
    const valorId = r.id || r.codigo || r.codigoSolicitud || `#${idx + 1}`;
    const id = String(valorId).replace(/"/g, '""');
    const evento = String(obtenerNombreEvento(r)).replace(/"/g, '""');
    const servicio = String(r.tipoServicio || '-').replace(/"/g, '""');
    const area = String(r.area || '-').replace(/"/g, '""');
    const estado = String(r.estado || 'Pendiente').replace(/"/g, '""');

    csvContent += `"${id}";"${fecha}";"${evento}";"${servicio}";"${area}";"${estado}";"${costo.toFixed(2)}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  
  enlace.setAttribute('href', url);
  enlace.setAttribute('download', `Detalle_Grafico_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
}

// === TEMPORIZADOR DE INACTIVIDAD (20 MINUTOS) ===
let inactividadTimer;
function reiniciarTimerInactividad() {
  clearTimeout(inactividadTimer);
  inactividadTimer = setTimeout(() => {
    sessionStorage.clear();
    localStorage.removeItem('dashboard_cache');
    alert("Sesión cerrada automáticamente por inactividad.");
    window.location.href = 'index.html';
  }, 20 * 60 * 1000);
}

['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
  document.addEventListener(evt, reiniciarTimerInactividad);
});

/* ==========================================================
   EXPORTACIÓN DE GRÁFICOS A PDF (SIN DISTORSIÓN DE ASPECT RATIO)
   ========================================================== */

async function exportarGraficosPDF() {
  const chartServiciosCanvas = document.getElementById('chartServicios');
  const chartAreasCanvas = document.getElementById('chartAreas');
  const graficaDineroCanvas = document.getElementById('graficaDinero');

  if (!chartServiciosCanvas || !chartAreasCanvas || !graficaDineroCanvas) {
    alert("No se encontraron los elementos canvas de los gráficos.");
    return;
  }

  const loader = document.getElementById('loaderDashboard');
  if (loader) loader.classList.remove('hidden');

  try {
    const jsPDF = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
    if (!jsPDF) throw new Error("La librería jsPDF no está disponible.");

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();  // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 12;
    const contentWidth = pageWidth - (margin * 2); // 186mm

    // --- ENCABEZADO CORPORATIVO ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("REPORTE VISUAL DE GRÁFICOS Y MÉTRICAS", margin, 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    const fechaActual = new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Emitido: ${fechaActual}`, pageWidth - margin - 45, 13);

    let currentY = 26;

    // Helper para obtener imagen en PNG con fondo blanco y calcular su relación de aspecto
    const getCanvasImage = (canvas) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      ctx.drawImage(canvas, 0, 0);
      return {
        dataUrl: tempCanvas.toDataURL('image/png', 1.0),
        aspectRatio: canvas.width / canvas.height
      };
    };

    // Helper para renderizar la imagen centrada sin deformar las proporciones
    const drawAspectFitImage = (imgObj, boxX, boxY, maxW, maxH) => {
      let renderW = maxW;
      let renderH = maxW / imgObj.aspectRatio;

      if (renderH > maxH) {
        renderH = maxH;
        renderW = maxH * imgObj.aspectRatio;
      }

      const offsetX = boxX + (maxW - renderW) / 2;
      const offsetY = boxY + (maxH - renderH) / 2;

      doc.addImage(imgObj.dataUrl, 'PNG', offsetX, offsetY, renderW, renderH);
    };

    const imgServicios = getCanvasImage(chartServiciosCanvas);
    const imgAreas = getCanvasImage(chartAreasCanvas);
    const imgDinero = getCanvasImage(graficaDineroCanvas);

    // --- FILA 1: DOUGHNUT Y ÁREAS (Lado a lado) ---
    const gap = 6;
    const halfWidth = (contentWidth - gap) / 2; // ~90mm
    const boxHeight1 = 85;

    // Tarjeta 1: Servicios (Fondo blanco y borde claro)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, currentY, halfWidth, boxHeight1, 3, 3, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text("DISTRIBUCIÓN POR ACTIVACIONES", margin + 4, currentY + 7);

    drawAspectFitImage(imgServicios, margin + 3, currentY + 10, halfWidth - 6, boxHeight1 - 14);

    // Tarjeta 2: Áreas
    const xPos2 = margin + halfWidth + gap;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(xPos2, currentY, halfWidth, boxHeight1, 3, 3, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text("ACTIVACIONES POR ÁREA", xPos2 + 4, currentY + 7);

    drawAspectFitImage(imgAreas, xPos2 + 3, currentY + 10, halfWidth - 6, boxHeight1 - 14);

    currentY += boxHeight1 + 8;

    // --- FILA 2: AHORRO POR MES (Ancho Completo) ---
    const boxHeight2 = 115;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, currentY, contentWidth, boxHeight2, 3, 3, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text("AHORRO POR MES (S/)", margin + 5, currentY + 7);

    drawAspectFitImage(imgDinero, margin + 4, currentY + 10, contentWidth - 8, boxHeight2 - 14);

    // --- PIE DE PÁGINA ---
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Reporte generado automáticamente respetando los filtros activos del Dashboard.", margin, pageHeight - 8);

    doc.save(`Reporte_Graficos_${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error) {
    console.error("Error al exportar gráficos a PDF:", error);
    alert("Ocurrió un error al generar el PDF de gráficos: " + error.message);
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

// Abrir y cerrar el panel de auditoría
function togglePanelAuditoria() {
  const panel = document.getElementById('panelAuditoria');
  if (panel) {
    panel.classList.toggle('hidden');
  }
}

// Actualizar los datos verticales y cambiar el color del indicador (Verde / Naranja)
function actualizarMetricasAuditoria(sinFecha = 0, sinCorreo = 0, sinArea = 0, sinSolicitante = 0) {
  const total = sinFecha + sinCorreo + sinArea + sinSolicitante;

  const elFecha = document.getElementById('auditSinFecha');
  const elCorreo = document.getElementById('auditSinCorreo');
  const elArea = document.getElementById('auditSinArea');
  const elSolicitante = document.getElementById('auditSinSolicitante');
  const elTotal = document.getElementById('auditTotalExcluidos');
  const dot = document.getElementById('dotAuditoria');

  if (elFecha) elFecha.textContent = sinFecha;
  if (elCorreo) elCorreo.textContent = sinCorreo;
  if (elArea) elArea.textContent = sinArea;
  if (elSolicitante) elSolicitante.textContent = sinSolicitante;
  if (elTotal) elTotal.textContent = total;

  // Cambiar el color del círculo según el estado
  if (dot) {
    if (total > 0) {
      dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"; // Anaranjado (Hay errores)
    } else {
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"; // Verde (Todo OK)
    }
  }
}

function toggleTablaAuditoria() {
  // Pon aquí entre comillas el ID exacto que ya tiene el contenedor de tu tabla
  const tabla = document.getElementById('TU_ID_DE_TABLA_AQUI');
  const btn = document.getElementById('btnToggleTablaAuditoria');

  if (tabla) {
    tabla.classList.toggle('hidden');
    if (btn) {
      btn.textContent = tabla.classList.contains('hidden') 
        ? "📋 Mostrar Tabla de Excluidos" 
        : "👁️ Ocultar Tabla de Excluidos";
    }
  }
}
