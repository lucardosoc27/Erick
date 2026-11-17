'use strict';
/** AGENDAMENTOS: listagem ordenada por data, cadastro com validacao de conflito e edicao APENAS da data. */
const { todos, um, exec, ehUnique } = require('./db');
const { get, post, put, del, ErroHttp, texto } = require('./http');

/** Converte 'YYYY-MM-DDTHH:MM' para 'YYYY-MM-DD HH:MM' validando a data real. */
function normalizarDataHora(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(texto(v));
  if (!m) return null;
  const [, a, mes, d, h] = m.map(Number);
  const dt = new Date(a, mes - 1, d, h, Number(m[5]));
  if (dt.getFullYear() !== a || dt.getMonth() !== mes - 1 || dt.getDate() !== d || dt.getHours() !== h) return null;
  return { texto: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`, data: dt };
}

/** REGRA: validacao de agendamentos ja cadastrados (nao permite dois no mesmo horario). */
function validarHorario(valor) {
  const dh = normalizarDataHora(valor);
  if (!dh) throw new ErroHttp(422, 'Data/hora invalida.');
  if (dh.data < new Date()) throw new ErroHttp(422, 'Nao e possivel agendar no passado.');
  return dh.texto;
}
function checarConflito(horario, idAtual = 0) {
  const c = um("SELECT id FROM agendamento WHERE data_hora = ? AND status <> 'cancelado' AND id <> ?", horario, idAtual);
  if (c) throw new ErroHttp(409, `O horario ${horario} ja esta ocupado (agendamento #${c.id}).`);
}

// REGRA: lista ordenada pela data do agendamento (ORDER BY) com dados do agendamento + pet + tutor (JOIN)
get('/api/agendamentos', () => todos(`
  SELECT a.id, a.data_hora, a.motivo, a.status,
         p.nome AS pet, p.especie, p.raca,
         t.nome AS tutor, t.telefone AS tutor_telefone
  FROM agendamento a
  JOIN pet   p ON p.id = a.pet_id
  JOIN tutor t ON t.id = p.tutor_id
  ORDER BY a.data_hora ASC`));

get('/api/agendamentos/:id', ({ params }) => {
  const a = um(`SELECT a.id, a.data_hora, a.motivo, a.status, p.nome AS pet, t.nome AS tutor
                FROM agendamento a JOIN pet p ON p.id = a.pet_id JOIN tutor t ON t.id = p.tutor_id WHERE a.id = ?`, params.id);
  if (!a) throw new ErroHttp(404, 'Agendamento nao encontrado.');
  return { ...a, data_hora: a.data_hora.replace(' ', 'T') };
});

post('/api/agendamentos', ({ body, sessao, resposta }) => {
  const pet_id = Number(body.pet_id);
  const motivo = texto(body.motivo);
  if (!body.pet_id || !um('SELECT id FROM pet WHERE id = ?', pet_id)) throw new ErroHttp(422, 'Selecione um pet valido.');
  if (!motivo) throw new ErroHttp(422, 'Informe o motivo.');
  const horario = validarHorario(body.data_hora);
  checarConflito(horario);
  try {
    const r = exec("INSERT INTO agendamento (pet_id, usuario_id, data_hora, motivo, status) VALUES (?,?,?,?, 'agendado')",
      pet_id, sessao.usuarioId, horario, motivo);
    resposta.status = 201;
    return { id: Number(r.lastInsertRowid), mensagem: 'Agendamento criado.' };
  } catch (e) {
    if (ehUnique(e)) throw new ErroHttp(409, 'Horario ja ocupado.');
    throw e;
  }
});

// REGRA: o usuario atualiza APENAS a data do agendamento (nenhum outro campo e alterado)
put('/api/agendamentos/:id', ({ params, body }) => {
  const id = Number(params.id);
  const atual = um('SELECT id, status FROM agendamento WHERE id = ?', id);
  if (!atual) throw new ErroHttp(404, 'Agendamento nao encontrado.');
  const horario = validarHorario(body.data_hora);
  if (atual.status !== 'cancelado') checarConflito(horario, id);
  try {
    exec('UPDATE agendamento SET data_hora = ? WHERE id = ?', horario, id);   // salva a alteracao no banco
  } catch (e) {
    if (ehUnique(e)) throw new ErroHttp(409, 'Horario ja ocupado.');
    throw e;
  }
  return { mensagem: 'Data do agendamento atualizada.' };
});

del('/api/agendamentos/:id', ({ params }) => {
  const r = exec('DELETE FROM agendamento WHERE id = ?', params.id);
  if (!r.changes) throw new ErroHttp(404, 'Agendamento nao encontrado.');
  return { mensagem: 'Agendamento excluido.' };
});
