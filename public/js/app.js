import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';
import { getRequiredElement, alternarTelas } from './ui.js';

// --- SELEÇÃO DE ELEMENTOS DA UI ---
const mensagem = getRequiredElement('mensagem');
const loginForm = getRequiredElement('auth-form');

// LISTENER PARA SUBMISSÃO DO FORMULÁRIO
loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    // 1. Captura de elementos e valores iniciais
    const email = /** @type {HTMLInputElement} */ (getRequiredElement('email')).value;
    const senhaInput = /** @type {HTMLInputElement} */ (getRequiredElement('senha'));
    const mode = loginForm.getAttribute('data-mode');
    const mainBtn = getRequiredElement('main-btn');

    // 2. Inicia o estado de carregamento
    mainBtn.classList.add('btn-loading');
    mensagem.innerText = ""; // Limpa mensagens anteriores

    try {
        if (mode === 'signup') {
            const nome = /** @type {HTMLInputElement} */ (getRequiredElement('nome')).value;
            await cadastrarUsuario(nome, email, senhaInput.value);
            mensagem.innerText = "Usuário criado com sucesso!";
        } else {
            await fazerLogin(email, senhaInput.value);
            mensagem.innerText = "Login realizado!";
        }
    } catch (error) {
        // 3. Tratamento de erro centralizado
        console.error("Erro na autenticação:", error);

        if (error instanceof Error) {
            mensagem.innerText = `Erro: ${error.message}`;
        } else {
            mensagem.innerText = "Ocorreu um erro inesperado. Tente novamente.";
        }
    } finally {
        // 4. Finalização (Sempre executa, sucesso ou erro)
        senhaInput.value = ''; // Limpa senha por segurança
        mainBtn.classList.remove('btn-loading'); // Desativa o spinner
    }
});

const switchBtn = getRequiredElement('switch-btn');
switchBtn.addEventListener('click', toggleForm);
function toggleForm() {
    const nameField = getRequiredElement('name-field');
    const formTitle = getRequiredElement('form-title');
    const mainBtn = getRequiredElement('main-btn');

    // Texto do botão de alternância
    const btnText = mainBtn.querySelector('.btn-text');

    // Pega o modo atual direto do atributo data
    const currentMode = loginForm.getAttribute('data-mode');

    if (currentMode === 'login') {
        loginForm.setAttribute('data-mode', 'signup');
        nameField.style.display = 'block';
        formTitle.innerText = 'Crie sua conta';

        if (btnText) /** @type {HTMLButtonElement} */ (btnText).innerText = 'Finalizar Cadastro';

        switchBtn.innerText = 'Já tenho conta (Login)';
         /** @type {HTMLInputElement} */ (getRequiredElement('nome')).required = true; // Torna o nome obrigatório
    } else {
        loginForm.setAttribute('data-mode', 'login');
        nameField.style.display = 'none';
        formTitle.innerText = 'Meu Dinheiro';

        if (btnText) /** @type {HTMLButtonElement} */ (btnText).innerText = 'Entrar';

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
        const nomeExibicao = getRequiredElement('user-display-name');
        nomeExibicao.innerText = user.displayName || user.email;
        alternarTelas(true);
    } else {
        alternarTelas(false);
    }
});

// --- EVENTO DE SAÍDA ---
const btnSair = getRequiredElement('btn-sair');
if (btnSair) {
    btnSair.addEventListener('click', async () => {
        try {
            await fazerLogout();
            // O observarAutenticacao cuidará de voltar para a tela de login
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    });
}