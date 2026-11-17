# VetSAEP - Clinica Veterinaria (SAEP/SENAI)

HTML + CSS + JavaScript puros (frontend) e Node.js puro + SQLite (backend). Sem Express, sem npm install.

## Requisito
Node.js 22.13 ou superior.

## Como rodar
1. Backend: abra o terminal em `sistema/backend` e execute `npm start` (API em http://localhost:3000).
   O banco `saep.db` e criado sozinho a partir de `../../saep_db.sql`.
2. Frontend, opcao A (Live Server): abra a pasta `sistema/frontend` no VS Code, clique com o botao direito
   em `index.html` > "Open with Live Server".
   Frontend, opcao B: abra http://localhost:3000 (o backend tambem serve as paginas).
3. Entre com admin@vetsaep.com / admin123, ou crie sua conta na aba "Criar conta".

## Testes
Em `sistema/backend`: `npm test`

## Usuarios de teste
admin@vetsaep.com / admin123 | maria@vetsaep.com / maria123 | joao@vetsaep.com / joao123
