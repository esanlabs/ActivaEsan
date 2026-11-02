/* Motor compartido: copiar también a Apps Script como Reservas.gs. Sin dependencias. */
var Reservas = (function () {
  'use strict';
  function numero(v, min, max, nombre) {
    var n = Number(v);
    if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < min || n > max)
      throw new Error('Valor inválido: ' + nombre);
    return n;
  }
  function entero(v, min, max, nombre) {
    var n = numero(v, min, max, nombre);
    if (!Number.isInteger(n)) throw new Error(nombre + ' debe ser entero.');
    return n;
  }
  function instante(fecha, hora) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || ''))
      throw new Error('Completa una fecha y hora válidas.');
    var t = Date.parse(fecha + 'T' + hora + ':00-05:00');
    if (!Number.isFinite(t) || new Date(t - 5 * 3600000).toISOString().slice(0, 10) !== fecha)
      throw new Error('Fecha inválida.');
    return t;
  }
  function sumarDias(fecha, dias) {
    return new Date(instante(fecha, '00:00') - 5 * 3600000 + dias * 86400000).toISOString().slice(0, 10);
  }
  function servicio(registro, catalogo) {
    return catalogo.find(function (s) {
      return (registro.servicioId && registro.servicioId === s.id) ||
        (!registro.servicioId && (s.nombre === registro.tipoServicio || (s.alias || []).indexOf(registro.tipoServicio) >= 0));
    });
  }
  function imprime(r) {
    return r.conImpresora === true || r.conImpresora === 'true' || r.tipoServicio === 'Foto Gif Impresión';
  }
  function tramo(r, catalogo, config) {
    var s = servicio(r, catalogo);
    var impresora = imprime(r);
    var tablets = r.tabletsReservadas !== '' && r.tabletsReservadas != null ? Number(r.tabletsReservadas) : (s ? s.tablets : 1);
    var inicio, fin, antes, despues;
    var legacy = !r.horaInicio || !r.horaFin;
    if (legacy) {
      inicio = instante(r.fecha, '00:00');
      fin = instante(sumarDias(r.fecha, Number(r.diasServicio) || 1), '00:00');
      // Conserva el bloqueo original por días hasta que el registro reciba horas.
      antes = despues = impresora ? 24 : 0;
    } else {
      inicio = instante(r.fecha, r.horaInicio);
      fin = instante(r.fechaFin || r.fecha, r.horaFin);
      antes = impresora ? (r.margenAntes != null && r.margenAntes !== '' ? Number(r.margenAntes) : config.margenAntes) : 0;
      despues = impresora ? (r.margenDespues != null && r.margenDespues !== '' ? Number(r.margenDespues) : config.margenDespues) : 0;
    }
    if (fin <= inicio) throw new Error('El fin debe ser posterior al inicio.');
    return { inicio: inicio - antes * 3600000, fin: fin + despues * 3600000,
      tablets: entero(tablets, 1, 10000, 'tablets'), impresoras: impresora ? 1 : 0,
      numEvento: r.numEvento, evento: r.tipoEvento || 'Activación', legacy: legacy };
  }
  function activos(registros, catalogo, config) {
    return registros.filter(function (r) { return r.estado !== 'Cancelado' && r.fecha; })
      .map(function (r) { try { return tramo(r, catalogo, config); } catch (e) { throw new Error('Revisa el horario de la reserva #' + r.numEvento + ': ' + e.message); } });
  }
  function comprobar(tramos, candidatos, config) {
    // Finales antes que comienzos: [inicio, fin). Reservas contiguas no chocan.
    var eventos = [];
    tramos.forEach(function (t) {
      eventos.push({ t: t.inicio, tablets: t.tablets, impresoras: t.impresoras });
      eventos.push({ t: t.fin, tablets: -t.tablets, impresoras: -t.impresoras });
    });
    eventos.sort(function (a, b) { return a.t - b.t; });
    var tablets = 0, impresoras = 0;
    for (var i = 0; i < eventos.length;) {
      var t = eventos[i].t;
      while (i < eventos.length && eventos[i].t === t) {
        tablets += eventos[i].tablets; impresoras += eventos[i].impresoras; i++;
      }
      if (i === eventos.length || eventos[i].t <= t) continue;
      var afecta = candidatos.some(function (c) { return c.inicio <= t && t < c.fin; });
      if (afecta && (tablets > config.tabletsTotal || impresoras > config.impresorasTotal)) {
        var fecha = new Date(t - 5 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
        throw new Error('Sin disponibilidad el ' + fecha + ' (hora de Lima): se necesitan ' + tablets + '/' + config.tabletsTotal +
          ' tablets y ' + impresoras + '/' + config.impresorasTotal + ' impresoras. Cambia el horario o el servicio.');
      }
    }
    return true;
  }
  function validarLote(existentes, items, catalogo, config) {
    var ids = items.filter(function (r) { return r.numEvento != null && r.numEvento !== ''; }).map(function (r) { return String(r.numEvento); });
    if (new Set(ids).size !== ids.length) throw new Error('El lote repite un registro.');
    var base = existentes.filter(function (r) { return ids.indexOf(String(r.numEvento)) < 0; });
    var candidatos = activos(items, catalogo, config);
    return comprobar(activos(base, catalogo, config).concat(candidatos), candidatos, config);
  }
  function estado(r, ahora) {
    if (r.estado === 'Cancelado') return 'Cancelado';
    var inicio = instante(r.fecha, r.horaInicio || '00:00');
    var fin = r.horaFin ? instante(r.fechaFin || r.fecha, r.horaFin) : instante(sumarDias(r.fecha, Number(r.diasServicio) || 1), '00:00');
    return ahora < inicio ? 'Pendiente' : (ahora >= fin ? 'Culminado' : 'Confirmado');
  }
  return { numero: numero, entero: entero, instante: instante, sumarDias: sumarDias, servicio: servicio, imprime: imprime,
    tramo: tramo, comprobar: comprobar, activos: activos, validarLote: validarLote, estado: estado };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Reservas;
