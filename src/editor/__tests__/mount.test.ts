import { describe, it, expect, vi } from 'vitest';

const renderCalls: Array<{ vnode: unknown; container: unknown }> = [];

vi.mock('preact', () => ({
  render: (vnode: unknown, container: unknown) => {
    renderCalls.push({ vnode, container });
  },
  h: (type: unknown, props: unknown) => ({ type, props }),
}));

describe('mountEditorRoot', () => {
  it('renders EditorRoot into host element and returns unmount function', async () => {
    renderCalls.length = 0;
    const { mountEditorRoot } = await import('../mount.js');
    const host = {} as HTMLElement;
    const editor = {} as never;
    const onClose = vi.fn();
    const unmount = mountEditorRoot({ host, editor, onClose });

    expect(renderCalls.length).toBe(1);
    expect(renderCalls[0]?.container).toBe(host);
    expect(typeof unmount).toBe('function');

    unmount();
    expect(renderCalls.length).toBe(2);
    expect(renderCalls[1]?.vnode).toBe(null);
    expect(renderCalls[1]?.container).toBe(host);
  });
});
