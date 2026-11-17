'use strict';
/** CRUD de TUTORES. CPF cifrado (AES-256-GCM) e mascarado nas listagens - LGPD. */
const { todos, um, exec, ehFK, ehUnique } = require('./db');
const { get, post, put, del, ErroHttp, texto } = require('./http');
const seg = require('./seguranca');

function validar(b, idAtual = 0) {
  const d = {
    nome: texto(b.nome), cpf: seg.soDigitos(b.cpf), telefone: texto(b.telefone),
    email: texto(b.email), endereco: texto(b.endereco),
  };
  const erros = [];
  if (d.nome.length < 2) erros.push('Nome e obrigatorio.');
  if (!seg.cpfValido(d.cpf)) erros.push('CPF invalido.');
  if (!d.telefone) erros.push('Telefone e obrigatorio.');
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) erros.push('E-mail invalido.');
  if (!erros.length && um('SELECT id FROM tutor WHERE cpf_hash = ? AND id <> ?', seg.hashCpf(d.cpf), idAtual)) {
    erros.push('Ja existe um tutor com este CPF.');
  }
  if (erros.length) throw new ErroHttp(422, erros.join(' '));
  return d;
}

// REGRA (busca): filtra a tabela pelo nome digitado (LIKE) - o CPF volta mascarado
get('/api/tutores', ({ query }) => {
  const q = `%${(query.get('q') || '').trim()}%`;
  return todos('SELECT * FROM tutor WHERE nome LIKE ? ORDER BY nome', q).map((t) => ({
    id: t.id, nome: t.nome, cpf: seg.mascararCpf(t.cpf_cifrado),
    telefone: t.telefone, email: t.email, endereco: t.endereco,
  }));
});

get('/api/tutores/:id', ({ params }) => {
  const t = um('SELECT * FROM tutor WHERE id = ?', params.id);
  if (!t) throw new ErroHttp(404, 'Tutor nao encontrado.');
  // CPF decifrado apenas aqui, para a tela de edicao
  return { id: t.id, nome: t.nome, cpf: seg.formatarCpf(seg.decifrarCpf(t.cpf_cifrado)),
           telefone: t.telefone, email: t.email, endereco: t.endereco };
});

// REGRA (criptografia): o CPF NUNCA e salvo em texto limpo - cifrarCpf() usa AES-256-GCM antes do INSERT
post('/api/tutores', ({ body, resposta }) => {
  const d = validar(body);
  const r = exec('INSERT INTO tutor (nome, cpf_cifrado, cpf_hash, telefone, email, endereco) VALUES (?,?,?,?,?,?)',
    d.nome, seg.cifrarCpf(d.cpf), seg.hashCpf(d.cpf), d.telefone, d.email, d.endereco);
  resposta.status = 201;
  return { id: Number(r.lastInsertRowid), mensagem: 'Tutor cadastrado.' };
});

// REGRA (edicao): atualiza os dados do tutor no banco (CPF e cifrado novamente)
put('/api/tutores/:id', ({ params, body }) => {
  if (!um('SELECT id FROM tutor WHERE id = ?', params.id)) throw new ErroHttp(404, 'Tutor nao encontrado.');
  const d = validar(body, Number(params.id));
  exec('UPDATE tutor SET nome=?, cpf_cifrado=?, cpf_hash=?, telefone=?, email=?, endereco=? WHERE id=?',
    d.nome, seg.cifrarCpf(d.cpf), seg.hashCpf(d.cpf), d.telefone, d.email, d.endereco, params.id);
  return { mensagem: 'Tutor atualizado.' };
});

del('/api/tutores/:id', ({ params }) => {
  try {
    const r = exec('DELETE FROM tutor WHERE id = ?', params.id);
    if (!r.changes) throw new ErroHttp(404, 'Tutor nao encontrado.');
  } catch (e) {
    if (ehFK(e)) throw new ErroHttp(409, 'Nao e possivel excluir: o tutor possui pets cadastrados.');
    if (ehUnique(e)) throw new ErroHttp(409, 'Conflito de dados.');
    throw e;
  }
  return { mensagem: 'Tutor excluido.' };
});
