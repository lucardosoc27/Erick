'use strict';
/** Mini-roteador HTTP e utilitarios (sem frameworks). */

class ErroHttp extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const rotas = [];
function rota(metodo, caminho, handler, { publica = false } = {}) {
  const regex = new RegExp('^' + caminho.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
  rotas.push({ metodo, regex, handler, publica });
}
const get = (c, h, o) => rota('GET', c, h, o);
const post = (c, h, o) => rota('POST', c, h, o);
const put = (c, h, o) => rota('PUT', c, h, o);
const del = (c, h, o) => rota('DELETE', c, h, o);

function lerCorpo(req, limite = 100_000) {
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > limite) { reject(new ErroHttp(413, 'Corpo da requisicao muito grande.')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      if (!partes.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
      catch { reject(new ErroHttp(400, 'JSON invalido.')); }
    });
    req.on('error', reject);
  });
}

function enviarJson(res, status, obj, cabecalhos = {}) {
  const corpo = JSON.stringify(obj ?? {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    'Cache-Control': 'no-store',
    ...cabecalhos,
  });
  res.end(corpo);
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

module.exports = { ErroHttp, rotas, get, post, put, del, lerCorpo, enviarJson, texto };
