'use strict';
const path = require('node:path');

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  DB_PATH: process.env.SAEP_DB || path.join(__dirname, 'saep.db'),
  SQL_PATH: path.join(__dirname, '..', '..', 'saep_db.sql'),   // script do banco (raiz do projeto)
  FRONTEND_DIR: path.join(__dirname, '..', 'frontend'),
  // REGRA: login com tempo de expiracao (minutos de inatividade)
  SESSAO_MIN: Number(process.env.SAEP_SESSAO_MIN || 15),
  // Segredo que deriva a chave de criptografia do CPF (LGPD). Em producao: variavel de ambiente.
  CHAVE_SEGREDO: process.env.SAEP_CHAVE || 'chave-de-desenvolvimento-saep',
  LOGIN_MAX_TENTATIVAS: 5,
  LOGIN_BLOQUEIO_MIN: 1,
};
