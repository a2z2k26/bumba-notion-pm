'use strict';

const blocks = require('../src/publisher/blocks');

describe('block factory', () => {
  test('paragraph produces a valid paragraph block', () => {
    const b = blocks.paragraph('hello');
    expect(b.type).toBe('paragraph');
    expect(b.paragraph.rich_text[0].text.content).toBe('hello');
  });

  test('heading respects level 1/2/3 and defaults to 2', () => {
    expect(blocks.heading('a', 1).type).toBe('heading_1');
    expect(blocks.heading('b', 2).type).toBe('heading_2');
    expect(blocks.heading('c', 3).type).toBe('heading_3');
    expect(blocks.heading('d').type).toBe('heading_2');
  });

  test('bulletList returns one block per item', () => {
    const list = blocks.bulletList(['a', 'b', 'c']);
    expect(list).toHaveLength(3);
    expect(list[0].type).toBe('bulleted_list_item');
    expect(list[2].bulleted_list_item.rich_text[0].text.content).toBe('c');
  });

  test('numberList returns one block per item', () => {
    const list = blocks.numberList(['x', 'y']);
    expect(list).toHaveLength(2);
    expect(list[0].type).toBe('numbered_list_item');
  });

  test('todoList accepts strings or {text, checked}', () => {
    const list = blocks.todoList(['plain', { text: 'done', checked: true }]);
    expect(list[0].to_do.checked).toBe(false);
    expect(list[1].to_do.checked).toBe(true);
    expect(list[1].to_do.rich_text[0].text.content).toBe('done');
  });

  test('divider returns a divider block', () => {
    expect(blocks.divider().type).toBe('divider');
  });

  test('code block carries language', () => {
    const c = blocks.code('let x = 1', 'javascript');
    expect(c.code.language).toBe('javascript');
    expect(c.code.rich_text[0].text.content).toBe('let x = 1');
  });

  test('callout includes emoji icon', () => {
    const c = blocks.callout('hey', '🔥');
    expect(c.callout.icon.emoji).toBe('🔥');
  });

  test('quote block', () => {
    expect(blocks.quote('hi').type).toBe('quote');
  });

  test('richText coerces non-strings', () => {
    const rt = blocks.richText(42);
    expect(rt[0].text.content).toBe('42');
  });
});
