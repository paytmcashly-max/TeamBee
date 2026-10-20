/**
 * Normalize and render numbered WhatsApp template variables in one place.
 * Meta templates may repeat a placeholder (for example {{1}} twice), so the
 * parameter list must contain each numbered variable once, in numeric order.
 */
function getTemplateVariableIndexes(bodyText = '') {
  const indexes = new Set();
  const matches = String(bodyText).matchAll(/\{\{(\d+)\}\}/g);
  for (const match of matches) indexes.add(Number(match[1]));
  return [...indexes].sort((a, b) => a - b);
}

function prepareTemplateMessage(bodyText, variables = {}, fallback = (index) => `Sample ${index}`) {
  let renderedBody = String(bodyText || '');
  const parameters = [];

  for (const index of getTemplateVariableIndexes(renderedBody)) {
    const provided = variables[index] ?? variables[String(index)];
    const value = provided === undefined || provided === null || String(provided).trim() === ''
      ? fallback(index)
      : String(provided);
    renderedBody = renderedBody.replace(new RegExp(`\\{\\{${index}\\}\\}`, 'g'), value);
    parameters.push({ type: 'text', text: value });
  }

  return {
    renderedBody,
    components: parameters.length > 0 ? [{ type: 'body', parameters }] : [],
  };
}

module.exports = {
  getTemplateVariableIndexes,
  prepareTemplateMessage,
};
