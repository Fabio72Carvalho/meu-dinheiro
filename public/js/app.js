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
const loginForm = document.getElementById('auth-form');
const userEmailSpan = document.getElementById('user-email');

// LISTENER PARA SUBMISSÃO DO FORMULÁRIO (CASO ESTEJA USANDO UM FORMULÁRIO)
loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const mode = loginForm.getAttribute('data-mode');
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    if (mode === 'signup') {
        const nome = document.getElementById('nome').value;
        console.log("LOG: Processando novo cadastro...");
        try {
            await cadastrarUsuario(nome, email, senha); 
            mensagem.innerText = "Usuário criado com sucesso!";
        } catch (error) {
            mensagem.innerText = "Erro ao cadastrar: " + error.message;
        }
    } else {
        console.log("LOG: Processando login...");
        try {
            await fazerLogin(email, senha);
            mensagem.innerText = "Login realizado!";
        } catch (error) {
            mensagem.innerText = "Erro ao entrar: " + error.message;
        }
    }
});

// Localize o botão pelo ID
const switchBtn = document.getElementById('switch-btn');

// Adicione o listener (remova a chamada de toggleForm do HTML)
switchBtn.addEventListener('click', toggleForm);
function toggleForm() {
    // REVIEW
    // const form = document.getElementById('auth-form');
    const nameField = document.getElementById('name-field');
    const formTitle = document.getElementById('form-title');
    const mainBtn = document.getElementById('main-btn');
    // const switchBtn = document.getElementById('switch-btn');

    // Pega o modo atual direto do atributo data
    const currentMode = loginForm.getAttribute('data-mode');

    if (currentMode === 'login') {
        console.log("AGORA O BOTÃO É CADASTRO");
        loginForm.setAttribute('data-mode', 'signup');
        nameField.style.display = 'block';
        formTitle.innerText = 'Crie sua conta';
        mainBtn.innerText = 'Finalizar Cadastro';
        switchBtn.innerText = 'Já tenho conta (Login)';
        document.getElementById('nome').required = true; // Torna o nome obrigatório
    } else {
        console.log("AGORA O BOTÃO É LOGIN");
        loginForm.setAttribute('data-mode', 'login');
        nameField.style.display = 'none';
        formTitle.innerText = 'Meu Dinheiro';
        mainBtn.innerText = 'Entrar';
        switchBtn.innerText = 'Cadastrar-me';
        document.getElementById('nome').required = false; // Remove obrigatoriedade
    }
}

// --- MONITOR DE AUTENTICAÇÃO ---
observarAutenticacao((user) => {
    if (user) {

        console.log("ENTROU AQUI NO IF...");

        usuarioAtual = user;
        // Prioriza o displayName, se não houver, usa o email
        const nomeParaExibir = user.displayName || user.email;
        document.getElementById('user-display-name').innerText = nomeParaExibir;
        loginForm.style.display = 'none';
        userInfo.style.display = 'block';
        // TODO provavelmente vai tirar:
        // if (secaoContas) secaoContas.style.display = 'block';
    } else {

        console.log("ENTROU AQUI NO ELSE...");

        usuarioAtual = null;
        loginForm.style.display = 'block';
        userInfo.style.display = 'none';
        // TODO provavelmente vai tirar:
        // if (secaoContas) secaoContas.style.display = 'none';
        console.log("Nenhum usuário logado.");
    }
});

// --- EVENTOS DE AUTENTICAÇÃO ---
// btnCadastrar.addEventListener('click', async () => {

//     console.log("Clicou em cadastrar...");

//     const nome = document.getElementById('nome').value; // Pega o nome
//     try {
//         await cadastrarUsuario(nome, emailInput.value, senhaInput.value);
//         mensagem.innerText = "Usuário criado com sucesso!";
//     } catch (error) {
//         mensagem.innerText = "Erro ao cadastrar: " + error.message;
//     }
// });

// btnLogin.addEventListener('click', async () => {

//     console.log("Clicou em login...");

//     try {
//         await fazerLogin(emailInput.value, senhaInput.value);
//         mensagem.innerText = "Login realizado!";
//     } catch (error) {
//         mensagem.innerText = "Erro ao entrar: " + error.message;
//     }
// });

btnSair.addEventListener('click', async () => {
    await fazerLogout();
});