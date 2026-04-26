import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';
import { getRequiredElement } from './ui.js';

// --- ESTADO GLOBAL ---
let usuarioAtual = null;

// --- SELEÇÃO DE ELEMENTOS DA UI ---
const btnSair = getRequiredElement('btn-sair');
const mensagem = getRequiredElement('mensagem');
const userInfo = getRequiredElement('user-info');
const loginForm = getRequiredElement('auth-form');

// LISTENER PARA SUBMISSÃO DO FORMULÁRIO (CASO ESTEJA USANDO UM FORMULÁRIO)
loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const mode = loginForm.getAttribute('data-mode');
    const email = /** @type {HTMLInputElement} */ (getRequiredElement('email')).value;
    const senha = /** @type {HTMLInputElement} */ (getRequiredElement('senha')).value;

    if (mode === 'signup') {
        const nome = /** @type {HTMLInputElement} */ (getRequiredElement('nome')).value;
        console.log("LOG: Processando novo cadastro...");
        try {
            await cadastrarUsuario(nome, email, senha);
            mensagem.innerText = "Usuário criado com sucesso!";
        } catch (error) {
            if (error instanceof Error) {
                mensagem.innerText = "Erro ao cadastrar: " + error.message;
            } else {
                mensagem.innerText = "Erro ao cadastrar: " + String(error);
            }
        }
    } else {
        console.log("LOG: Processando login...");
        try {
            await fazerLogin(email, senha);
            mensagem.innerText = "Login realizado!";
        } catch (error) {
            if (error instanceof Error) {
                mensagem.innerText = "Erro ao entrar: " + error.message;
            } else {
                mensagem.innerText = "Erro ao entrar: " + String(error);
            }
        }
    }
});

// Localize o botão pelo ID
const switchBtn = getRequiredElement('switch-btn');

// Adicione o listener (remova a chamada de toggleForm do HTML)
switchBtn.addEventListener('click', toggleForm);
function toggleForm() {
    // REVIEW
    // const form = getRequiredElement('auth-form');
    const nameField = getRequiredElement('name-field');
    const formTitle = getRequiredElement('form-title');
    const mainBtn = getRequiredElement('main-btn');
    // const switchBtn = getRequiredElement('switch-btn');

    // Pega o modo atual direto do atributo data
    const currentMode = loginForm.getAttribute('data-mode');

    if (currentMode === 'login') {
        console.log("AGORA O BOTÃO É CADASTRO");
        loginForm.setAttribute('data-mode', 'signup');
        nameField.style.display = 'block';
        formTitle.innerText = 'Crie sua conta';
        mainBtn.innerText = 'Finalizar Cadastro';
        switchBtn.innerText = 'Já tenho conta (Login)';
         /** @type {HTMLInputElement} */ (getRequiredElement('nome')).required = true; // Torna o nome obrigatório
    } else {
        console.log("AGORA O BOTÃO É LOGIN");
        loginForm.setAttribute('data-mode', 'login');
        nameField.style.display = 'none';
        formTitle.innerText = 'Meu Dinheiro';
        mainBtn.innerText = 'Entrar';
        switchBtn.innerText = 'Cadastrar-me';
        /** @type {HTMLInputElement} */ (getRequiredElement('nome')).required = false; // Remove obrigatoriedade
    }
}

// --- MONITOR DE AUTENTICAÇÃO ---
/**
 * @param {any} user
 */
observarAutenticacao((user) => {
    if (user) {
        usuarioAtual = user;
        // Prioriza o displayName, se não houver, usa o email
        const nomeParaExibir = user.displayName || user.email;
        /** @type {HTMLParagraphElement} */ (getRequiredElement('user-display-name')).innerText = nomeParaExibir;
        loginForm.style.display = 'none';
        userInfo.style.display = 'block';
    } else {
        usuarioAtual = null;
        loginForm.style.display = 'block';
        userInfo.style.display = 'none';
        console.log("Nenhum usuário logado.");
    }
});

btnSair.addEventListener('click', async () => {
    await fazerLogout();
});