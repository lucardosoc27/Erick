-- =====================================================
-- saep_db.sql  |  Clinica Veterinaria - SAEP (SENAI)
-- Criacao e populacao do banco (SQLite 3) - senhas com scrypt, CPF com AES-256-GCM
-- =====================================================
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS agendamento;
DROP TABLE IF EXISTS pet;
DROP TABLE IF EXISTS tutor;
DROP TABLE IF EXISTS usuario;

CREATE TABLE usuario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    senha_hash  TEXT NOT NULL,                 -- hash (scrypt) - nunca a senha
    perfil      TEXT NOT NULL DEFAULT 'atendente' CHECK (perfil IN ('admin','atendente')),
    criado_em   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tutor (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT NOT NULL,
    cpf_cifrado  TEXT NOT NULL,                -- CPF cifrado (Fernet/AES) - LGPD
    cpf_hash     TEXT NOT NULL UNIQUE,         -- SHA-256, evita CPF duplicado
    telefone     TEXT NOT NULL,
    email        TEXT,
    endereco     TEXT,
    criado_em    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pet (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    especie     TEXT NOT NULL,
    raca        TEXT,
    data_nasc   TEXT,
    peso_kg     REAL CHECK (peso_kg IS NULL OR peso_kg > 0),
    tutor_id    INTEGER NOT NULL,              -- pet SEMPRE tem tutor
    FOREIGN KEY (tutor_id) REFERENCES tutor(id) ON DELETE RESTRICT
);

CREATE TABLE agendamento (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id      INTEGER NOT NULL,
    usuario_id  INTEGER NOT NULL,              -- quem registrou
    data_hora   TEXT NOT NULL,                 -- 'YYYY-MM-DD HH:MM'
    motivo      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','realizado','cancelado')),
    FOREIGN KEY (pet_id)     REFERENCES pet(id)     ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT
);
-- Impede dois agendamentos ativos no mesmo horario
CREATE UNIQUE INDEX ux_agendamento_horario ON agendamento(data_hora) WHERE status <> 'cancelado';

-- ----- Dados iniciais (3 registros por tabela) -----
INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES
('Administrador','admin@vetsaep.com','scrypt$379413cbd79befa9f22c0841d1e8936b$a161e4e6f803fc96cc528fe6fdf242f9270294f4729c3aca8bcee794712111fcd49dda99c755c1161f735c6c403c381736500272f6d953e95afeed6846217b44','admin'),
('Atendente Maria','maria@vetsaep.com','scrypt$6545e0e5c6478ee876bcf1f2a1b280bc$f07643c2f164c2fd0e3d2e7772a0094cb0b18d1c04cb353ab16f2df588f6cb0fa8c3cf0e75ebcffadf476377df8df54f7ed984d50277d9cb3de166c9f55722cf','atendente'),
('Atendente João','joao@vetsaep.com','scrypt$09d82a0ed49a0d28239be75b379cc51e$6e2002af76f8314c0ef5c31034d85ed66f750d5641d64ae27ba6c73726dff5cac2981e2a83054a55c94167b482e7e00d6de6a415c754a1c866a9de2b3dd16b28','atendente');

INSERT INTO tutor (nome, cpf_cifrado, cpf_hash, telefone, email, endereco) VALUES
('Carlos Almeida','TnjWRVgqNXVEVbzf.Yna1G+r0AemgqAVFfEzfzw==.qg9OG/6TlqJCsVM=','6ce0b726c957d167b1cc10fab04184f44ddf128391112203831f4dfcc3ed7437','(11) 91234-5678','carlos@email.com','Rua das Flores, 100'),
('Fernanda Souza','wgaP2oRSPNxiWDeJ.yr93VAsf0yBjVgfR5fqvuA==.kO/z4QdZ7Hnp9cU=','8b0afe26d17a7b4e56374ab8abcb53ca4e812478d961e4ad03dbe6fb7296595a','(21) 99876-5432','fernanda@email.com','Av. Brasil, 2500'),
('Roberto Lima','SajPC0s8K379L3cE.uzlm6L9frURHFfNZnryFlA==.kDl6keeSzAGh9mI=','5788c02146d78056e82c719234e232de163dde0891427bb615b1a6e0eb1d89aa','(31) 98888-7777','roberto@email.com','Rua Minas Gerais, 45');

INSERT INTO pet (nome, especie, raca, data_nasc, peso_kg, tutor_id) VALUES
('Rex','Cachorro','Labrador','2020-03-15',28.5,1),
('Mimi','Gato','Siames','2021-07-02',4.2,2),
('Thor','Cachorro','Bulldog','2019-11-20',22.0,3);

INSERT INTO agendamento (pet_id, usuario_id, data_hora, motivo, status) VALUES
(1,2,'2026-11-20 09:00','Vacinacao anual','agendado'),
(2,2,'2026-11-20 10:00','Consulta de rotina','agendado'),
(3,3,'2026-11-21 14:30','Check-up cardiaco','agendado');
