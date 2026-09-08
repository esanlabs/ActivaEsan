const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoxLf6Au7NsKGunDpDcl_4sUCbZZVZ_vuz5DenBjzw6l4WOCiFH8CvPxGtpEpzNkqy/exec';

let datosOriginales = [];
let chartServicios = null;
let chartAreas = null;
let chartDinero = null; // Instancia para la gráfica de dinero

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

    // Llenar dinámicamente los selectores de Filtros
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

function poblarFiltros(registros) {
  // Poblar Áreas dinámicamente según lo registrado en el Excel
  const selectArea = document.getElementById('fArea');
  if (selectArea) {
    const areas = [...new Set(registros.map(r => r.area).filter(Boolean))].sort();
    selectArea.innerHTML = '<option value="TODOS">Todas las áreas</option>' +
      areas.map(a => `<option value="${a}">${a}</option>`).join('');
  }

  // Poblar Servicios dinámicamente
  const selectServicio = document.getElementById('fServicio');
  if (selectServicio) {
    const servicios = [...new Set(registros.map(r => r.tipoServicio).filter(Boolean))].sort();
    selectServicio.innerHTML = '<option value="TODOS">Todas las activaciones</option>' +
      servicios.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

function filtrarYRenderizar() {
  const mes = document.getElementById('fMes')?.value || 'TODOS';
  const servicio = document.getElementById('fServicio')?.value || 'TODOS';
  const area = document.getElementById('fArea')?.value || 'TODOS';
  const estado = document.getElementById('fEstado')?.value || 'TODOS';

  const filtrados = datosOriginales.filter(r => {
    if (!r.fecha) return false;

    // Extraer mes (formato YYYY-MM-DD o ISO)
    const fechaStr = String(r.fecha).split('T')[0];
    const partesFecha = fechaStr.split('-');
    const mesRegistro = partesFecha[1]; // "01", "02", etc.

    if (mes !== 'TODOS' && mesRegistro !== mes) return false;
    if (servicio !== 'TODOS' && r.tipoServicio !== servicio) return false;
    if (area !== 'TODOS' && r.area !== area) return false;
    if (estado !== 'TODOS' && r.estado !== estado) return false;

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
        legend: { 
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 12,
            font: { size: 11 }
          }
        }
      },
      layout: {
        padding: {
          bottom: 10,
          top: 5
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
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
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
        label: 'Ingresos (S/)',
        data: Object.values(ingresosPorMes),
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => ` Total: S/ ${context.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}
