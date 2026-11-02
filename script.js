'use strict';
let currentUser = null, registrosCargados = [], listaAdmins = [], catalogo = [], configRecursos = {}, calendarObj = null;
let idEventoEditando = null, registroEditando = null, contadorFilas = 0, datosPendientesGuardar = [], requestId = null;
let catalogoBorrador = [], revisionBorrador = 0, guardando = false;
const $ = id => document.getElementById(id), esc = ApiActivaciones.escapar;
const formato = n => new Intl.DateTimeFormat('es-PE', {dateStyle:'short', timeStyle:'short', hourCycle:'h23', timeZone:'America/Lima'}).format(new Date(n));
const hoyLima = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Lima', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function mostrarToast(mensaje, tipo = 'exito') {
  const t = document.createElement('div'); t.className = 'toast ' + (tipo === 'error' ? 'toast-error' : ''); t.role = 'status';
  t.textContent = mensaje; $('toastContainer').append(t); setTimeout(() => t.remove(), 7000);
}
function limpiarCacheLocal() { localStorage.removeItem('dashboard_cache'); localStorage.removeItem('dashboard_cache_time'); }
function cerrarSesion() { sessionStorage.removeItem('currentUser'); sessionStorage.removeItem('activaciones_id_token'); limpiarCacheLocal(); location.href = 'index.html'; }
window.handleCredentialResponse = async function (r) {
  sessionStorage.setItem('activaciones_id_token', r.credential);
  try { await cargarDatosDesdeGoogle(); } catch (e) { $('loginError').textContent = e.message; $('loginError').classList.remove('hidden'); }
};
async function cargarDatosDesdeGoogle() {
  $('loader').classList.remove('hidden');
  try {
    const data = await ApiActivaciones.llamar('read');
    currentUser = data.user; registrosCargados = data.registros; listaAdmins = data.admins;
    catalogo = data.catalogo; configRecursos = data.config;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser)); limpiarCacheLocal();
    $('loginScreen').classList.add('hidden'); $('mainHeader').classList.remove('hidden'); $('mainContent').classList.remove('hidden');
    $('userNombre').textContent = currentUser.name; $('badgeRol').textContent = currentUser.role === 'SUPERADMIN' ? 'Administración' : 'Solicitante';
    ['btnGestionAdmins','btnExcel','btnDashboard','btnCatalogo'].forEach(id => $(id).classList.toggle('hidden', currentUser.role !== 'SUPERADMIN'));
    $('calendarContainer').classList.remove('hidden');
    actualizarCatalogoUI(); inicializarCalendario();
  } finally { $('loader').classList.add('hidden'); }
}
function actualizarCatalogoUI() {
  const valor = $('filtroServicio').value;
  $('filtroServicio').innerHTML = '<option value="TODOS">Todas las activaciones</option>' + catalogo.map(s => `<option value="${esc(s.id)}">${esc(s.nombre)}${s.activo ? '' : ' · inactivo'}</option>`).join('');
  if ([...$('filtroServicio').options].some(o => o.value === valor)) $('filtroServicio').value = valor;
  $('leyendaServicios').innerHTML = catalogo.filter(s => s.activo).map(s => `<span class="legend-item"><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('');
  $('resumenRecursos').textContent = `${configRecursos.tabletsTotal} tablets · ${configRecursos.impresorasTotal} impresoras · Hora de Lima`;
  $('avisoConfiguracion').classList.toggle('hidden', configRecursos.revisado);
  $('btnNuevaActivacion').disabled = !configRecursos.revisado;
  $('catalogoServicios').innerHTML = catalogo.filter(s => s.activo).map(s => {
    const enlace = ApiActivaciones.enlace(s.sustentoUrl);
    return `<article class="service-card" style="--service-color:${s.color}"><div class="card-heading"><i class="service-dot"></i><h3>${esc(s.nombre)}</h3></div><p>${esc(s.descripcion || 'Sin descripción.')}</p><div class="service-meta">${s.tablets} tablet(s) por activación${s.permiteImpresora ? ' · Impresión opcional' : ''}</div>${enlace ? `<a href="${esc(enlace)}" target="_blank" rel="noopener noreferrer">Ver sustento ↗</a>` : '<span class="muted">Sustento pendiente</span>'}</article>`;
  }).join('');
}
function eventosCalendario() {
  const query = $('buscadorTexto').value.toLowerCase().trim(), area = $('filtroArea').value, servicio = $('filtroServicio').value;
  return registrosCargados.filter(r => {
    const s = Reservas.servicio(r, catalogo);
    return (servicio === 'TODOS' || s?.id === servicio) && (area === 'TODAS' || r.area === area) &&
      (!query || [r.tipoEvento,r.solicita,r.tipoServicio].some(t => String(t || '').toLowerCase().includes(query)));
  }).map(r => {
    const s = Reservas.servicio(r, catalogo), legacy = !r.horaInicio || !r.horaFin;
    return {id: String(r.numEvento), title: `${r.tipoEvento} · ${s?.nombre || r.tipoServicio}${Reservas.imprime(r) ? ' + impresión' : ''} · ${r.estado}`,
      start: r.fecha + (legacy ? '' : 'T' + r.horaInicio + ':00-05:00'),
      end: legacy ? Reservas.sumarDias(r.fecha, r.diasServicio || 1) : (r.fechaFin || r.fecha) + 'T' + r.horaFin + ':00-05:00',
      allDay: legacy, backgroundColor: s?.color || '#64748B', borderColor: s?.color || '#64748B', textColor: contraste(s?.color || '#64748B'),
      classNames: r.estado === 'Cancelado' ? ['evento-cancelado'] : [], extendedProps: {...r}};
  });
}
function contraste(hex) {
  const h = hex.replace('#',''), rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16));
  return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 160 ? '#152033' : '#FFFFFF';
}
function inicializarCalendario() {
  const fecha = calendarObj?.getDate(), vista = calendarObj?.view.type;
  if (calendarObj) calendarObj.destroy();
  calendarObj = new FullCalendar.Calendar($('calendar'), {
    initialView: vista || 'dayGridMonth', initialDate: fecha || hoyLima(), locale:'es', timeZone:'UTC', now: () => new Date(Date.now()-5*3600000), height:'auto', displayEventTime: true, eventDisplay:'block', dayMaxEvents:3,
    // Enviar fechas de presentación locales; el motor valida siempre con UTC-05:00.
    events: eventosCalendario().map(e => ({...e,start: typeof e.start === 'string' ? e.start.replace('-05:00','Z') : e.start,end: typeof e.end === 'string' ? e.end.replace('-05:00','Z') : e.end})),
    headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listWeek'},
    buttonText:{today:'Hoy',month:'Mes',week:'Semana',list:'Agenda'},
    eventTimeFormat:{hour:'2-digit',minute:'2-digit',hour12:false},
    dateClick: i => abrirModalNuevo(i.dateStr.slice(0,10)),
    eventClick: i => { if (!i.event.extendedProps.ocupado) editarRegistro(i.event.extendedProps); },
    eventDidMount: info => {
      const r = info.event.extendedProps;
      info.el.title = `${r.tipoEvento} · ${r.tipoServicio}\n${r.estado}${!r.horaInicio ? '\nReserva antigua sin horario: ocupa días completos.' : ''}`;
    }
  });
  calendarObj.render();
}
function aplicarFiltros() { inicializarCalendario(); }
async function actualizarCalendario() { try { await cargarDatosDesdeGoogle(); mostrarToast('Datos actualizados.'); } catch(e) { mostrarToast(e.message,'error'); } }
function abrirModal() { $('modalOverlay').classList.remove('hidden','opacity-0'); $('modalBox').classList.remove('scale-95'); $('modalBox').focus(); }
function cerrarModal() { if (!guardando) { $('modalOverlay').classList.add('hidden'); registroEditando = null; idEventoEditando = null; } }
function abrirModalNuevo(fecha = '') {
  if (!configRecursos.revisado) return mostrarToast('Administración debe revisar primero los recursos y servicios.','error');
  registroEditando = null; idEventoEditando = null; contadorFilas = 0;
  $('formActivacion').reset(); $('contenedorBloques').replaceChildren();
  $('solicita').value = currentUser.name; $('contenedorEdicion').classList.add('hidden'); $('btnCancelar').classList.add('hidden');
  $('modalTitulo').textContent = 'Nueva solicitud'; $('btnGuardar').textContent = 'Revisar solicitud';
  agregarFilaActivacion(fecha || hoyLima()); toggleUnificarCostos(); abrirModal();
}
function editarRegistro(r) {
  registroEditando = r; idEventoEditando = r.numEvento; contadorFilas = 0;
  $('formActivacion').reset(); $('contenedorBloques').replaceChildren();
  $('modalTitulo').textContent = `Reserva #${r.numEvento}`; $('btnGuardar').textContent = 'Revisar cambios';
  $('solicita').value = r.solicita; $('area').value = r.area; $('costos').value = r.centroCostos; $('observaciones').value = r.observaciones;
  $('contenedorEdicion').classList.toggle('hidden', currentUser.role !== 'SUPERADMIN');
  $('btnCancelar').classList.toggle('hidden', r.estado === 'Cancelado');
  $('tablet').value = r.tablet || ''; $('fotos').value = r.cantFotos ?? ''; $('link').value = r.link || '';
  agregarFilaActivacion(r.fecha, r); toggleUnificarCostos(); abrirModal();
}
function agregarFilaActivacion(fecha = '', r = null) {
  const i = contadorFilas++, s = r ? Reservas.servicio(r,catalogo) : null, div = document.createElement('section');
  div.id = `fila_${i}`; div.className = 'fila-activacion'; div.dataset.original = r ? 'true' : '';
  const servicios = catalogo.filter(c => c.activo || c.id === s?.id);
  div.innerHTML = `<div class="row-heading"><strong>Activación <span class="numero-fila"></span></strong>${r ? '<span class="muted">Registro existente</span>' : `<button type="button" class="text-action" onclick="eliminarFila(${i})">Quitar</button>`}</div>
  ${r && !r.horaInicio ? '<p class="inline-warning">Reserva antigua sin horario. Al guardar, indica inicio y fin; se comprobará la disponibilidad nuevamente.</p>' : ''}
  <div class="fields-grid"><label class="span-2">Nombre del evento<input id="nombreEvento_${i}" maxlength="200" required value="${esc(r?.tipoEvento || '')}"></label>
  <label>Activación<select id="servicio_${i}" onchange="toggleImpresora(${i})" required><option value="">Seleccionar servicio</option>${servicios.map(c => `<option value="${esc(c.id)}" ${c.id === s?.id ? 'selected' : ''}>${esc(c.nombre)}${c.activo ? '' : ' · inactivo'}</option>`).join('')}</select></label>
  <label>Fecha de inicio<input type="date" id="fechaEvento_${i}" required value="${esc(fecha)}" onchange="cambiarFecha(${i})"></label>
  <label>Hora de inicio<input type="time" id="horaInicio_${i}" required value="${esc(r?.horaInicio || '')}" onchange="validarDisponibilidad()"></label>
  <label>Fecha de fin<input type="date" id="fechaFin_${i}" required value="${esc(r?.fechaFin || (r ? Reservas.sumarDias(fecha,(r.diasServicio || 1)-1) : fecha))}" onchange="validarDisponibilidad()"></label>
  <label>Hora de fin<input type="time" id="horaFin_${i}" required value="${esc(r?.horaFin || '')}" onchange="validarDisponibilidad()"></label></div>
  <div id="divImpresora_${i}" class="print-option ${s?.permiteImpresora ? '' : 'hidden'}"><label><input type="checkbox" id="checkImpresora_${i}" ${r && Reservas.imprime(r) ? 'checked' : ''} onchange="validarDisponibilidad()"> Incluir impresora · el margen bloquea el pack completo</label></div>
  <p id="resumen_${i}" class="resource-preview" aria-live="polite"></p>
  <div id="divCostosUnitario_${i}" class="fields-grid"><label>Centro de costos<input id="costos_${i}" value="${esc(r?.centroCostos || '')}"></label><label class="span-2">Observaciones<textarea id="observaciones_${i}" maxlength="4000">${esc(r?.observaciones || '')}</textarea></label></div>`;
  $('contenedorBloques').append(div); renumerar(); toggleUnificarCostos(); validarDisponibilidad();
}
function renumerar() { document.querySelectorAll('.numero-fila').forEach((e,i) => e.textContent = i+1); }
function eliminarFila(i) { $(`fila_${i}`)?.remove(); renumerar(); validarDisponibilidad(); }
function cambiarFecha(i) { const inicio = $(`fechaEvento_${i}`).value, fin = $(`fechaFin_${i}`); if (!fin.value || fin.value < inicio) fin.value = inicio; validarDisponibilidad(); }
function toggleImpresora(i) {
  const s = catalogo.find(s => s.id === $(`servicio_${i}`).value);
  $(`divImpresora_${i}`).classList.toggle('hidden', !s?.permiteImpresora);
  if (!s?.permiteImpresora) $(`checkImpresora_${i}`).checked = false;
  validarDisponibilidad();
}
function toggleUnificarCostos() {
  const unificar = $('chkUnificarCostos').checked;
  $('costos').disabled = $('observaciones').disabled = !unificar;
  document.querySelectorAll('[id^="divCostosUnitario_"]').forEach(d => {
    d.classList.toggle('hidden', unificar); d.querySelectorAll('input,textarea').forEach(e => e.disabled = unificar);
  });
}
function leerFilas() {
  return [...$('contenedorBloques').children].map(fila => {
    const i = fila.id.split('_')[1], s = catalogo.find(s => s.id === $(`servicio_${i}`).value), original = fila.dataset.original ? registroEditando : null;
    if (!s) throw new Error('Selecciona el servicio de cada activación.');
    const imp = $(`checkImpresora_${i}`).checked, fecha = $(`fechaEvento_${i}`).value, fechaFin = $(`fechaFin_${i}`).value;
    const horaInicio = $(`horaInicio_${i}`).value, horaFin = $(`horaFin_${i}`).value;
    const mismo = original && original.horaInicio && (Reservas.servicio(original,catalogo)||{}).id === s.id && Reservas.imprime(original) === imp && original.fecha === fecha && (original.fechaFin || original.fecha) === fechaFin && original.horaInicio === horaInicio && original.horaFin === horaFin;
    return {numEvento: original?.numEvento ?? null, version: original?.version ?? 0, tipoEvento:$(`nombreEvento_${i}`).value.trim(), area:$('area').value,
      solicita:original?.solicita || currentUser.name, correoSolicitante:original?.correoSolicitante || currentUser.email,
      servicioId:s.id, tipoServicio:s.id === 'fotogift' ? (imp ? 'Foto Gif Impresión' : 'Foto Gif Virtual') : s.nombre,
      conImpresora:imp, fecha, fechaFin, horaInicio, horaFin, estado:original?.estado === 'Cancelado' ? 'Cancelado' : 'Pendiente',
      tabletsReservadas: mismo && original.tabletsReservadas != null ? original.tabletsReservadas : s.tablets,
      margenAntes:imp ? (mismo && original.margenAntes != null ? original.margenAntes : configRecursos.margenAntes) : 0,
      margenDespues:imp ? (mismo && original.margenDespues != null ? original.margenDespues : configRecursos.margenDespues) : 0,
      centroCostos:$('chkUnificarCostos').checked ? $('costos').value : $(`costos_${i}`).value,
      observaciones:$('chkUnificarCostos').checked ? $('observaciones').value : $(`observaciones_${i}`).value,
      tablet:original ? $('tablet').value : '', cantFotos:original ? $('fotos').value : '', link:original ? $('link').value : ''};
  });
}
function validarDisponibilidad() {
  try {
    const items = leerFilas();
    items.forEach((r,idx) => {
      const t = Reservas.tramo(r,catalogo,configRecursos), i = $('contenedorBloques').children[idx].id.split('_')[1];
      $(`resumen_${i}`).textContent = `${t.tablets} tablet(s)${t.impresoras ? ' + 1 impresora' : ''} · Ocupación: ${formato(t.inicio)} → ${formato(t.fin)}${r.estado === 'Cancelado' ? ' · Cancelada: no ocupa equipos' : ''}`;
    });
    Reservas.validarLote(registrosCargados,items,catalogo,configRecursos);
    $('avisoDisponibilidad').textContent = items.length ? 'Horario disponible según la última sincronización. Se verificará nuevamente al guardar.' : 'Añade al menos una activación.';
    $('avisoDisponibilidad').className = 'availability'; return true;
  } catch(e) { $('avisoDisponibilidad').textContent = e.message; $('avisoDisponibilidad').className = 'availability availability-warning'; return false; }
}
$('formActivacion').addEventListener('submit', e => {
  e.preventDefault(); if (!validarDisponibilidad()) return;
  datosPendientesGuardar = leerFilas(); if (!datosPendientesGuardar.length) return;
  requestId = crypto.randomUUID();
  $('listaConfirmacion').innerHTML = datosPendientesGuardar.map(r => {
    const t = Reservas.tramo(r,catalogo,configRecursos);
    return `<article class="confirm-card"><strong>${esc(r.tipoEvento)}</strong><p>${esc(r.tipoServicio)}</p><p>Evento: ${esc(r.fecha)} ${esc(r.horaInicio)} → ${esc(r.fechaFin)} ${esc(r.horaFin)}</p><p>${t.tablets} tablet(s)${t.impresoras ? ' + 1 impresora' : ''}</p><p>Equipos ocupados: ${esc(formato(t.inicio))} → ${esc(formato(t.fin))}</p></article>`;
  }).join('');
  $('modalConfirmacion').classList.remove('hidden','opacity-0'); $('modalConfirmacionBox').classList.remove('scale-95');
  $('btnConfirmarGuardado').textContent = 'Confirmar reserva'; $('btnConfirmarGuardado').disabled = false;
});
function cerrarModalConfirmacion() { if (!guardando) $('modalConfirmacion').classList.add('hidden'); }
$('btnConfirmarGuardado').addEventListener('click', async () => {
  if (guardando) return; guardando = true; const btn = $('btnConfirmarGuardado'); btn.disabled = true; btn.textContent = 'Guardando…';
  let exito = false;
  try {
    const r = await ApiActivaciones.llamar(idEventoEditando ? 'update' : 'create_multiple',{items:datosPendientesGuardar,requestId});
    exito = true; $('modalConfirmacion').classList.add('hidden'); $('modalOverlay').classList.add('hidden');
    mostrarToast(r.alertaCorreo || 'Reserva guardada.');
    try { await cargarDatosDesdeGoogle(); } catch(e) { mostrarToast('Se guardó, pero no se pudo actualizar la vista: ' + e.message,'error'); }
  } catch(e) { mostrarToast(e.message,'error'); }
  finally { guardando = false; btn.disabled = false; btn.textContent = exito ? 'Confirmar reserva' : 'Reintentar'; }
});
async function cancelarRegistro() {
  if (!registroEditando || !confirm('¿Cancelar esta reserva y liberar sus equipos?')) return;
  const btn = $('btnCancelar'); btn.disabled = true;
  try { await ApiActivaciones.llamar('cancel',{numEvento:idEventoEditando,version:registroEditando.version}); cerrarModal(); await cargarDatosDesdeGoogle(); mostrarToast('Reserva cancelada.'); }
  catch(e) { mostrarToast(e.message,'error'); } finally { btn.disabled = false; }
}
function abrirModalAdmins() { renderizarAdmins(); $('modalAdminsOverlay').classList.remove('hidden'); }
function cerrarModalAdmins() { $('modalAdminsOverlay').classList.add('hidden'); }
function renderizarAdmins() {
  $('listaAdmins').replaceChildren();
  listaAdmins.forEach(email => { const li = document.createElement('li'); li.className = 'admin-row'; li.textContent = email;
    if (email !== 'mtello@esan.edu.pe') { const b = document.createElement('button'); b.type='button'; b.textContent='Eliminar'; b.className='text-action'; b.onclick=() => eliminarAdmin(email); li.append(b); } $('listaAdmins').append(li); });
}
async function agregarAdmin() { await modificarAdmin('add_admin',$('nuevoAdminEmail').value.trim().toLowerCase()); }
async function eliminarAdmin(email) { if (confirm('¿Quitar permisos a ' + email + '?')) await modificarAdmin('remove_admin',email); }
async function modificarAdmin(action,email) { try { await ApiActivaciones.llamar(action,{email}); await cargarDatosDesdeGoogle(); renderizarAdmins(); $('nuevoAdminEmail').value=''; } catch(e) { mostrarToast(e.message,'error'); } }
function abrirCatalogo() {
  catalogoBorrador = JSON.parse(JSON.stringify(catalogo)); revisionBorrador = configRecursos.revision;
  ['tabletsTotal','impresorasTotal','margenAntes','margenDespues'].forEach(k => $('cfg_'+k).value = configRecursos[k]);
  renderizarEditorCatalogo(); $('modalCatalogo').classList.remove('hidden');
}
function cerrarCatalogo() { $('modalCatalogo').classList.add('hidden'); }
function recogerEditor() {
  document.querySelectorAll('[data-editor-servicio]').forEach(f => {
    const s = catalogoBorrador.find(s => s.id === f.dataset.editorServicio);
    ['nombre','descripcion','color','tablets','costo','sustentoUrl'].forEach(k => s[k] = f.querySelector(`[data-campo="${k}"]`).value);
    s.activo = f.querySelector('[data-campo="activo"]').checked; s.permiteImpresora = f.querySelector('[data-campo="permiteImpresora"]').checked;
  });
}
function renderizarEditorCatalogo() {
  $('editorCatalogo').innerHTML = catalogoBorrador.map(s => `<fieldset data-editor-servicio="${esc(s.id)}" class="catalog-editor"><legend>${esc(s.nombre)}</legend><div class="fields-grid">
    <label class="span-2">Nombre<input data-campo="nombre" value="${esc(s.nombre)}" maxlength="100" required></label><label>Color<input type="color" data-campo="color" value="${esc(s.color)}" required></label>
    <label class="span-3">Descripción<textarea data-campo="descripcion" maxlength="2000">${esc(s.descripcion)}</textarea></label>
    <label>Tablets por activación<input type="number" data-campo="tablets" min="1" max="10000" step="1" value="${s.tablets}" required></label>
    <label>Valor referencial (S/)<input type="number" data-campo="costo" min="0" step="0.01" max="10000000" value="${s.costo}" required></label>
    <label class="span-3">Enlace de sustento<input type="url" data-campo="sustentoUrl" value="${esc(s.sustentoUrl)}" placeholder="https://…"></label></div>
    <div class="checkbox-row"><label><input type="checkbox" data-campo="activo" ${s.activo ? 'checked' : ''}> Disponible para nuevas reservas</label><label><input type="checkbox" data-campo="permiteImpresora" ${s.permiteImpresora ? 'checked' : ''}> Ofrece impresión opcional</label></div><small class="muted">ID permanente: ${esc(s.id)}. Para retirarlo, desactívalo; su historial se conserva.</small></fieldset>`).join('');
}
function nuevoServicio() {
  recogerEditor(); catalogoBorrador.push({id:'servicio-'+crypto.randomUUID(),nombre:'Nueva activación',descripcion:'',color:'#0D9488',tablets:1,costo:0,sustentoUrl:'',activo:true,permiteImpresora:false,alias:[]}); renderizarEditorCatalogo();
  $('editorCatalogo').lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});
}
$('formCatalogo').addEventListener('submit', async e => {
  e.preventDefault(); recogerEditor(); const btn = $('guardarCatalogo'); btn.disabled = true;
  try {
    const config = {}; ['tabletsTotal','impresorasTotal','margenAntes','margenDespues'].forEach(k => config[k]=Number($('cfg_'+k).value));
    await ApiActivaciones.llamar('save_catalog',{catalogo:catalogoBorrador,config,revision:revisionBorrador});
    cerrarCatalogo(); await cargarDatosDesdeGoogle(); mostrarToast('Servicios y recursos guardados.');
  } catch(e) { mostrarToast(e.message,'error'); } finally { btn.disabled = false; }
});
// Foco de teclado y Escape en ventanas; los formularios conservan los cambios al cerrar con Escape.
document.addEventListener('keydown',e => {
  const visibles = ['modalConfirmacion','modalCatalogo','modalAdminsOverlay','modalOverlay'].map($).filter(n => !n.classList.contains('hidden'));
  const modal = visibles[0]; if (!modal) return;
  if(e.key === 'Escape' && !guardando) modal.classList.add('hidden');
  if(e.key === 'Tab') {
    const a = [...modal.querySelectorAll('button,input,select,textarea,a[href]')].filter(n => !n.disabled && n.getClientRects().length);
    if (!a.length) return;
    if(e.shiftKey && (document.activeElement === a[0] || !modal.contains(document.activeElement))) { e.preventDefault(); a.at(-1).focus(); }
    else if(!e.shiftKey && (document.activeElement === a.at(-1) || !modal.contains(document.activeElement))) {e.preventDefault();a[0].focus();}
  }
});
document.addEventListener('DOMContentLoaded',async () => {
  limpiarCacheLocal();
  if (sessionStorage.getItem('activaciones_id_token')) { try { await cargarDatosDesdeGoogle(); } catch(e) { $('loginError').textContent=e.message;$('loginError').classList.remove('hidden'); } }
});
window.addEventListener('pageshow',() => calendarObj?.updateSize());
if (window.__credencialPendiente) { const r = window.__credencialPendiente; delete window.__credencialPendiente; window.handleCredentialResponse(r); }
