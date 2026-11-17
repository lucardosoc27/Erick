'use strict';
/** CRUD de PETS. Regra de negocio: todo pet deve estar associado a um tutor. */
const { todos, um, exec, ehFK } = require('./db');
const { get, post, put, del, ErroHttp, texto } = require('./http');

function validar(b) {
  const peso = String(b.peso_kg ?? '').replace(',', '.').trim();
  const d = {
    nome: texto(b.nome), especie: texto(b.especie), raca: texto(b.raca),
    data_nasc: texto(b.data_nasc) || null, peso_kg: peso === '' ? null : Number(peso),
    tutor_id: Number(b.tutor_id),
  };
  const erros = [];
  if (!d.nome) erros.push('Nome do pet e obrigatorio.');
  if (!d.especie) erros.push('Especie e obrigatoria.');
  // REGRA: todo pet novo deve ser associado a um tutor existente
  if (!b.tutor_id || !Number.isInteger(d.tutor_id)) erros.push('Selecione o tutor: todo pet deve ter um tutor.');
  else if (!um('SELECT id FROM tutor WHERE id = ?', d.tutor_id)) erros.push('Tutor inexistente.');
  if (d.peso_kg !== null && !(d.peso_kg > 0 && d.peso_kg < 1000)) erros.push('Peso invalido.');
  if (d.data_nasc && (!/^\d{4}-\d{2}-\d{2}$/.test(d.data_nasc) || d.data_nasc > new Date().toISOString().slice(0, 10))) {
    erros.push('Data de nascimento invalida.');
  }
  if (erros.length) throw new ErroHttp(422, erros.join(' '));
  return d;
}

get('/api/pets', ({ query }) => todos(`
  SELECT p.*, t.nome AS tutor FROM pet p JOIN tutor t ON t.id = p.tutor_id
  WHERE p.nome LIKE ? ORDER BY p.nome`, `%${(query.get('q') || '').trim()}%`));

get('/api/pets/:id', ({ params }) => {
  const p = um('SELECT * FROM pet WHERE id = ?', params.id);
  if (!p) throw new ErroHttp(404, 'Pet nao encontrado.');
  return p;
});

post('/api/pets', ({ body, resposta }) => {
  const d = validar(body);
  const r = exec('INSERT INTO pet (nome, especie, raca, data_nasc, peso_kg, tutor_id) VALUES (?,?,?,?,?,?)',
    d.nome, d.especie, d.raca, d.data_nasc, d.peso_kg, d.tutor_id);
  resposta.status = 201;
  return { id: Number(r.lastInsertRowid), mensagem: 'Pet cadastrado.' };
});

put('/api/pets/:id', ({ params, body }) => {
  if (!um('SELECT id FROM pet WHERE id = ?', params.id)) throw new ErroHttp(404, 'Pet nao encontrado.');
  const d = validar(body);
  exec('UPDATE pet SET nome=?, especie=?, raca=?, data_nasc=?, peso_kg=?, tutor_id=? WHERE id=?',
    d.nome, d.especie, d.raca, d.data_nasc, d.peso_kg, d.tutor_id, params.id);
  return { mensagem: 'Pet atualizado.' };
});

del('/api/pets/:id', ({ params }) => {
  try {
    const r = exec('DELETE FROM pet WHERE id = ?', params.id);
    if (!r.changes) throw new ErroHttp(404, 'Pet nao encontrado.');
  } catch (e) {
    if (ehFK(e)) throw new ErroHttp(409, 'Nao e possivel excluir: o pet possui agendamentos.');
    throw e;
  }
  return { mensagem: 'Pet excluido.' };
});
