'use strict';
/**
 * Servidor HTTP (somente modulos nativos do Node - sem Express).
 * Execute:  npm start   ->  API em http://localhost:3000
 * O frontend pode rodar no Live Server (CORS liberado) ou ser aberto direto em http://localhost:3000
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
require('./db');
const { rotas, ErroHttp, lerCorpo, enviarJson } = require('./http');
const sessao = require('./sessao');
['auth', 'painel', 'tutores', 'pets', 'agendamentos'].forEach((m) => require(`./${m}`));

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ico': 'image/x-icon' };
const SEGURANCA = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};
// CORS: permite que o frontend (Live Server, porta 5500 etc.) consuma a API.
// A autenticacao e por token no cabecalho (nao por cookie), entao liberar a origem e seguro.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function servirEstatico(res, caminho) {
  const rel = caminho === '/' ? '/index.html' : decodeURIComponent(caminho);
  const arquivo = path.normalize(path.join(config.FRONTEND_DIR, rel));
  if (!arquivo.startsWith(config.FRONTEND_DIR + path.sep)) { res.writeHead(403, SEGURANCA); return res.end('Acesso negado'); }
  fs.readFile(arquivo, (err, dados) => {
    if (err) { res.writeHead(404, { ...SEGURANCA, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nao encontrado'); }
    res.writeHead(200, { ...SEGURANCA, 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
}

async function tratarApi(req, res, url) {
  const resposta = { status: 200 };
  try {
    const encontrada = rotas.find((r) => r.metodo === req.method && r.regex.test(url.pathname));
    if (!encontrada) throw new ErroHttp(404, 'Rota nao encontrada.');
    const s = encontrada.publica ? null : sessao.exigir(req);
    const body = ['POST', 'PUT'].includes(req.method) ? await lerCorpo(req) : {};
    const params = encontrada.regex.exec(url.pathname).groups || {};
    const dados = await encontrada.handler({ req, params, query: url.searchParams, body, sessao: s, resposta });
    enviarJson(res, resposta.status, dados, CORS);
  } catch (e) {
    if (e instanceof ErroHttp) return enviarJson(res, e.status, { erro: e.message }, CORS);
    console.error(e);
    enviarJson(res, 500, { erro: 'Erro interno do servidor.' }, CORS);
  }
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }   // pre-flight do CORS
    return tratarApi(req, res, url);
  }
  if (req.method !== 'GET') { res.writeHead(405, SEGURANCA); return res.end(); }
  servirEstatico(res, url.pathname);
});

if (require.main === module) {
  servidor.listen(config.PORT, () => console.log(`VetSAEP rodando em http://localhost:${config.PORT}`));
}
module.exports = servidor;
