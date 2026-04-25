import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';
// --- ESTADO GLOBAL ---
let usuarioAtual = null;

// --- SELEÇÃO DE ELEMENTOS DA UI ---
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const btnCadastrar = document.getElementById('btn-cadastrar');
const btnLogin = document.getElementById('btn-login');
const btnSair = document.getElementById('btn-sair');
const mensagem = document.getElementById('mensagem');
const userInfo = document.getElementById('user-info');
const loginForm = document.getElementById('login-form');
const userEmailSpan = document.getElementById('user-email');

// --- MONITOR DE AUTENTICAÇÃO ---
observarAutenticacao((user) => {
    if (user) {
        usuarioAtual = user;
        // Prioriza o displayName, se não houver, usa o email
        const nomeParaExibir = user.displayName || user.email;
        document.getElementById('user-display-name').innerText = nomeParaExibir;
        loginForm.style.display = 'none';
        userInfo.style.display = 'block';
        // TODO provavelmente vai tirar:
        // if (secaoContas) secaoContas.style.display = 'block';
    } else {
        usuarioAtual = null;
        loginForm.style.display = 'block';
        userInfo.style.display = 'none';
        // TODO provavelmente vai tirar:
        // if (secaoContas) secaoContas.style.display = 'none';
        console.log("Nenhum usuário logado.");
    }
});

// --- EVENTOS DE AUTENTICAÇÃO ---
btnCadastrar.addEventListener('click', async () => {
    const nome = document.getElementById('nome').value; // Pega o nome
    try {
        await cadastrarUsuario(nome, emailInput.value, senhaInput.value);
        mensagem.innerText = "Usuário criado com sucesso!";
    } catch (error) {
        mensagem.innerText = "Erro ao cadastrar: " + error.message;
    }
});

btnLogin.addEventListener('click', async () => {
    try {
        await fazerLogin(emailInput.value, senhaInput.value);
        mensagem.innerText = "Login realizado!";
    } catch (error) {
        mensagem.innerText = "Erro ao entrar: " + error.message;
    }
});

btnSair.addEventListener('click', async () => {
    await fazerLogout();
});

let isRegistering = false;

function toggleForm() {
    const nameField = document.getElementById('name-field');
    const formTitle = document.getElementById('form-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const mainBtn = document.getElementById('main-btn');
    const switchBtn = document.getElementById('switch-btn');
    const forgotLink = document.getElementById('forgot-link');

    isRegistering = !isRegistering;

    if (isRegistering) {
        nameField.style.display = 'block';
        formTitle.innerText = 'Crie sua conta';
        formSubtitle.innerText = 'Comece a organizar suas finanças hoje';
        mainBtn.innerText = 'Finalizar Cadastro';
        switchBtn.innerText = 'Já tenho conta (Login)';
        forgotLink.style.visibility = 'hidden';
    } else {
        nameField.style.display = 'none';
        formTitle.innerText = 'Meu Dinheiro';
        formSubtitle.innerText = 'Acesse sua conta para continuar';
        mainBtn.innerText = 'Entrar';
        switchBtn.innerText = 'Cadastrar-me';
        forgotLink.style.visibility = 'visible';
    }
}