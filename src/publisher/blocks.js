'use strict';

/**
 * Block factory helpers. Each function returns a Notion API-shaped block object.
 *
 * Notion block reference: https://developers.notion.com/reference/block
 */

function richText(content) {
  return [{ type: 'text', text: { content: String(content) } }];
}

function paragraph(text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: richText(text) }
  };
}

function heading(text, level = 2) {
  const lvl = level === 1 ? 'heading_1' : level === 3 ? 'heading_3' : 'heading_2';
  return {
    object: 'block',
    type: lvl,
    [lvl]: { rich_text: richText(text) }
  };
}

function bulletList(items) {
  return items.map((item) => ({
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: richText(item) }
  }));
}

function numberList(items) {
  return items.map((item) => ({
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: richText(item) }
  }));
}

function todoList(items) {
  return items.map((item) => {
    const isObj = typeof item === 'object' && item !== null;
    const text = isObj ? item.text : item;
    const checked = isObj ? Boolean(item.checked) : false;
    return {
      object: 'block',
      type: 'to_do',
      to_do: { rich_text: richText(text), checked }
    };
  });
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

function code(text, language = 'plain text') {
  return {
    object: 'block',
    type: 'code',
    code: { rich_text: richText(text), language }
  };
}

function callout(text, emoji = '💡') {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: richText(text),
      icon: { type: 'emoji', emoji }
    }
  };
}

function quote(text) {
  return {
    object: 'block',
    type: 'quote',
    quote: { rich_text: richText(text) }
  };
}

module.exports = {
  richText,
  paragraph,
  heading,
  bulletList,
  numberList,
  todoList,
  divider,
  code,
  callout,
  quote
};
