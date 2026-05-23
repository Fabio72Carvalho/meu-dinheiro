import { auth } from './firebase-config.js';
import { cadastrarUsuario, fazerLogin, fazerLogout, observarAutenticacao } from './auth.js';
import {
    getRequiredElement,
    renderizarContas,
    renderizarCategorias,
    atualizarSelects,
    renderizarTransacoes,
    atualizarMesExibido,
    gerenciarEstadoAuth,
    mostrarAlerta
} from './ui.js';
import { escutarContas,
    escutarCategorias,
    escutarSaldosAnuais,
    salvarConta, salvarCategoria,
    salvarTransacao,
    escutarTransacoesPorMes,
    excluirTransacao,
    editarTransacao
 } from './db.js';

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
let unsubscribeSaldosAnuais = null;

let contasGlobais = [];
let categoriasGlobais = [];
let transacoesGlobais = [];
let saldosAnuaisGlobais = [];

let contasSelecionadasIds = [];     // Armazenará uma lista de IDs ex: ['id_itau', 'id_carteira']
let categoriasSelecionadasIds = []; // Armazenará uma lista de IDs ex: ['id_lazer', 'id_saude']

let transacaoEmEdicaoOriginal = null; // Guarda os dados originais para reverter depois

// observarAutenticacao importado de auth.js, é a função que monitora o estado de login do usuário em tempo real
observarAutenticacao((user) => {
    if (user) { // --- CASO: USUÁRIO LOGADO ---
        console.log("Usuário logado:", user.uid);
        gerenciarEstadoAuth(user);
        // Ouvintes em tempo real do Firestore
        unsubscribeSaldosAnuais = escutarSaldosAnuais(user.uid, (saldos) => {
            saldosAnuaisGlobais = saldos;
            renderizarContas(contasGlobais, saldosAnuaisGlobais, contasSelecionadasIds);
            aplicarFiltrosMemoria();
        });
        unsubscribeContas = escutarContas(user.uid, (contas) => {
            contasGlobais = contas;
            renderizarContas(contasGlobais, saldosAnuaisGlobais, contasSelecionadasIds);
            atualizarSelects(contasGlobais, categoriasGlobais);
            aplicarFiltrosMemoria();
        });
        unsubscribeCategorias = escutarCategorias(user.uid, (categorias) => {
            categoriasGlobais = categorias;
            renderizarCategorias(categorias, categoriasSelecionadasIds);
            atualizarSelects(contasGlobais, categoriasGlobais);
            aplicarFiltrosMemoria();
        });
        // Busca inicial das transações do mês vigente
        carregarTransacoesDoMes(user.uid);
    } else {
        // --- CASO: USUÁRIO DESLOGADO (LOGOUT) ---
        console.log("Nenhum usuário logado.");
        // 1. Tratamento de Interface Unificado (Garante o CSS sem encolher)
        gerenciarEstadoAuth(user);
        // 2. Parar de ouvir todas as coleções do banco de dados
        if (unsubscribeSaldosAnuais) unsubscribeSaldosAnuais();
        if (unsubscribeContas) unsubscribeContas();
        if (unsubscribeCategorias) unsubscribeCategorias();
        if (unsubscribeTransacoes) unsubscribeTransacoes();
        // 3. Limpar completamente os estados globais na memória
        saldosAnuaisGlobais = [];
        contasGlobais = [];
        categoriasGlobais = [];
        transacoesGlobais = [];
        contasSelecionadasIds = [];
        categoriasSelecionadasIds = [];
        // 4. Limpar a UI desenhando estruturas vazias (Assinatura nova!)
        renderizarContas([], []);
        renderizarCategorias([]);
        renderizarTransacoes([], 0); // Tabela vazia, saldo zerado.
    }
});

// Função para iniciar a escuta de transações (chamada no login e na troca de mês)
function carregarTransacoesDoMes(userId) {
    const mes = dataFiltroAtual.getMonth();
    const ano = dataFiltroAtual.getFullYear();

    // Atualiza o texto no topo da tela (ex: "Maio de 2024")
    atualizarMesExibido(mes, ano);

    // Se já houver uma escuta ativa, cancela para não duplicar
    if (unsubscribeTransacoes) unsubscribeTransacoes();

    unsubscribeTransacoes = escutarTransacoesPorMes(userId, mes, ano, (transacoes) => {
        transacoesGlobais = transacoes;
        // Agora, simplesmente chama o Maestro!
        aplicarFiltrosMemoria();
    });
}

// LISTENER PARA SUBMISSÃO DO FORMULÁRIO (LOGIN/SIGNUP)
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

// Abrir modal Conta
btnAbrirModal.addEventListener('click', () => {
    modalConta.classList.add('active');
});

// Fechar modal Conta
btnFecharModal.addEventListener('click', () => {
    modalConta.classList.remove('active');
    formConta.reset();
});

// Salvar Conta via Formulário
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
        mostrarAlerta("Erro ao salvar conta. Tente novamente.", "erro");
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
        mostrarAlerta("Erro ao salvar categoria.", "erro");
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

// Salvar a Transação
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
        const userId = auth.currentUser.uid;
        if (transacaoEmEdicaoOriginal) {
            await editarTransacao(auth.currentUser.uid, transacaoEmEdicaoOriginal, dados);
            mostrarAlerta("Transação editada!", "sucesso");
        } else {
            await salvarTransacao(userId, dados);
            mostrarAlerta('Transação salva com sucesso!', 'sucesso');
        }
        fecharE_LimparModal();
        modalTransacao.style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar:", error);
        mostrarAlerta('Erro ao salvar transação. Verifique o console.', 'erro');
    }
});
// --- TRANSAÇÃO - fim ---

// --- EVENT LISTENERS DE NAVEGAÇÃO DE MÊS ---
document.getElementById('btn-prev-month').addEventListener('click', () => {
    dataFiltroAtual.setMonth(dataFiltroAtual.getMonth() - 1);
    carregarTransacoesDoMes(auth.currentUser.uid);
});
document.getElementById('btn-next-month').addEventListener('click', () => {
    dataFiltroAtual.setMonth(dataFiltroAtual.getMonth() + 1);
    carregarTransacoesDoMes(auth.currentUser.uid);
});

// --- LÓGICA DE ATIVAÇÃO DOS FILTROS DA SIDEBAR ---

// Ouvinte para a lista de Contas (Múltipla Escolha)
document.getElementById('lista-contas')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('filtro-conta-chk')) {
        const chk = e.target;
        const idConta = chk.dataset.id;
        if (chk.checked) {
            if (!contasSelecionadasIds.includes(idConta)) {
                contasSelecionadasIds.push(idConta);
            }
        } else {
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
            if (!categoriasSelecionadasIds.includes(idCategoria)) {
                categoriasSelecionadasIds.push(idCategoria);
            }
        } else {
            categoriasSelecionadasIds = categoriasSelecionadasIds.filter(id => id !== idCategoria);
        }
        aplicarFiltrosMemoria();
    }
});

// --- O MAESTRO DA TELA DE TRANSAÇÕES ---
function aplicarFiltrosMemoria() {
    // Adicionamos a segurança inicial. Retiramos os "window." porque 
    // as variáveis estão no escopo global deste próprio arquivo.
    if (!contasGlobais || !transacoesGlobais) return;

    // 1. Clona e Filtra as Transações
    let transacoesFiltradas = [...transacoesGlobais];

    if (contasSelecionadasIds.length > 0) {
        transacoesFiltradas = transacoesFiltradas.filter(t => contasSelecionadasIds.includes(t.contaId));
    }

    if (categoriasSelecionadasIds.length > 0) {
        transacoesFiltradas = transacoesFiltradas.filter(t => categoriasSelecionadasIds.includes(t.categoriaId));
    }

    // === 2. CÁLCULO DO SALDO DE REFERÊNCIA ===
    let saldoDeReferencia = 0;

    const hoje = new Date();
    const mesFiltro = dataFiltroAtual.getMonth();
    const anoFiltro = dataFiltroAtual.getFullYear();
    const éMesAtual = mesFiltro === hoje.getMonth() && anoFiltro === hoje.getFullYear();

    if (éMesAtual) {
        // LÓGICA DO MÊS ATUAL (Usando contasGlobais)
        if (contasSelecionadasIds.length > 0) {
            saldoDeReferencia = contasSelecionadasIds.reduce((acumulador, id) => {
                const conta = contasGlobais.find(c => c.id === id);
                return acumulador + (conta ? parseFloat(conta.saldoAtual) || 0 : 0);
            }, 0);
        } else {
            saldoDeReferencia = contasGlobais.reduce((acumulador, conta) => {
                return acumulador + (parseFloat(conta.saldoAtual) || 0);
            }, 0);
        }
    } else {
        // LÓGICA DO MÊS PASSADO
        const mesesMarcadores = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        let anoBusca = anoFiltro;
        let mesAnteriorIndex = mesFiltro - 1;

        if (mesFiltro === 0) { // Janeiro busca Dezembro do ano passado
            anoBusca = anoFiltro - 1;
            mesAnteriorIndex = 11;
        }

        // Descobre quais contas vamos somar (todas ou apenas as filtradas)
        const contasParaCalcular = contasSelecionadasIds.length > 0
            ? contasGlobais.filter(c => contasSelecionadasIds.includes(c.id))
            : contasGlobais;

        // Soma o saldo histórico dessas contas
        contasParaCalcular.forEach(conta => {
            const registro = saldosAnuaisGlobais.find(s => s.contaId === conta.id && s.ano === anoBusca);

            if (registro) {
                const marcador = mesesMarcadores[mesAnteriorIndex];
                saldoDeReferencia += Number(registro[marcador]) || 0;
            } else {
                // Se não achar registro, cai no saldoInicial de quando a conta foi criada
                saldoDeReferencia += Number(conta.saldoInicial) || 0;
            }
        });
    }

    // 3. Envia os dados mastigados para a interface
    renderizarTransacoes(transacoesFiltradas, saldoDeReferencia);
}

// Ouvir os cliques no ícone de lápis (Delegação de eventos)
document.getElementById('lista-transacoes').addEventListener('click', (e) => {
    // Verifica se clicou no lápis
    const btnEditar = e.target.closest('.t-acoes');
    if (btnEditar) {
        const id = btnEditar.dataset.id;
        abrirModalEdicao(id);
    }
});

function abrirModalEdicao(id) {
    // Acha a transação na memória
    const t = transacoesGlobais.find(x => x.id === id);
    if (!t) return;

    transacaoEmEdicaoOriginal = t; // Guarda a original

    // Preenche os campos do formulário
    document.getElementById('trans-tipo').value = t.tipo;
    document.getElementById('trans-valor').value = t.valor;
    document.getElementById('trans-descricao').value = t.descricao;
    document.getElementById('select-conta').value = t.contaId;
    document.getElementById('select-categoria').value = t.categoriaId;

    // Converte timestamp para input type="date" (YYYY-MM-DD)
    const dataJS = t.data.toDate();
    document.getElementById('trans-data').value = dataJS.toISOString().split('T')[0];

    // Mostra o botão de excluir e altera título
    document.getElementById('btn-excluir-transacao').style.display = 'block';
    document.getElementById('titulo-modal-transacao').innerText = 'Editar Transação';

    // Abre o modal
    modalTransacao.style.display = 'flex';
}

// 2. O botão de Excluir
document.getElementById('btn-excluir-transacao').addEventListener('click', async () => {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
        try {
            await excluirTransacao(auth.currentUser.uid, transacaoEmEdicaoOriginal);
            mostrarAlerta("Excluída com sucesso!", "aviso");
            fecharE_LimparModal();
        } catch (error) {
            mostrarAlerta("Erro ao excluir. ", "erro");
        }
    }
});

// Função auxiliar para fechar e resetar o modal
function fecharE_LimparModal() {
    formTransacao.reset();
    transacaoEmEdicaoOriginal = null;
    document.getElementById('btn-excluir-transacao').style.display = 'none';
    document.getElementById('titulo-modal-transacao').innerText = 'Nova Transação';
    modalTransacao.style.display = 'none';
}