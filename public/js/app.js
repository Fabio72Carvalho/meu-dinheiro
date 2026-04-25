import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';

// Seleção de elementos da UI
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const btnCadastrar = document.getElementById('btn-cadastrar');
const btnLogin = document.getElementById('btn-login');
const btnSair = document.getElementById('btn-sair');
const mensagem = document.getElementById('mensagem');
const userInfo = document.getElementById('user-info');
const loginForm = document.getElementById('login-form');
const userEmailSpan = document.getElementById('user-email');

// Evento: Cadastrar
btnCadastrar.addEventListener('click', async () => {
    try {
        await cadastrarUsuario(emailInput.value, senhaInput.value);
        mensagem.innerText = "Usuário criado com sucesso!";
    } catch (error) {
        mensagem.innerText = "Erro ao cadastrar: " + error.message;
    }
});

// Evento: Login
btnLogin.addEventListener('click', async () => {
    try {
        await fazerLogin(emailInput.value, senhaInput.value);
        mensagem.innerText = "Login realizado!";
    } catch (error) {
        mensagem.innerText = "Erro ao entrar: " + error.message;
    }
});

// Evento: Logout
btnSair.addEventListener('click', async () => {
    await fazerLogout();
});

// Monitorar estado do usuário (Princípio de Segurança)
observarAutenticacao((user) => {
    if (user) {
        // Usuário logado
        loginForm.style.display = 'none';
        userInfo.style.display = 'block';
        userEmailSpan.innerText = user.email;
        console.log("Usuário logado ID:", user.uid);
    } else {
        // Usuário deslogado
        loginForm.style.display = 'block';
        userInfo.style.display = 'none';
        console.log("Nenhum usuário logado.");
    }
});