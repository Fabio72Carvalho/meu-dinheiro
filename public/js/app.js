import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';
import { getRequiredElement, alternarTelas, renderizarContas, renderizarCategorias, mostrarTelaLogin, mostrarTelaApp, atualizarSelects, renderizarTransacoes } from './ui.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { escutarContas, escutarCategorias, escutarTransacoes, salvarConta, salvarCategoria, salvarTransacao } from './db.js';


// --- SELEÇÃO DE ELEMENTOS DA UI ---
const mensagem = getRequiredElement('mensagem');
const loginForm = getRequiredElement('auth-form');
// --- LÓGICA DO MODAL DE CONTA ---
const modalConta = document.getElementById('modal-conta');
const btnAbrirModal = document.getElementById('btn-nova-conta');
const btnFecharModal = document.getElementById('btn-fechar-modal-conta');
const formConta = document.getElementById('form-conta');

let unsubscribeContas = null;
let unsubscribeCategorias = null;
let unsubscribeTransacoes;

let contasGlobais = [];
let categoriasGlobais = [];
let transacoesGlobais = [];

onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- CASO: USUÁRIO LOGADO ---
        console.log("Usuário logado:", user.uid);
        mostrarTelaApp(user); // Troca a UI para a tela principal

        // 1. Iniciamos os ouvintes em tempo real
        // Guardamos o retorno nas variáveis 'unsubscribe' para poder desligar depois
        unsubscribeContas = escutarContas(user.uid, (contas) => {
            contasGlobais = contas;
            renderizarContas(contas);
            atualizarSelects(contasGlobais, categoriasGlobais);
        });

        unsubscribeCategorias = escutarCategorias(user.uid, (categorias) => {
            categoriasGlobais = categorias;
            renderizarCategorias(categorias);
            atualizarSelects(contasGlobais, categoriasGlobais);
        });

        unsubscribeTransacoes = escutarTransacoes(user.uid, (transacoes) => {
            transacoesGlobais = transacoes; // Guarda na global igual às outras
            renderizarTransacoes(transacoes); // Desenha a tabela
            // Se você tiver algum resumo de saldo total na tela principal, 
            // poderia chamar uma função de atualização aqui também.
        });

    } else {
        // --- CASO: USUÁRIO DESLOGADO (O "ESTRANHO" ELSE) ---
        console.log("Nenhum usuário logado.");

        // 1. IMPORTANTÍSSIMO: Parar de ouvir o banco de dados
        // Se não fizermos isso, o app continua tentando ler dados mesmo deslogado
        if (unsubscribeContas) unsubscribeContas();
        if (unsubscribeCategorias) unsubscribeCategorias();

        // 2. Limpar os dados globais para não sobrar rastro do usuário anterior
        contasGlobais = [];
        categoriasGlobais = [];

        // 3. Voltar para a tela de login
        mostrarTelaLogin();
    }
});

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

// Abrir modal
btnAbrirModal.addEventListener('click', () => {
    modalConta.classList.add('active');
});

// Fechar modal
btnFecharModal.addEventListener('click', () => {
    modalConta.classList.remove('active');
    formConta.reset();
});

// Salvar via Formulário
formConta.addEventListener('submit', async (e) => {
    e.preventDefault();

    const dadosConta = {
        nome: document.getElementById('conta-nome').value,
        saldoAtual: document.getElementById('conta-saldo').value
    };

    try {
        const userId = auth.currentUser.uid;
        await salvarConta(userId, dadosConta);

        // Sucesso: fecha e limpa
        modalConta.classList.remove('active');
        formConta.reset();
    } catch (error) {
        alert("Erro ao salvar conta. Tente novamente.");
    }
});

// --- LÓGICA DO MODAL DE CATEGORIA ---
const modalCat = document.getElementById('modal-categoria');
const btnAbrirCat = document.getElementById('btn-nova-categoria');
const btnFecharCat = document.getElementById('btn-fechar-modal-categoria');
const formCat = document.getElementById('form-categoria');

btnAbrirCat.addEventListener('click', () => modalCat.classList.add('active'));
btnFecharCat.addEventListener('click', () => {
    modalCat.classList.remove('active');
    formCat.reset();
});

formCat.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('categoria-nome').value;

    try {
        await salvarCategoria(auth.currentUser.uid, nome);
        modalCat.classList.remove('active');
        formCat.reset();
    } catch (error) {
        alert("Erro ao salvar categoria.");
    }
});

// --- TRANSAÇÃO - início ---
const btnNovaTransacao = document.getElementById('btn-nova-transacao');
const modalTransacao = document.getElementById('modal-transacao');
const formTransacao = document.getElementById('form-transacao');
const btnFecharTransacao = modalTransacao.querySelector('.close-btn');

// 1. Abrir o Modal
btnNovaTransacao.addEventListener('click', () => {
    // Definir a data de hoje como padrão
    document.getElementById('trans-data').valueAsDate = new Date();

    // Abrir o modal
    modalTransacao.style.display = 'block';
});

// 2. Fechar o Modal (No botão X)
btnFecharTransacao.addEventListener('click', () => {
    modalTransacao.style.display = 'none';
});

// 3. Fechar o Modal (Se clicar fora dele)
window.addEventListener('click', (event) => {
    if (event.target === modalTransacao) {
        modalTransacao.style.display = 'none';
    }
});

// Listener do tipo de transação para mostrar/ocultar campos
const selectTipo = document.getElementById('trans-tipo');

selectTipo.addEventListener('change', (e) => {
    import('./ui.js').then(ui => ui.tratarMudancaTipo(e.target.value));
});

//  Salvar a Transação
formTransacao.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Capturar os dados do formulário
    const comboConta = document.getElementById('select-conta');
    const comboCategoria = document.getElementById('select-categoria');
    
    const dados = {
        descricao: document.getElementById('trans-descricao').value,
        valor: parseFloat(document.getElementById('trans-valor').value),
        tipo: document.getElementById('trans-tipo').value,
        data: document.getElementById('trans-data').value,

        contaId: comboConta.value,
        categoriaId: comboCategoria.value,
        contaDestinoId: document.getElementById('select-conta-destino').value,

        nota: document.getElementById('trans-nota').value,

        contaNome: comboConta.options[comboConta.selectedIndex].text,
        categoriaNome: comboCategoria.options[comboCategoria.selectedIndex].text
    };

    try {
        // userId deve vir da sua lógica de autenticação (ex: auth.currentUser.uid)
        const userId = auth.currentUser.uid;

        await salvarTransacao(dados, userId);

        alert('Transação salva com sucesso!');
        formTransacao.reset();
        modalTransacao.style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert('Erro ao salvar transação. Verifique o console.');
    }
});
// --- TRANSAÇÃO - fim ---