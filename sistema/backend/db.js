'use strict';
/** Acesso ao banco SQLite (modulo nativo node:sqlite). Cria o banco a partir de saep_db.sql. */
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const existia = fs.existsSync(config.DB_PATH);
const db = new DatabaseSync(config.DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

if (!existia) {
  db.exec(fs.readFileSync(config.SQL_PATH, 'utf8'));
  db.exec('PRAGMA foreign_keys = ON');
}

const todos = (sql, ...p) => db.prepare(sql).all(...p);
const um = (sql, ...p) => db.prepare(sql).get(...p);
const exec = (sql, ...p) => db.prepare(sql).run(...p);

/** Traduz erros de restricao do SQLite (FK / UNIQUE) */
const ehFK = (e) => /FOREIGN KEY/i.test(e?.message || '');
const ehUnique = (e) => /UNIQUE/i.test(e?.message || '');

module.exports = { db, todos, um, exec, ehFK, ehUnique };
