/**
 * Procura um elemento no DOM e garante que ele existe.
 * @param {string} id - O ID do elemento.
 * @returns {HTMLElement}
 */
export const getRequiredElement = (id) => {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Erro: Elemento com ID #${id} não encontrado!`);
    }
    return el;
};

/**
 * Alterna a visibilidade entre a tela de login e a tela principal do App
 * @param {boolean} usuarioLogado 
 */
export const alternarTelas = (usuarioLogado) => {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');

    if (usuarioLogado) {
        // Usuário entrou: esconde login, mostra app
        if (viewLogin) viewLogin.style.display = 'none';
        if (viewMain) viewMain.style.display = 'flex'; // Usamos flex para manter o layout do CSS
    } else {
        // Usuário saiu: mostra login, esconde app
        if (viewLogin) viewLogin.style.display = 'block';
        if (viewMain) viewMain.style.display = 'none';
    }
};

// Renderiza as contas na barra lateral, mostrando o saldo real de hoje (considerando o saldo inicial + todas as transações do ano até hoje)
export const renderizarContas = (contas, saldosAnuais = [], idsSelecionados = []) => {
    const container = document.getElementById('lista-contas');
    if (!container) return;
    container.innerHTML = '';

    const anoAtual = new Date().getFullYear();

    contas.forEach(conta => {
        // Encontra o balanço do ano corrente para extrair o saldo cronológico de hoje
        const registroSaldo = saldosAnuais.find(s => s.contaId === conta.id && s.ano === anoAtual);
        const saldoRealHoje = registroSaldo ? Number(registroSaldo.saldoAtualHoje) : (Number(conta.saldoInicial) || 0);

        const li = document.createElement('li');
        li.className = 'sidebar-item';
        const isChecked = idsSelecionados.includes(conta.id) ? 'checked' : '';
        const classeCor = saldoRealHoje >= 0 ? 'texto-verde' : 'texto-vermelho';

        li.innerHTML = `
            <div class="sidebar-item-content">
                <input type="checkbox" id="chk-conta-${conta.id}" data-id="${conta.id}" class="filtro-conta-chk" ${isChecked}>
                <label for="chk-conta-${conta.id}" class="conta-nome">${conta.nome}</label>
            </div>
            <span class="conta-saldo ${classeCor}">${formatarMoeda(saldoRealHoje)}</span>
        `;
        container.appendChild(li);
    });
};

/**
 * Renderiza as categorias na barra lateral
 */
export const renderizarCategorias = (categorias, idsSelecionados = []) => {
    const container = document.getElementById('lista-categorias');
    if (!container) return;
    container.innerHTML = '';

    if (categorias.length === 0) {
        container.innerHTML = '<li class="empty-text">Nenhuma categoria...</li>';
        return;
    }

    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'sidebar-item';

        // Mudança aqui: Verifica se o ID está no array
        const IsChecked = idsSelecionados.includes(cat.id) ? 'checked' : '';

        li.innerHTML = `
        <div class="sidebar-item-main">
            <input type="checkbox" class="filtro-categoria-chk" data-id="${cat.id}" ${IsChecked}>
            <span class="item-nome">${cat.nome}</span>
        </div>
    `;
        container.appendChild(li);
    });
};

// Função para atualizar os dropdowns do formulário de transação
export function atualizarSelects(contas, categorias) {
    const selectConta = document.getElementById('select-conta');
    const selectDestino = document.getElementById('select-conta-destino');
    const selectCategoria = document.getElementById('select-categoria');

    if (!selectConta || !selectDestino || !selectCategoria) return;

    // Limpar e preencher selects de conta (Origem e Destino)
    const optionsContas = '<option value="">Selecione a Conta</option>' +
        contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

    selectConta.innerHTML = optionsContas;
    selectDestino.innerHTML = optionsContas.replace("Selecione a Conta", "Conta de Destino");

    // Preencher categorias
    selectCategoria.innerHTML = '<option value="">Selecione a Categoria</option>' +
        categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
}

// Função para alternar campos dependendo do tipo
// js/ui.js

export function tratarMudancaTipo(tipo) {
    const groupDestino = document.getElementById('group-conta-destino');
    const groupCategoria = document.getElementById('group-categoria'); // Agora pegamos o grupo
    const selectCategoria = document.getElementById('select-categoria');

    if (tipo === 'transferencia') {
        // Mostra destino, esconde categoria
        groupDestino.style.display = 'block';
        groupCategoria.style.display = 'none';

        // Remove a obrigatoriedade da categoria para não travar o envio
        selectCategoria.required = false;
    } else {
        // Esconde destino, mostra categoria
        groupDestino.style.display = 'none';
        groupCategoria.style.display = 'block';

        // Volta a ser obrigatório para Receita e Despesa
        selectCategoria.required = true;
    }
}

// Exibe a tela principal do App e esconde o Login
export function mostrarTelaApp(user) {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');
    const userDisplay = document.getElementById('user-display-name');

    if (viewLogin) viewLogin.style.display = 'none';
    if (viewMain) viewMain.style.display = 'block'; // Ou 'flex', dependendo do seu layout

    // Atualiza o nome do usuário na barra superior (Diretriz de UI)
    if (userDisplay) {
        userDisplay.textContent = user.displayName || user.email;
    }
}

// Exibe a tela de Login e esconde o App (usado no Logout ou falha de auth)
export function mostrarTelaLogin() {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');

    if (viewMain) viewMain.style.display = 'none';
    if (viewLogin) viewLogin.style.display = 'flex'; // Usamos flex porque o container de login geralmente é centralizado
}

export function atualizarMesExibido(mes, ano) {
    const nomesMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const labelMes = document.getElementById('current-month-display');
    if (labelMes) {
        labelMes.textContent = `${nomesMeses[mes]} de ${ano}`;
    }
}

export function renderizarTransacoes(transacoes, contas, categorias, saldosAnuais = [], mesSelecionado, anoSelecionado) {
    const container = document.getElementById('lista-transacoes');
    const cardSaldoAnterior = document.getElementById('valor-saldo-anterior');
    const cardFluxoMes = document.getElementById('valor-total-periodo');

    if (!container || !transacoes || !contas || !categorias || !saldosAnuais) return;

    container.innerHTML = '';

    // --- CÁLCULO INSTANTÂNEO DO SALDO ANTERIOR CONSOLIDADO ---
    let saldoAnteriorCalculado = 0;
    const mesesMarcadores = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    let anoBusca = anoSelecionado;
    let mesAnteriorIndex = mesSelecionado - 1;
    
    if (mesSelecionado === 0) { // Se a tela está em Janeiro, busca o Dezembro do ano anterior
        anoBusca = anoSelecionado - 1;
        mesAnteriorIndex = 11;
    }

    contas.forEach(conta => {
        const registro = saldosAnuais.find(s => s.contaId === conta.id && s.ano === anoBusca);
        if (registro) {
            const marcador = mesesMarcadores[mesAnteriorIndex];
            saldoAnteriorCalculado += Number(registro[marcador]) || 0;
        } else {
            // Fallback: se não achar consolidações passadas, usa o saldo inicial se for o ano de criação
            saldoAnteriorCalculado += Number(conta.saldoInicial) || 0;
        }
    });

    if (cardSaldoAnterior) cardSaldoAnterior.textContent = formatarMoeda(saldoAnteriorCalculado);

    // 🚨 SEGURANÇA MÁXIMA: Se as dependências não carregaram, exibe um feedback amigável e sai da função
    if (!contas || contas.length === 0 || !categorias || categorias.length === 0) {
        container.innerHTML = `<div class="transacao-item">Carregando dados complementares...</div>`;
        return; 
    }

    if (transacoes.length === 0) {
        container.innerHTML = `<div class="transacao-item">Nenhuma transação encontrada para este mês.</div>`;
        return;
    }

    let saldoCorrido = saldoAnteriorCalculado;
    let fluxoDoMes = 0;

    // Garante ordenação ascendente para montar o extrato diário corrido perfeitamente
    const transacoesOrdenadas = [...transacoes].sort((a, b) => {
        const dataA = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        const dataB = b.data?.toDate ? b.data.toDate() : new Date(b.data);
        return dataA - dataB;
    });

    transacoesOrdenadas.forEach(t => {
        const valor = Number(t.valor) || 0;
        if (t.tipo === 'receita') {
            saldoCorrido += valor;
            fluxoDoMes += valor;
        } else if (t.tipo === 'despesa') {
            saldoCorrido -= valor;
            fluxoDoMes -= valor;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'transacao-item';
        
        const dataStr = t.data?.toDate ? t.data.toDate().toLocaleDateString('pt-BR') : new Date(t.data).toLocaleDateString('pt-BR');
        const classeCor = t.tipo === 'receita' ? 'texto-receita' : 'texto-despesa';

        itemDiv.innerHTML = `
            <span>${dataStr}</span>
            <span title="${t.descricao}">${t.descricao}</span>
            <span>${t.categoriaNome || 'Sem Categoria'}</span>
            <span>${t.contaNome || 'Sem Conta'}</span>
            <span class="${classeCor}">${formatarMoeda(valor)}</span>
            <span class="coluna-saldo-diario">${formatarMoeda(saldoCorrido)}</span>
        `;
        container.appendChild(itemDiv);
    });

    if (cardFluxoMes) {
        cardFluxoMes.textContent = formatarMoeda(fluxoDoMes);
        cardFluxoMes.className = fluxoDoMes >= 0 ? 'card-valor texto-verde' : 'card-valor texto-vermelho';
    }
}

/**
 * Formata um valor numérico ou string para o padrão monetário brasileiro (R$).
 * @param {number|string} valor - O valor numérico ou string numérica a ser formatada.
 * @returns {string} O valor formatado no formato "R$ 1.250,50".
 */
const formatarMoeda = (valor) => {
  // Converte para número caso venha como string de um input do DOM
  const numero = typeof valor === "string" ? parseFloat(valor) : valor;

  // Cláusula de salvaguarda para evitar "NaN" ou quebras visuais na UI
  if (numero === undefined || numero === null || isNaN(numero)) {
    return "R$ 0,00";
  }

  // Utiliza a API nativa de internacionalização do navegador
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(numero);
};