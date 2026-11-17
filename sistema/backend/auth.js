'use strict';
/** LOGIN, CADASTRO DE USUARIO e LOGOUT. */
const { um, exec } = require('./db');
const { get, post, ErroHttp, texto } = require('./http');
const { confereSenha, hashSenha } = require('./seguranca');
const sessao = require('./sessao');
const config = require('./config');

const falhas = new Map(); // ip -> { n, ate }  (protecao contra forca bruta)

function verificarBloqueio(ip) {
  const f = falhas.get(ip);
  if (f && f.ate > Date.now()) throw new ErroHttp(429, 'Muitas tentativas. Aguarde 1 minuto e tente novamente.');
}
function registrarFalha(ip) {
  const f = falhas.get(ip) || { n: 0, ate: 0 };
  f.n += 1;
  if (f.n >= config.LOGIN_MAX_TENTATIVAS) { f.ate = Date.now() + config.LOGIN_BLOQUEIO_MIN * 60_000; f.n = 0; }
  falhas.set(ip, f);
}

// ---------- CADASTRO DE USUARIO ----------
post('/api/cadastro', ({ body, resposta }) => {
  const nome = texto(body.nome);
  const email = texto(body.email).toLowerCase();
  const senha = typeof body.senha === 'string' ? body.senha : '';
  const erros = [];
  if (nome.length < 3) erros.push('Informe seu nome completo.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.push('E-mail invalido.');
  if (senha.length < 6 || senha.length > 100) erros.push('A senha deve ter de 6 a 100 caracteres.');
  if (erros.length) throw new ErroHttp(422, erros.join(' '));
  if (um('SELECT id FROM usuario WHERE email = ?', email)) throw new ErroHttp(409, 'Ja existe uma conta com este e-mail.');
  // REGRA (seguranca): a senha e salva apenas como hash (scrypt + sal); o perfil de quem se cadastra e sempre "atendente"
  exec('INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?,?,?,?)', nome, email, hashSenha(senha), 'atendente');
  resposta.status = 201;
  return { mensagem: 'Conta criada com sucesso! Faca login.' };
}, { publica: true });

// ---------- LOGIN ----------
post('/api/login', ({ req, body }) => {
  const ip = req.socket.remoteAddress;
  verificarBloqueio(ip);
  const email = texto(body.email).toLowerCase();
  const senha = typeof body.senha === 'string' ? body.senha : '';
  const u = email && um('SELECT * FROM usuario WHERE email = ?', email);
  const ok = u ? confereSenha(u.senha_hash, senha) : (confereSenha('scrypt$00$00', senha), false);
  // REGRA: validacao do login - mensagem de erro generica quando as credenciais estao erradas
  if (!ok) { registrarFalha(ip); throw new ErroHttp(401, 'E-mail ou senha invalidos.'); }
  falhas.delete(ip);
  const s = sessao.criar(u);
  return { token: s.token, nome: s.nome, perfil: s.perfil, expiraMin: config.SESSAO_MIN };
}, { publica: true });

// Consulta a sessao SEM renovar o prazo (o front-end usa para detectar expiracao)
get('/api/sessao', ({ req }) => {
  const s = sessao.obter(req, false);
  if (!s) throw new ErroHttp(401, 'Sem sessao.');
  return { nome: s.nome, perfil: s.perfil, expiraMin: config.SESSAO_MIN };
}, { publica: true });

// ---------- LOGOUT ----------
post('/api/logout', ({ req }) => { sessao.encerrar(req); return { ok: true }; }, { publica: true });
