export function getVariableIndexes(bodyText = '') {
  return [...new Set(
    [...String(bodyText).matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]))
  )].sort((a, b) => a - b);
}

export function parseTemplateButtons(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildDefaultVariables(template, contactName = '') {
  if (!template) return {};
  const defaults = {};
  const indexes = getVariableIndexes(template.bodyText || '');
  if (indexes.length === 0) return defaults;

  if (template.exampleVariables) {
    try {
      const examples = typeof template.exampleVariables === 'string'
        ? JSON.parse(template.exampleVariables)
        : template.exampleVariables;
      if (Array.isArray(examples)) {
        examples.forEach((val, idx) => {
          if (indexes.includes(idx + 1) && val) defaults[idx + 1] = String(val);
        });
      }
    } catch {
      // Ignore malformed sample variable arrays.
    }
  }

  for (const idx of indexes) {
    if (!defaults[idx]) {
      defaults[idx] = idx === 1 && contactName ? contactName : `Value ${idx}`;
    }
  }
  return defaults;
}

export function renderTemplateBody(bodyText = '', variables = {}) {
  let rendered = String(bodyText || '');
  Object.entries(variables || {}).forEach(([key, val]) => {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `{{${key}}}`);
  });
  return rendered;
}
