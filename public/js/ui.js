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

// Renderiza as contas na barra lateral, mostrando o saldo real de hoje (considerando o saldo inicial + todas as transações do ano até hoje)
// Renderiza as contas na barra lateral
export const renderizarContas = (contas, idsSelecionados = []) => {
    const container = document.getElementById('lista-contas');
    if (!container) return;
    container.innerHTML = '';

    contas.forEach(conta => {
        // Agora o saldo real hoje é mantido atualizado diretamente na coleção da conta pelo Algoritmo Mestre!
        const saldoRealHoje = Number(conta.saldoAtual) || 0;

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

/**
 * Gerencia a interface com base no estado de autenticação do usuário.
 * Unifica a troca de telas e a atualização do nome em um só lugar.
 * @param {Object|null} user - O objeto do usuário logado (ou null se deslogado).
 */
export const gerenciarEstadoAuth = (user) => {
    const viewLogin = document.getElementById('view-login');
    const viewMain = document.getElementById('view-main');
    const userDisplay = document.getElementById('user-display-name');
    if (user) {
        if (viewLogin) viewLogin.style.display = 'none';
        if (viewMain) viewMain.style.display = 'flex'; // Mantém o layout principal
        if (userDisplay) {
            userDisplay.textContent = user.displayName || user.email;
        }
    } else {
        if (viewMain) viewMain.style.display = 'none';
        if (viewLogin) viewLogin.style.display = 'flex';
    }
};

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

export function renderizarTransacoes(transacoesFiltradas, saldoDeReferencia) {
    const container = document.getElementById('lista-transacoes');
    const cardSaldoAnterior = document.getElementById('saldo-anterior');
    const cardFluxoMes = document.getElementById('fluxo-mes');

    if (!container || !transacoesFiltradas) {
        console.log("Aguardando dados para renderizar as transações...");
        return;
    }

    container.innerHTML = '';

    // 1. Atualiza o Card de Saldo Anterior com o valor já calculado na outra função
    if (cardSaldoAnterior) {
        cardSaldoAnterior.textContent = formatarMoeda(saldoDeReferencia);
    }

    const headerTransacao = getRequiredElement('transacao-hdr');

    if (transacoesFiltradas.length === 0) {
        if (headerTransacao) headerTransacao.style.display = 'none';
        container.innerHTML = `<div style="text-align: center; padding: 30px; color: #666; grid-column: 1 / -1;">Nenhuma transação encontrada para este período.</div>`;
        if (cardFluxoMes) cardFluxoMes.textContent = formatarMoeda(0);
        return;
    }
    if (headerTransacao) headerTransacao.style.display = 'grid';

    // 2. Primeira Passagem: Calcular apenas o Fluxo do Mês
    let fluxoDoMes = 0;
    transacoesFiltradas.forEach(t => {
        const valor = Number(t.valor) || 0;
        if (t.tipo === 'receita') fluxoDoMes += valor;
        else if (t.tipo === 'despesa') fluxoDoMes -= valor;
    });

    // 3. Descobrir o VERDADEIRO Saldo Anterior (Baseado no saldo final que o Firebase informou)
    // Se o saldoDeReferencia (final) for R$ 100, e o fluxo foi R$ +20, o mês começou com R$ 80.
    // const verdadeiroSaldoAnterior = saldoDeReferencia + fluxoDoMes;
    const verdadeiroSaldoAnterior = saldoDeReferencia;

    // Atualiza o Card de Saldo Anterior com o valor retro-calculado
    if (cardSaldoAnterior) {
        cardSaldoAnterior.textContent = formatarMoeda(verdadeiroSaldoAnterior);
    }

    // 4. Segunda Passagem: Desenhar as linhas com a ordenação ascendente e o extrato corrido
    let saldoCorrido = verdadeiroSaldoAnterior;

    const transacoesOrdenadas = [...transacoesFiltradas].sort((a, b) => {
        const dataA = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        const dataB = b.data?.toDate ? b.data.toDate() : new Date(b.data);
        return dataA - dataB;
    });

    transacoesOrdenadas.forEach(t => {
        const valor = Number(t.valor) || 0;
        if (t.tipo === 'receita') {
            saldoCorrido += valor;
        } else if (t.tipo === 'despesa') {
            saldoCorrido -= valor;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'transacao-item';

        const dataStr = t.data?.toDate ? t.data.toDate().toLocaleDateString('pt-BR') : new Date(t.data).toLocaleDateString('pt-BR');
        const classeCor = t.tipo === 'receita' ? 'texto-receita' : 'texto-despesa';

        // Lógica para Transferência (exibe o nome da conta parceira se existir, senão a conta original)
        let displayConta = t.contaNome || 'Sem Conta';
        if (t.tipoTransferencia) { // Supondo que você flaggou isso no seu app.js
            displayConta += ' (Transf)';
        }

        // <span class="t-acoes" style="cursor: pointer;" data-id="${t.id}">✏️</span>
        itemDiv.innerHTML = `
            <span>${dataStr}</span>
            <span title="${t.descricao}">${t.descricao}</span>
            <span>${t.categoriaNome || 'Sem Categoria'}</span>
            <span>${displayConta}</span>
            <span class="text-right ${classeCor}">${formatarMoeda(valor)}</span>
            <span class="text-right coluna-saldo-diario">${formatarMoeda(saldoCorrido)}</span>
            <div class="coluna-acao">
              <button class="btn-acao btn-editar" data-id="${t.id}">✏️</button>
            </div>
        `;
        container.appendChild(itemDiv);
    });

    // 5. Atualiza o Card do Fluxo do Mês
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

// Ícones
const ICONES = {
    erro: "❌ ",
    sucesso: "✔️ ",
    info: "ℹ️ ",
    aviso: "⚠️ "
};
/**
 * @param {string | null} mensagem
 * @param {keyof typeof ICONES } tipo
 */
export function mostrarAlerta(mensagem, tipo) {
    tipo = tipo || "info"; // Padrão para "info" se tipo for undefined ou null
    const box = document.getElementById("alertaSistema");
    if (box) {
        box.className = "alerta oculto";
        // Aplica o tipo
        box.classList.add(tipo);
        // Define o texto
        box.textContent = mensagem;
        box.textContent = ICONES[tipo] + mensagem;
        // Mostra
        box.classList.remove("oculto");
        box.classList.add("mostrar");
        // Some depois de 4 segundos
        setTimeout(() => {
            box.classList.remove("mostrar");
            setTimeout(() => {
                box.classList.add("oculto");
            }, 300);
        }, 4000);
    }
}