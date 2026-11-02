/* Las identidades y permisos se verifican en el servidor; no se confía en el rol local. */
window.ApiActivaciones = {
  async llamar(action, datos = {}) {
    const idToken = sessionStorage.getItem('activaciones_id_token');
    if (!idToken) throw new Error('Inicia sesión con Google para continuar.');
    const respuesta = await fetch(ACTIVACIONES_CONFIG.apiUrl, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({...datos, action, idToken}), redirect: 'follow'
    });
    if (!respuesta.ok) throw new Error('No se pudo conectar con el servidor (' + respuesta.status + ').');
    const texto = await respuesta.text();
    let res;
    try { res = JSON.parse(texto); } catch { throw new Error('Google no devolvió JSON. Revisa la implementación web /exec y sus permisos.'); }
    if (res.status === 'error') {
      if (res.code === 'AUTH') {
        sessionStorage.removeItem('activaciones_id_token');
        sessionStorage.removeItem('currentUser');
        document.getElementById('loginScreen')?.classList.remove('hidden');
      }
      throw new Error(res.error || res.errorDetallado || 'No se pudo completar la operación.');
    }
    return res;
  },
  escapar(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  enlace(v) { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } }
};
