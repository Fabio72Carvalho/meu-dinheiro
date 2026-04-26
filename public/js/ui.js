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