'use strict';
/** Seguranca e protecao de dados pessoais (LGPD) - somente modulos nativos do Node. */
const crypto = require('node:crypto');
const config = require('./config');

const CHAVE = crypto.scryptSync(config.CHAVE_SEGREDO, 'saep-sal-fixo', 32);

// ---------- Senhas: scrypt com sal aleatorio ----------
function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const chave = crypto.scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString('hex')}$${chave.toString('hex')}`;
}

function confereSenha(hash, senha) {
  const [alg, salHex, chaveHex] = String(hash).split('$');
  if (alg !== 'scrypt' || !salHex || !chaveHex) return false;
  const esperado = Buffer.from(chaveHex, 'hex');
  const obtido = crypto.scryptSync(String(senha), Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, obtido);
}

// ---------- CPF ----------
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function cpfValido(cpf) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(c[n])) return false;
  }
  return true;
}

// AES-256-GCM: confidencialidade + integridade. Formato: iv.tag.cifrado (base64)
function cifrarCpf(cpf) {
  const iv = crypto.randomBytes(12);
  const cif = crypto.createCipheriv('aes-256-gcm', CHAVE, iv);
  const dados = Buffer.concat([cif.update(soDigitos(cpf), 'utf8'), cif.final()]);
  return [iv, cif.getAuthTag(), dados].map((b) => b.toString('base64')).join('.');
}

function decifrarCpf(token) {
  try {
    const [iv, tag, dados] = String(token).split('.').map((p) => Buffer.from(p, 'base64'));
    const dec = crypto.createDecipheriv('aes-256-gcm', CHAVE, iv);
    dec.setAuthTag(tag);
    return Buffer.concat([dec.update(dados), dec.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// Hash deterministico: permite detectar CPF duplicado sem guardar o CPF em claro
function hashCpf(cpf) {
  return crypto.createHmac('sha256', CHAVE).update(soDigitos(cpf)).digest('hex');
}

function mascararCpf(token) {
  const c = decifrarCpf(token);
  return c.length === 11 ? `***.${c.slice(3, 6)}.***-**` : '***.***.***-**';
}

function formatarCpf(c) {
  return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c;
}

const novoToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

module.exports = {
  hashSenha, confereSenha, soDigitos, cpfValido, cifrarCpf, decifrarCpf,
  hashCpf, mascararCpf, formatarCpf, novoToken,
};
