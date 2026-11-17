'use strict';
/** Sessoes em memoria. O token vai no cabecalho "Authorization: Bearer ..." (frontend guarda no localStorage). */
const config = require('./config');
const { novoToken } = require('./seguranca');
const { ErroHttp } = require('./http');

const sessoes = new Map();
const LIMITE_MS = () => config.SESSAO_MIN * 60 * 1000;

function criar(usuario) {
  const token = novoToken();
  const s = { token, usuarioId: usuario.id, nome: usuario.nome, perfil: usuario.perfil, ultimo: Date.now() };
  sessoes.set(token, s);
  return s;
}

const tokenDaRequisicao = (req) => {
  const m = /^Bearer ([a-f0-9]+)$/.exec(req.headers.authorization || '');
  return m ? m[1] : null;
};

/** Retorna a sessao valida; renova o prazo se `renovar` for true. */
function obter(req, renovar = true) {
  const t = tokenDaRequisicao(req);
  const s = t && sessoes.get(t);
  if (!s) return null;
  if (Date.now() - s.ultimo > LIMITE_MS()) { sessoes.delete(t); return null; } // REGRA: expiracao
  if (renovar) s.ultimo = Date.now();
  return s;
}

const encerrar = (req) => { const t = tokenDaRequisicao(req); if (t) sessoes.delete(t); };

function exigir(req) {
  const s = obter(req);
  if (!s) throw new ErroHttp(401, 'Sessao expirada. Faca login novamente.');
  return s;
}

setInterval(() => {
  const agora = Date.now();
  for (const [t, s] of sessoes) if (agora - s.ultimo > LIMITE_MS()) sessoes.delete(t);
}, 60_000).unref();

module.exports = { criar, obter, encerrar, exigir };
