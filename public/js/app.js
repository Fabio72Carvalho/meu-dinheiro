import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';
import {
    getRequiredElement,
    alternarTelas,
    renderizarContas,
    renderizarCategorias,
    mostrarTelaLogin,
    mostrarTelaApp,
    atualizarSelects,
    renderizarTransacoes,
    atualizarMesExibido
} from './ui.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { escutarContas, escutarCategorias, escutarTransacoes, escutarSaldosAnuais,salvarConta, salvarCategoria, salvarTransacao, escutarTransacoesPorMes } from './db.js';

// --- SELEÇÃO DE ELEMENTOS DA UI ---
const mensagem = getRequiredElement('mensagem');
const loginForm = getRequiredElement('auth-form');
// --- LÓGICA DO MODAL DE CONTA ---
const modalConta = document.getElementById('modal-conta');
const btnAbrirModal = document.getElementById('btn-nova-conta');
const btnFecharModal = document.getElementById('btn-fechar-modal-conta');
const formConta = document.getElementById('form-conta');

let dataFiltroAtual = new Date();

let unsubscribeContas = null;
let unsubscribeCategorias = null;
let unsubscribeTransacoes = null;

let contasGlobais = [];
let categoriasGlobais = [];
let transacoesGlobais = [];

let contasSelecionadasIds = [];     // Armazenará uma lista de IDs ex: ['id_itau', 'id_carteira']
let categoriasSelecionadasIds = []; // Armazenará uma lista de IDs ex: ['id_lazer', 'id_saude']

let saldosAnuaisGlobais = [];
let unsubscribeSaldosAnuais = null;

// Crie uma função centralizadora para atualizar a UI com os novos estados globais:
function atualizarRendersInterface() {
    renderizarContas(contasGlobais, saldosAnuaisGlobais, contasSelecionadasIds);
    renderizarCategorias(categoriasGlobais, categoriasSelecionadasIds);

    // Passa os saldos anuais e o mês/ano selecionados na navegação do app
    renderizarTransacoes(
        transacoesGlobais,
        contasGlobais,
        categoriasGlobais,
        saldosAnuaisGlobais,
        dataFiltroAtual.getMonth(),
        dataFiltroAtual.getFullYear()
    );
}

function aplicarFiltrosMemoria() {
    // 1. Clona o array global de transações do mês para aplicar os filtros
    let transacoesFiltradas = [...transacoesGlobais];

    // 2. Se houver pelo menos uma conta selecionada na sidebar, filtra
    if (contasSelecionadasIds.length > 0) {
        transacoesFiltradas = transacoesFiltradas.filter(t => contasSelecionadasIds.includes(t.contaId));
    }

    // 3. Se houver pelo menos uma categoria selecionada na sidebar, filtra
    if (categoriasSelecionadasIds.length > 0) {
        transacoesFiltradas = transacoesFiltradas.filter(t => categoriasSelecionadasIds.includes(t.categoriaId));
    }

    // === 4. CÁLCULO CRÍTICO: DESCOBRIR O SALDO DE REFERÊNCIA VIVO ===
    let saldoDeReferencia = 0;

    // Descobre se o mês que o usuário está olhando é o mês atual (mês e ano idênticos a "hoje")
    const hoje = new Date();
    const éMesAtual = dataFiltroAtual.getMonth() === hoje.getMonth() &&
        dataFiltroAtual.getFullYear() === hoje.getFullYear();

    if (éMesAtual) {
        // MÊS ATUAL: O saldo vivo vem em tempo real do seu array 'contasGlobais'
        if (contasSelecionadasIds.length > 0) {
            // Se tem contas filtradas, soma o saldoAtual APENAS das contas selecionadas
            saldoDeReferencia = contasSelecionadasIds.reduce((acumulador, id) => {
                const conta = contasGlobais.find(c => c.id === id);
                return acumulador + (conta ? parseFloat(conta.saldoAtual) || 0 : 0);
            }, 0);
        } else {
            // Se NÃO tem conta filtrada (Visão Geral), soma o saldoAtual de TODAS as contas
            saldoDeReferencia = contasGlobais.reduce((acumulador, conta) => {
                return acumulador + (parseFloat(conta.saldoAtual) || 0);
            }, 0);
        }
    } else {
        // MÊS PASSADO: O saldoDeReferencia será o snapshot histórico resgatado do banco.
        // Enquanto não implementamos a coleção 'saldosMensais', deixamos herdando 0 ou sua variável global
        saldoDeReferencia = typeof saldoHistoricoGeral !== 'undefined' ? saldoHistoricoGeral : 0;
    }

    // 5. Renderiza o resultado final na tela passando a lista filtrada e o saldo correto
    renderizarTransacoes(transacoesFiltradas, saldoDeReferencia);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- CASO: USUÁRIO LOGADO ---
        console.log("Usuário logado:", user.uid);
        mostrarTelaApp(user); // Troca a UI para a tela principal

        // 1. Iniciamos os ouvintes em tempo real
        // OUvinte 0: Escuta os saldos anuais consolidados da conta (Balanço Estático)
        unsubscribeSaldosAnuais = escutarSaldosAnuais(user.uid, (saldos) => {
            saldosAnuaisGlobais = saldos;

            console.log("Saldos anuais atualizados:", saldosAnuaisGlobais);

            // Sempre que o saldo mudar (ex: transação inserida), forçamos o re-render da barra lateral e extrato
            renderizarContas(contasGlobais, saldosAnuaisGlobais, contasSelecionadasIds);
            renderizarTransacoes(
                transacoesGlobais,
                contasGlobais,
                categoriasGlobais,
                saldosAnuaisGlobais,
                dataFiltroAtual.getMonth(),
                dataFiltroAtual.getFullYear()
            );
        });

        // Ouvinte 1: Escuta as Contas do Usuário
        unsubscribeContas = escutarContas(user.uid, (contas) => {
            contasGlobais = contas;
            // Passamos a lista de saldos anuais carregada para computar o saldo de hoje cronologicamente
            renderizarContas(contasGlobais, saldosAnuaisGlobais, contasSelecionadasIds);
            atualizarSelects(contasGlobais, categoriasGlobais);
        });

        // Ouvinte 2: Escuta as Categorias do Usuário
        unsubscribeCategorias = escutarCategorias(user.uid, (categorias) => {
            categoriasGlobais = categorias;
            renderizarCategorias(categorias, categoriasSelecionadasIds);
            atualizarSelects(contasGlobais, categoriasGlobais);
        });

        // 2. Busca inicial das transações do mês vigente
        carregarTransacoesDoMes(user.uid);

    } else {
        // --- CASO: USUÁRIO DESLOGADO (LOGOUT) ---
        console.log("Nenhum usuário logado.");

        // IMPORTANTÍSSIMO: Parar de ouvir todas as coleções do banco de dados (Evita vazamento de memória)
        if (unsubscribeSaldosAnuais) unsubscribeSaldosAnuais();
        if (unsubscribeContas) unsubscribeContas();
        if (unsubscribeCategorias) unsubscribeCategorias();
        if (unsubscribeTransacoes) unsubscribeTransacoes();

        // Limpar completamente os estados globais na memória para o próximo login
        saldosAnuaisGlobais = [];
        contasGlobais = [];
        categoriasGlobais = [];
        transacoesGlobais = [];
        contasSelecionadasIds = [];
        categoriasSelecionadasIds = [];

        // Limpar a UI desenhando estruturas vazias
        renderizarContas([], []);
        renderizarCategorias([]);
        renderizarTransacoes([], [], [], [], dataFiltroAtual.getMonth(), dataFiltroAtual.getFullYear());

        // Voltar o usuário de forma segura para a tela de login
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

    // Converter a data do input para um objeto Date
    const dataInput = document.getElementById('trans-data').value;
    const dataObjeto = new Date(dataInput + "T12:00:00");

    const dados = {
        descricao: document.getElementById('trans-descricao').value,
        valor: parseFloat(document.getElementById('trans-valor').value),
        tipo: document.getElementById('trans-tipo').value,
        data: dataObjeto,

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

        await salvarTransacao(userId, dados);

        alert('Transação salva com sucesso!');
        formTransacao.reset();
        modalTransacao.style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert('Erro ao salvar transação. Verifique o console.');
    }
});
// --- TRANSAÇÃO - fim ---

// Função para iniciar a escuta de transações (chamada no login e na troca de mês)
function carregarTransacoesDoMes(userId) {
    const mes = dataFiltroAtual.getMonth();
    const ano = dataFiltroAtual.getFullYear();

    // Atualiza o texto no topo da tela (ex: "Maio de 2024")
    atualizarMesExibido(mes, ano);

    // Se já houver uma escuta ativa, cancela para não duplicar
    if (unsubscribeTransacoes) unsubscribeTransacoes();

    unsubscribeTransacoes = escutarTransacoesPorMes(userId, dataFiltroAtual.getMonth(), dataFiltroAtual.getFullYear(), (transacoes) => {
        transacoesGlobais = transacoes;

        renderizarTransacoes(
            transacoesGlobais,
            contasGlobais,
            categoriasGlobais,
            saldosAnuaisGlobais,
            dataFiltroAtual.getMonth(),
            dataFiltroAtual.getFullYear()
        );
    });
}

// --- EVENT LISTENERS DE NAVEGAÇÃO DE MÊS ---
document.getElementById('btn-prev-month').addEventListener('click', () => {
    dataFiltroAtual.setMonth(dataFiltroAtual.getMonth() - 1);
    carregarTransacoesDoMes(auth.currentUser.uid);
});

document.getElementById('btn-next-month').addEventListener('click', () => {
    dataFiltroAtual.setMonth(dataFiltroAtual.getMonth() + 1);
    carregarTransacoesDoMes(auth.currentUser.uid);
});

// --- LOGICA DE ATIVAÇÃO DOS FILTROS DA SIDEBAR ---

// Ouvinte para a lista de Contas (Múltipla Escolha)
document.getElementById('lista-contas')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('filtro-conta-chk')) {
        const chk = e.target;
        const idConta = chk.dataset.id;

        if (chk.checked) {
            // Se foi marcado, adiciona na lista se já não estiver lá
            if (!contasSelecionadasIds.includes(idConta)) {
                contasSelecionadasIds.push(idConta);
            }
        } else {
            // Se foi desmarcado, remove da lista
            contasSelecionadasIds = contasSelecionadasIds.filter(id => id !== idConta);
        }

        aplicarFiltrosMemoria();
    }
});

// Ouvinte para a lista de Categorias (Múltipla Escolha)
document.getElementById('lista-categorias')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('filtro-categoria-chk')) {
        const chk = e.target;
        const idCategoria = chk.dataset.id;

        if (chk.checked) {
            // Se foi marcado, adiciona na lista
            if (!categoriasSelecionadasIds.includes(idCategoria)) {
                categoriasSelecionadasIds.push(idCategoria);
            }
        } else {
            // Se foi desmarcado, remove da lista
            categoriasSelecionadasIds = categoriasSelecionadasIds.filter(id => id !== idCategoria);
        }

        aplicarFiltrosMemoria();
    }
});