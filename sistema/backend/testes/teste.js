'use strict';
// Teste de ponta a ponta: sobe o servidor com banco temporario e exercita a API. Execute: npm test
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs'); const assert = require('node:assert');
process.env.SAEP_DB = path.join(os.tmpdir(), `saep-teste-${process.pid}.db`);
const servidor = require('../server');

(async () => {
  await new Promise((r) => servidor.listen(0, r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  let token = '';
  const req = async (m, u, corpo, extra = {}) => {
    const h = { ...(token && { Authorization: `Bearer ${token}` }), ...extra };
    if (corpo) h['Content-Type'] = 'application/json';
    const r = await fetch(base + u, { method: m, headers: h, body: corpo && JSON.stringify(corpo) });
    return { s: r.status, d: await r.json().catch(() => ({})), r };
  };
  let n = 0; const ok = (nome) => console.log(`  ok ${++n}. ${nome}`);

  // ----- CORS -----
  let r = await fetch(base + '/api/tutores', { method: 'OPTIONS' });
  assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), '*'); ok('CORS: pre-flight liberado');

  // ----- Cadastro de usuario -----
  r = await req('POST', '/api/cadastro', { nome: 'Ana Paula', email: 'ana@teste.com', senha: '123' }); assert.equal(r.s, 422); ok('cadastro: senha curta recusada');
  r = await req('POST', '/api/cadastro', { nome: 'Ana Paula', email: 'invalido', senha: '123456' }); assert.equal(r.s, 422); ok('cadastro: e-mail invalido recusado');
  r = await req('POST', '/api/cadastro', { nome: 'Ana Paula', email: 'ana@teste.com', senha: '123456', perfil: 'admin' }); assert.equal(r.s, 201); ok('cadastro: conta criada');
  assert.equal(require('../db').um("SELECT perfil FROM usuario WHERE email='ana@teste.com'").perfil, 'atendente'); ok('cadastro: perfil forcado para atendente');
  assert.ok(!require('../db').um("SELECT senha_hash h FROM usuario WHERE email='ana@teste.com'").h.includes('123456')); ok('cadastro: senha salva como hash');
  r = await req('POST', '/api/cadastro', { nome: 'Outra', email: 'ANA@teste.com', senha: '123456' }); assert.equal(r.s, 409); ok('cadastro: e-mail duplicado recusado');

  // ----- Login -----
  assert.equal((await req('GET', '/api/tutores')).s, 401); ok('sem login -> 401');
  r = await req('POST', '/api/login', { email: 'ana@teste.com', senha: 'errada' }); assert.equal(r.s, 401); assert.match(r.d.erro, /invalidos/); ok('login: senha errada -> mensagem de erro');
  r = await req('POST', '/api/login', { email: 'ana@teste.com', senha: '123456' }); assert.equal(r.s, 200); assert.equal(r.d.nome, 'Ana Paula'); ok('login com a conta recem-criada');
  r = await req('POST', '/api/login', { email: 'admin@vetsaep.com', senha: 'admin123' }); assert.equal(r.s, 200); token = r.d.token; ok('login admin (seed)');
  r = await req('GET', '/api/sessao'); assert.equal(r.d.nome, 'Administrador'); ok('consulta de sessao');

  // ----- Painel / Tutores -----
  r = await req('GET', '/api/painel'); assert.equal(r.d.totais.tutores, 3); ok('dashboard');
  r = await req('GET', '/api/tutores'); assert.equal(r.d.length, 3); assert.match(r.d[0].cpf, /^\*\*\*\.\d{3}\.\*\*\*-\*\*$/); ok('CPF mascarado na listagem');
  r = await req('GET', '/api/tutores?q=fern'); assert.equal(r.d.length, 1); assert.equal(r.d[0].nome, 'Fernanda Souza'); ok('busca de tutor filtra a lista');
  r = await req('GET', '/api/tutores?q=%27%20OR%201%3D1%20--'); assert.equal(r.d.length, 0); ok('SQL injection neutralizado');
  const cru = require('../db').todos('SELECT cpf_cifrado FROM tutor').map((t) => t.cpf_cifrado).join();
  assert.ok(!cru.includes('52998224725')); ok('CPF nao aparece em claro no banco');
  r = await req('GET', '/api/tutores/1'); assert.equal(r.d.cpf, '529.982.247-25'); ok('CPF decifrado so na edicao');
  r = await req('POST', '/api/tutores', { nome: 'Ana', cpf: '123', telefone: '1' }); assert.equal(r.s, 422); ok('CPF invalido');
  r = await req('POST', '/api/tutores', { nome: 'Ana', cpf: '529.982.247-25', telefone: '1' }); assert.equal(r.s, 422); ok('CPF duplicado');
  r = await req('POST', '/api/tutores', { nome: 'Paulo', cpf: '168.995.350-09', telefone: '1' }); assert.equal(r.s, 201); const tid = r.d.id; ok('tutor criado');
  r = await req('PUT', `/api/tutores/${tid}`, { nome: 'Paulo Souza', cpf: '16899535009', telefone: '2' }); assert.equal(r.s, 200);
  r = await req('GET', `/api/tutores/${tid}`); assert.equal(r.d.nome, 'Paulo Souza'); assert.equal(r.d.telefone, '2'); ok('edicao de tutor salva no banco');

  // ----- Pets -----
  r = await req('POST', '/api/pets', { nome: 'Bob', especie: 'Cao' }); assert.equal(r.s, 422); assert.match(r.d.erro, /deve ter um tutor/); ok('pet sem tutor bloqueado');
  r = await req('POST', '/api/pets', { nome: 'Bob', especie: 'Cao', tutor_id: 999 }); assert.equal(r.s, 422); ok('pet com tutor inexistente bloqueado');
  r = await req('POST', '/api/pets', { nome: 'Bob', especie: 'Cao', tutor_id: tid, peso_kg: '8,5' }); assert.equal(r.s, 201); const pid = r.d.id; ok('pet criado');
  r = await req('DELETE', `/api/tutores/${tid}`); assert.equal(r.s, 409); ok('nao exclui tutor com pets');

  // ----- Agendamentos -----
  r = await req('GET', '/api/agendamentos'); const datas = r.d.map((a) => a.data_hora);
  assert.deepEqual(datas, [...datas].sort()); assert.ok(r.d[0].pet && r.d[0].tutor && r.d[0].tutor_telefone && r.d[0].motivo); ok('lista ordenada por data, com dados de agendamento + pet + tutor');
  r = await req('POST', '/api/agendamentos', { pet_id: 1, data_hora: '2026-11-20T09:00', motivo: 'x' }); assert.equal(r.s, 409); assert.match(r.d.erro, /ocupado/); ok('conflito de horario');
  r = await req('POST', '/api/agendamentos', { pet_id: 1, data_hora: '2020-01-01T09:00', motivo: 'x' }); assert.equal(r.s, 422); ok('agendar no passado bloqueado');
  r = await req('POST', '/api/agendamentos', { pet_id: pid, data_hora: '2027-03-10T15:30', motivo: 'Consulta' }); assert.equal(r.s, 201); const aid = r.d.id; ok('agendamento criado');
  r = await req('PUT', `/api/agendamentos/${aid}`, { data_hora: '2026-11-20T10:00' }); assert.equal(r.s, 409); ok('alterar data para horario ocupado bloqueado');
  r = await req('PUT', `/api/agendamentos/${aid}`, { data_hora: '2027-04-01T08:00', motivo: 'HACK', status: 'cancelado', pet_id: 1 }); assert.equal(r.s, 200);
  r = await req('GET', `/api/agendamentos/${aid}`);
  assert.equal(r.d.data_hora, '2027-04-01T08:00'); assert.equal(r.d.motivo, 'Consulta'); assert.equal(r.d.status, 'agendado'); assert.equal(r.d.pet, 'Bob'); ok('edicao altera APENAS a data (salva no banco)');
  r = await req('DELETE', `/api/agendamentos/${aid}`); assert.equal(r.s, 200); ok('agendamento excluido');

  // ----- Seguranca -----
  r = await req('GET', '/api/tutores', undefined, { Authorization: 'Bearer 00ff' }); assert.equal(r.s, 401); ok('token falso -> 401');
  r = await req('POST', '/api/logout'); assert.equal(r.s, 200); r = await req('GET', '/api/tutores'); assert.equal(r.s, 401); ok('logout invalida o token');
  token = '';
  for (let i = 0; i < 5; i++) await req('POST', '/api/login', { email: 'x@x.com', senha: 'y' });
  r = await req('POST', '/api/login', { email: 'admin@vetsaep.com', senha: 'admin123' }); assert.equal(r.s, 429); ok('bloqueio por forca bruta -> 429');
  const est = await fetch(base + '/'); assert.equal(est.status, 200); assert.match(await est.text(), /Criar conta/); ok('frontend servido (index com cadastro)');
  for (const p of ['dashboard', 'tutores', 'pets', 'agendamentos']) assert.equal((await fetch(`${base}/${p}.html`)).status, 200); ok('todas as paginas existem');
  assert.notEqual((await fetch(base + '/..%2fconfig.js')).status, 200); ok('path traversal bloqueado');

  console.log(`\nTODOS OS ${n} TESTES PASSARAM`);
  servidor.close(); fs.rmSync(process.env.SAEP_DB, { force: true }); process.exit(0);
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
