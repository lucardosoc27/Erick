'use strict';
/** Funcionalidade PRINCIPAL: painel com totais e proximos agendamentos. */
const { um, todos } = require('./db');
const { get } = require('./http');

const agoraTexto = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

get('/api/painel', () => ({
  totais: {
    tutores: um('SELECT COUNT(*) AS n FROM tutor').n,
    pets: um('SELECT COUNT(*) AS n FROM pet').n,
    agendamentos: um("SELECT COUNT(*) AS n FROM agendamento WHERE status = 'agendado'").n,
  },
  proximos: todos(`
    SELECT a.id, a.data_hora, a.motivo, p.nome AS pet, t.nome AS tutor
    FROM agendamento a JOIN pet p ON p.id = a.pet_id JOIN tutor t ON t.id = p.tutor_id
    WHERE a.status = 'agendado' AND a.data_hora >= ? ORDER BY a.data_hora LIMIT 5`, agoraTexto()),
}));
