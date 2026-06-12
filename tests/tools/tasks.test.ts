import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
}));

import { getGraphClient } from '../../src/graph/client.js';
import {
  handleListTaskLists,
  handleListTasks,
  handleGetTask,
  handleCreateTask,
  handleUpdateTask,
  handleCompleteTask,
  handleDeleteTask,
} from '../../src/tools/tasks/handlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = {
    filter: vi.fn(),
    top: vi.fn(),
    select: vi.fn(),
    search: vi.fn(),
    get: vi.fn().mockResolvedValue(responses.get ?? {}),
    post: vi.fn().mockResolvedValue(responses.post ?? {}),
    patch: vi.fn().mockResolvedValue(responses.patch ?? {}),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  chain.filter.mockReturnValue(chain);
  chain.top.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.search.mockReturnValue(chain);
  return chain;
}

function makeClient(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = makeChain(responses);
  const client = { api: vi.fn().mockReturnValue(chain) };
  vi.mocked(getGraphClient).mockReturnValue(client as ReturnType<typeof getGraphClient>);
  return { client, chain };
}

function makeGraphError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), {
    statusCode,
    body: JSON.stringify({ error: { code, message } }),
  });
}

// ---------------------------------------------------------------------------
// handleListTaskLists
// ---------------------------------------------------------------------------

describe('handleListTaskLists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns task lists on success', async () => {
    const lists = [{ id: 'list-1', displayName: 'Tasks' }];
    makeClient({ get: { value: lists } });

    const result = await handleListTaskLists();

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(lists);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Insufficient privileges'));

    const result = await handleListTaskLists();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403');
  });
});

// ---------------------------------------------------------------------------
// handleListTasks
// ---------------------------------------------------------------------------

describe('handleListTasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns tasks for a list', async () => {
    const tasks = [{ id: 't1', title: 'Buy milk' }];
    makeClient({ get: { value: tasks } });

    const result = await handleListTasks('list-1');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(tasks);
  });

  it('applies filter when provided', async () => {
    const { client, chain } = makeClient({ get: { value: [] } });

    await handleListTasks('list-1', "status eq 'notStarted'");

    expect(client.api).toHaveBeenCalledWith('/me/todo/lists/list-1/tasks');
    expect(chain.filter).toHaveBeenCalledWith("status eq 'notStarted'");
  });

  it('applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleListTasks('list-1', undefined, 10);

    expect(chain.top).toHaveBeenCalledWith(10);
  });

  it('does not call filter or top when not provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleListTasks('list-1');

    expect(chain.filter).not.toHaveBeenCalled();
    expect(chain.top).not.toHaveBeenCalled();
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'List not found'));

    const result = await handleListTasks('nonexistent-list');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('404');
  });
});

// ---------------------------------------------------------------------------
// handleGetTask
// ---------------------------------------------------------------------------

describe('handleGetTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a task by id', async () => {
    const task = { id: 't1', title: 'Write tests', status: 'notStarted' };
    makeClient({ get: task });

    const result = await handleGetTask('list-1', 't1');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(task);
  });

  it('calls the correct Graph endpoint', async () => {
    const { client } = makeClient({ get: { id: 't1' } });

    await handleGetTask('list-abc', 'task-xyz');

    expect(client.api).toHaveBeenCalledWith('/me/todo/lists/list-abc/tasks/task-xyz');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Task not found'));

    const result = await handleGetTask('list-1', 'missing-task');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleCreateTask
// ---------------------------------------------------------------------------

describe('handleCreateTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a task with required fields only', async () => {
    const created = { id: 'new-task', title: 'New task' };
    const { chain } = makeClient({ post: created });

    const result = await handleCreateTask({ listId: 'list-1', title: 'New task' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(created);
    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New task' }),
    );
  });

  it('sets body, dueDate, and importance when provided', async () => {
    const { chain } = makeClient({ post: { id: 'new' } });

    await handleCreateTask({
      listId: 'list-1',
      title: 'Task with all fields',
      body: 'Some notes',
      dueDate: '2026-12-31',
      importance: 'high',
    });

    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { content: 'Some notes', contentType: 'text' },
        dueDateTime: { dateTime: '2026-12-31T00:00:00', timeZone: 'UTC' },
        importance: 'high',
      }),
    );
  });

  it('returns isError when Graph rejects', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid list'));

    const result = await handleCreateTask({ listId: 'bad-list', title: 'Task' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleUpdateTask
// ---------------------------------------------------------------------------

describe('handleUpdateTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches only the provided fields', async () => {
    const updated = { id: 't1', title: 'Updated title' };
    const { chain } = makeClient({ patch: updated });

    const result = await handleUpdateTask({ listId: 'list-1', taskId: 't1', title: 'Updated title' });

    expect(result.isError).toBeFalsy();
    expect(chain.patch).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated title' }));
    // importance not in params — should not be in patch body
    expect(chain.patch).toHaveBeenCalledWith(
      expect.not.objectContaining({ importance: expect.anything() }),
    );
  });

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ patch: {} });

    await handleUpdateTask({ listId: 'my-list', taskId: 'my-task' });

    expect(client.api).toHaveBeenCalledWith('/me/todo/lists/my-list/tasks/my-task');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Task not found'));

    const result = await handleUpdateTask({ listId: 'list-1', taskId: 'gone' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleCompleteTask
// ---------------------------------------------------------------------------

describe('handleCompleteTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches status to completed', async () => {
    const { chain } = makeClient({ patch: { id: 't1', status: 'completed' } });

    const result = await handleCompleteTask('list-1', 't1');

    expect(result.isError).toBeFalsy();
    expect(chain.patch).toHaveBeenCalledWith({ status: 'completed' });
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleCompleteTask('list-1', 't1');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleDeleteTask
// ---------------------------------------------------------------------------

describe('handleDeleteTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns deleted: true with taskId on success', async () => {
    makeClient();

    const result = await handleDeleteTask('list-1', 'task-to-delete');

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text as string);
    expect(body).toEqual({ deleted: true, taskId: 'task-to-delete' });
  });

  it('calls delete on the correct endpoint', async () => {
    const { client, chain } = makeClient();

    await handleDeleteTask('my-list', 'my-task');

    expect(client.api).toHaveBeenCalledWith('/me/todo/lists/my-list/tasks/my-task');
    expect(chain.delete).toHaveBeenCalled();
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.delete.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Not found'));

    const result = await handleDeleteTask('list-1', 'gone');

    expect(result.isError).toBe(true);
  });
});
