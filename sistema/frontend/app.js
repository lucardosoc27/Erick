'use strict';
/* ==========================================================================
   app.js - toda a logica do frontend (Vanilla JS + Fetch API)
   Paginas: index (login/cadastro), dashboard, tutores, pets, agendamentos.
   ========================================================================== */

// ---------- Configuracao ----------
// Se a pagina foi aberta pelo proprio backend (porta 3000), usa caminho relativo;
// se foi aberta pelo Live Server (ex.: 127.0.0.1:5500), chama o backend em localhost:3000 (CORS liberado).
const PORTA_BACKEND = 3000;
const API = location.port === String(PORTA_BACKEND) ? '' : `http://localhost:${PORTA_BACKEND}`;

// ---------- Utilitarios ----------
const $ = (seletor, raiz = document) => raiz.querySelector(seletor);

// Protecao contra XSS: todo texto vindo do servidor passa por esc() antes de entrar no HTML
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let temporizadorAviso;
function aviso(mensagem, tipo = 'ok') {
  const t = $('#toast');
  t.textContent = mensagem;
  t.className = `toast ${tipo}`;
  t.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (t.hidden = true), tipo === 'erro' ? 5000 : 2800);
}

const dadosDoForm = (form) => Object.fromEntries(new FormData(form).entries());

function formatarDataHora(texto) {                 // 'YYYY-MM-DD HH:MM' -> 'DD/MM/YYYY HH:MM'
  const [d, h] = String(texto).split(' ');
  const [a, m, di] = (d || '').split('-');
  return `${di}/${m}/${a} ${h || ''}`.trim();
}

// ---------- Sessao no navegador (localStorage guarda o token e o nome do usuario) ----------
const sessaoLocal = {
  token: () => localStorage.getItem('saep_token'),
  nome: () => localStorage.getItem('saep_nome'),
  salvar(token, nome) { localStorage.setItem('saep_token', token); localStorage.setItem('saep_nome', nome); },
  limpar() { localStorage.removeItem('saep_token'); localStorage.removeItem('saep_nome'); },
};

// ---------- Cliente da API (Fetch) ----------
async function api(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {} };
  const token = sessaoLocal.token();
  if (token) opcoes.headers.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  let resp;
  try { resp = await fetch(API + caminho, opcoes); }
  catch { throw new Error('Nao foi possivel conectar ao servidor. Ele esta rodando (npm start)?'); }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // REGRA: sessao expirada -> volta para o login
    if (resp.status === 401 && !caminho.startsWith('/api/login')) {
      sessaoLocal.limpar();
      location.href = 'index.html?expirou=1';
    }
    throw new Error(dados.erro || `Erro ${resp.status}`);
  }
  return dados;
}

// ==========================================================================
// PAGINA: LOGIN + CADASTRO DE USUARIO (index.html)
// ==========================================================================
function paginaLogin() {
  const formLogin = $('#form-login'), formCad = $('#form-cadastro');
  const abaLogin = $('#aba-login'), abaCad = $('#aba-cadastro');

  const mostrarAba = (cadastro) => {
    formLogin.hidden = cadastro; formCad.hidden = !cadastro;
    abaLogin.classList.toggle('ativa', !cadastro); abaCad.classList.toggle('ativa', cadastro);
    $('#erro-login').hidden = true; $('#erro-cadastro').hidden = true;
  };
  abaLogin.onclick = () => mostrarAba(false);
  abaCad.onclick = () => mostrarAba(true);

  // Ja esta logado? vai direto para o dashboard
  if (sessaoLocal.token()) {
    api('GET', '/api/sessao').then(() => (location.href = 'dashboard.html')).catch(() => sessaoLocal.limpar());
  }
  if (new URLSearchParams(location.search).has('expirou')) {
    const av = $('#aviso'); av.textContent = 'Sua sessão expirou. Faça login novamente.'; av.hidden = false;
  }

  // LOGIN: mostra mensagem de erro se as credenciais estiverem erradas
  formLogin.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = $('#erro-login'), botao = $('button[type=submit]', formLogin);
    erro.hidden = true; botao.disabled = true;
    try {
      const r = await api('POST', '/api/login', dadosDoForm(formLogin));
      sessaoLocal.salvar(r.token, r.nome);               // guarda o usuario logado
      location.href = 'dashboard.html';
    } catch (e) {
      erro.textContent = e.message; erro.hidden = false;
    } finally { botao.disabled = false; }
  });

  // CADASTRO DE USUARIO
  formCad.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = $('#erro-cadastro'), botao = $('button[type=submit]', formCad);
    const dados = dadosDoForm(formCad);
    erro.hidden = true;
    if (dados.senha !== dados.senha2) { erro.textContent = 'As senhas nao conferem.'; erro.hidden = false; return; }
    botao.disabled = true;
    try {
      const r = await api('POST', '/api/cadastro', { nome: dados.nome, email: dados.email, senha: dados.senha });
      mostrarAba(false);
      $('#login-email').value = dados.email.trim().toLowerCase();
      formCad.reset();
      aviso(r.mensagem);
      $('#login-senha').focus();
    } catch (e) {
      erro.textContent = e.message; erro.hidden = false;
    } finally { botao.disabled = false; }
  });
}

// ==========================================================================
// PAGINAS INTERNAS: protecao de acesso, nome do usuario e logout
// ==========================================================================
function iniciarPaginaInterna() {
  if (!sessaoLocal.token()) { location.href = 'index.html'; return false; }   // sem login -> volta ao index
  $('#usuario-nome').textContent = sessaoLocal.nome() || '';                  // nome do usuario logado
  $('#btn-sair').addEventListener('click', async () => {                      // botao de logout
    await api('POST', '/api/logout').catch(() => {});
    sessaoLocal.limpar();
    location.href = 'index.html';
  });
  // consulta a sessao a cada 30 s (sem renova-la) para detectar a expiracao por inatividade
  setInterval(() => api('GET', '/api/sessao').catch(() => {}), 30_000);
  return true;
}

// ==========================================================================
// PAGINA: DASHBOARD
// ==========================================================================
async function paginaDashboard() {
  $('#boas-vindas-nome').textContent = sessaoLocal.nome() || '';
  const { totais, proximos } = await api('GET', '/api/painel');
  $('#n-tutores').textContent = totais.tutores;
  $('#n-pets').textContent = totais.pets;
  $('#n-agend').textContent = totais.agendamentos;
  $('#proximos').innerHTML = proximos.length ? proximos.map((a) => `
    <tr><td>${esc(formatarDataHora(a.data_hora))}</td><td>${esc(a.pet)}</td><td>${esc(a.tutor)}</td><td>${esc(a.motivo)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="vazio">Nenhum agendamento futuro.</td></tr>';
}

// ==========================================================================
// PAGINA: TUTORES (busca + cadastro + edicao + exclusao)
// ==========================================================================
async function paginaTutores() {
  const area = $('#area-form');

  async function carregar(q = '') {
    const tutores = await api('GET', `/api/tutores?q=${encodeURIComponent(q)}`);   // BUSCA: o servidor filtra por nome
    $('#lista').innerHTML = tutores.length ? tutores.map((t) => `
      <tr><td>${esc(t.nome)}</td><td>${esc(t.cpf)}</td><td>${esc(t.telefone)}</td><td>${esc(t.email)}</td>
        <td class="acoes">
          <button class="btn sec pequeno" data-acao="editar" data-id="${t.id}">Editar</button>
          <button class="btn perigo pequeno" data-acao="excluir" data-id="${t.id}">Excluir</button>
        </td></tr>`).join('') : '<tr><td colspan="5" class="vazio">Nenhum tutor encontrado.</td></tr>';
  }

  function formulario(t = {}) {
    area.innerHTML = `
      <form class="card" id="form-tutor">
        <h3>${t.id ? 'Editar' : 'Novo'} tutor</h3>
        <div class="grade-form">
          <div><label>Nome</label><input name="nome" value="${esc(t.nome)}" required></div>
          <div><label>CPF</label><input name="cpf" value="${esc(t.cpf)}" placeholder="000.000.000-00" required inputmode="numeric"></div>
          <div><label>Telefone</label><input name="telefone" value="${esc(t.telefone)}" required></div>
          <div><label>E-mail</label><input name="email" type="email" value="${esc(t.email)}"></div>
          <div><label>Endereço</label><input name="endereco" value="${esc(t.endereco)}"></div>
        </div>
        <div class="linha-botoes"><button class="btn" type="submit">Salvar</button><button type="button" class="btn sec" id="cancelar">Cancelar</button></div>
      </form>`;
    $('#cancelar').onclick = () => (area.innerHTML = '');
    $('#form-tutor').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const dados = dadosDoForm(ev.target);
        // EDICAO: se ja existe id, faz PUT (atualiza no banco); senao POST (cadastra)
        const r = t.id ? await api('PUT', `/api/tutores/${t.id}`, dados) : await api('POST', '/api/tutores', dados);
        aviso(r.mensagem);
        area.innerHTML = '';
        carregar($('[name=q]').value);
      } catch (e) { aviso(e.message, 'erro'); }
    };
    $('#form-tutor [name=nome]').focus();
  }

  $('#btn-novo').onclick = () => formulario();
  $('#form-busca').onsubmit = (ev) => { ev.preventDefault(); carregar(dadosDoForm(ev.target).q.trim()); };
  $('#lista').onclick = async (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b) return;
    try {
      if (b.dataset.acao === 'editar') formulario(await api('GET', `/api/tutores/${b.dataset.id}`));
      else if (confirm('Excluir este tutor?')) {
        aviso((await api('DELETE', `/api/tutores/${b.dataset.id}`)).mensagem);
        carregar($('[name=q]').value);
      }
    } catch (e) { aviso(e.message, 'erro'); }
  };
  await carregar();
}

// ==========================================================================
// PAGINA: PETS (todo pet precisa de um tutor)
// ==========================================================================
async function paginaPets() {
  const area = $('#area-form');

  async function carregar(q = '') {
    const pets = await api('GET', `/api/pets?q=${encodeURIComponent(q)}`);
    $('#lista').innerHTML = pets.length ? pets.map((p) => `
      <tr><td>${esc(p.nome)}</td><td>${esc(p.especie)}</td><td>${esc(p.raca || '-')}</td><td>${esc(p.peso_kg ?? '-')}</td><td>${esc(p.tutor)}</td>
        <td class="acoes">
          <button class="btn sec pequeno" data-acao="editar" data-id="${p.id}">Editar</button>
          <button class="btn perigo pequeno" data-acao="excluir" data-id="${p.id}">Excluir</button>
        </td></tr>`).join('') : '<tr><td colspan="6" class="vazio">Nenhum pet encontrado.</td></tr>';
  }

  async function formulario(p = {}) {
    const tutores = await api('GET', '/api/tutores');
    area.innerHTML = `
      <form class="card" id="form-pet">
        <h3>${p.id ? 'Editar' : 'Novo'} pet</h3>
        <div class="grade-form">
          <!-- REGRA: o tutor e obrigatorio (select com os tutores cadastrados) -->
          <div><label>Tutor (obrigatório)</label><select name="tutor_id" required>
            <option value="">Selecione...</option>
            ${tutores.map((t) => `<option value="${t.id}" ${p.tutor_id === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}
          </select></div>
          <div><label>Nome</label><input name="nome" value="${esc(p.nome)}" required></div>
          <div><label>Espécie</label><input name="especie" value="${esc(p.especie)}" required></div>
          <div><label>Raça</label><input name="raca" value="${esc(p.raca)}"></div>
          <div><label>Nascimento</label><input type="date" name="data_nasc" value="${esc(p.data_nasc)}"></div>
          <div><label>Peso (kg)</label><input name="peso_kg" value="${esc(p.peso_kg)}" inputmode="decimal"></div>
        </div>
        <div class="linha-botoes"><button class="btn" type="submit">Salvar</button><button type="button" class="btn sec" id="cancelar">Cancelar</button></div>
      </form>`;
    $('#cancelar').onclick = () => (area.innerHTML = '');
    $('#form-pet').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const dados = dadosDoForm(ev.target);
        const r = p.id ? await api('PUT', `/api/pets/${p.id}`, dados) : await api('POST', '/api/pets', dados);
        aviso(r.mensagem);
        area.innerHTML = '';
        carregar($('[name=q]').value);
      } catch (e) { aviso(e.message, 'erro'); }
    };
  }

  $('#btn-novo').onclick = () => formulario().catch((e) => aviso(e.message, 'erro'));
  $('#form-busca').onsubmit = (ev) => { ev.preventDefault(); carregar(dadosDoForm(ev.target).q.trim()); };
  $('#lista').onclick = async (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b) return;
    try {
      if (b.dataset.acao === 'editar') await formulario(await api('GET', `/api/pets/${b.dataset.id}`));
      else if (confirm('Excluir este pet?')) {
        aviso((await api('DELETE', `/api/pets/${b.dataset.id}`)).mensagem);
        carregar($('[name=q]').value);
      }
    } catch (e) { aviso(e.message, 'erro'); }
  };
  await carregar();
}

// ==========================================================================
// PAGINA: AGENDAMENTOS (lista ordenada por data; edicao so da data)
// ==========================================================================
async function paginaAgendamentos() {
  const area = $('#area-form');

  async function carregar() {
    // O servidor ja devolve ordenado por data (ORDER BY a.data_hora) com dados do agendamento + pet + tutor
    const ags = await api('GET', '/api/agendamentos');
    $('#lista').innerHTML = ags.length ? ags.map((a) => `
      <tr><td>${esc(formatarDataHora(a.data_hora))}</td><td>${esc(a.motivo)}</td>
        <td><span class="etiqueta ${esc(a.status)}">${esc(a.status)}</span></td>
        <td>${esc(a.pet)}<small>${esc(a.especie)}${a.raca ? ' · ' + esc(a.raca) : ''}</small></td>
        <td>${esc(a.tutor)}<small>${esc(a.tutor_telefone)}</small></td>
        <td class="acoes">
          <button class="btn sec pequeno" data-acao="editar" data-id="${a.id}">Alterar data</button>
          <button class="btn perigo pequeno" data-acao="excluir" data-id="${a.id}">Excluir</button>
        </td></tr>`).join('') : '<tr><td colspan="6" class="vazio">Nenhum agendamento.</td></tr>';
  }

  async function formularioNovo() {
    const pets = await api('GET', '/api/pets');
    area.innerHTML = `
      <form class="card" id="form-ag">
        <h3>Novo agendamento</h3>
        <div class="grade-form">
          <div><label>Pet</label><select name="pet_id" required><option value="">Selecione...</option>
            ${pets.map((p) => `<option value="${p.id}">${esc(p.nome)} (${esc(p.tutor)})</option>`).join('')}
          </select></div>
          <div><label>Data e hora</label><input type="datetime-local" name="data_hora" required></div>
          <div><label>Motivo</label><input name="motivo" required></div>
        </div>
        <div class="linha-botoes"><button class="btn" type="submit">Salvar</button><button type="button" class="btn sec" id="cancelar">Cancelar</button></div>
      </form>`;
    $('#cancelar').onclick = () => (area.innerHTML = '');
    $('#form-ag').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        aviso((await api('POST', '/api/agendamentos', dadosDoForm(ev.target))).mensagem);
        area.innerHTML = '';
        carregar();
      } catch (e) { aviso(e.message, 'erro'); }
    };
  }

  // REGRA: a edicao altera APENAS a data do agendamento
  async function formularioData(a) {
    area.innerHTML = `
      <form class="card" id="form-data">
        <h3>Alterar data do agendamento</h3>
        <p class="info"><strong>Pet:</strong> ${esc(a.pet)} &nbsp; <strong>Tutor:</strong> ${esc(a.tutor)} &nbsp; <strong>Motivo:</strong> ${esc(a.motivo)}</p>
        <label>Nova data e hora</label>
        <input type="datetime-local" name="data_hora" value="${esc(a.data_hora)}" required>
        <div class="linha-botoes"><button class="btn" type="submit">Salvar data</button><button type="button" class="btn sec" id="cancelar">Cancelar</button></div>
      </form>`;
    $('#cancelar').onclick = () => (area.innerHTML = '');
    $('#form-data').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        aviso((await api('PUT', `/api/agendamentos/${a.id}`, { data_hora: dadosDoForm(ev.target).data_hora })).mensagem);
        area.innerHTML = '';
        carregar();
      } catch (e) { aviso(e.message, 'erro'); }
    };
    area.scrollIntoView({ behavior: 'smooth' });
  }

  $('#btn-novo').onclick = () => formularioNovo().catch((e) => aviso(e.message, 'erro'));
  $('#lista').onclick = async (ev) => {
    const b = ev.target.closest('button[data-acao]');
    if (!b) return;
    try {
      if (b.dataset.acao === 'editar') await formularioData(await api('GET', `/api/agendamentos/${b.dataset.id}`));
      else if (confirm('Excluir este agendamento?')) {
        aviso((await api('DELETE', `/api/agendamentos/${b.dataset.id}`)).mensagem);
        carregar();
      }
    } catch (e) { aviso(e.message, 'erro'); }
  };
  await carregar();
}

// ---------- Inicializacao: cada pagina informa o seu nome em <body data-pagina="..."> ----------
document.addEventListener('DOMContentLoaded', async () => {
  const pagina = document.body.dataset.pagina;
  if (pagina === 'login') return paginaLogin();
  if (!iniciarPaginaInterna()) return;
  const paginas = { dashboard: paginaDashboard, tutores: paginaTutores, pets: paginaPets, agendamentos: paginaAgendamentos };
  try { await paginas[pagina]?.(); } catch (e) { aviso(e.message, 'erro'); }
});
