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