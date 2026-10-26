import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
}));

import { getGraphClient } from '../../src/graph/client.js';
import {
  handleListPlans,
  handleListBuckets,
  handleListTasks,
  handleGetTask,
  handleGetTaskDetails,
  handleCreateTask,
  handleUpdateTask,
} from '../../src/tools/planner/handlers.js';

function makeChain(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = {
    header: vi.fn(),
    get: vi.fn().mockResolvedValue(responses.get ?? {}),
    post: vi.fn().mockResolvedValue(responses.post ?? {}),
    patch: vi.fn().mockResolvedValue(responses.patch ?? {}),
  };
  chain.header.mockReturnValue(chain);
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

describe('handleListPlans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists plans for a group', async () => {
    const plans = [{ id: 'p1', title: 'Project Alpha' }];
    const { client } = makeClient({ get: { value: plans } });

    const result = await handleListPlans('group-1');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/groups/group-1/planner/plans');
    expect(JSON.parse(result.content[0].text as string)).toEqual(plans);
  });

  it('returns an empty array when the group has no plans', async () => {
    makeClient({ get: { value: [] } });

    const result = await handleListPlans('group-no-plans');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual([]);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListPlans('group-1');

    expect(result.isError).toBe(true);
  });
});

describe('handleListBuckets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists buckets for a plan', async () => {
    const buckets = [{ id: 'b1', name: 'To Do' }];
    const { client } = makeClient({ get: { value: buckets } });

    const result = await handleListBuckets('plan-1');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/planner/plans/plan-1/buckets');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'NotFound', 'Plan not found'));

    const result = await handleListBuckets('gone');

    expect(result.isError).toBe(true);
  });
});

describe('handleListTasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists tasks for a plan', async () => {
    const tasks = [{ id: 't1', title: 'Write docs' }];
    const { client } = makeClient({ get: { value: tasks } });

    const result = await handleListTasks('plan-1');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/planner/plans/plan-1/tasks');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListTasks('plan-1');

    expect(result.isError).toBe(true);
  });
});

describe('handleGetTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the task including its etag', async () => {
    const task = { id: 't1', title: 'Write docs', '@odata.etag': 'W/"abc123"' };
    const { client } = makeClient({ get: task });

    const result = await handleGetTask('t1');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/planner/tasks/t1');
    const body = JSON.parse(result.content[0].text as string);
    expect(body['@odata.etag']).toBe('W/"abc123"');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'NotFound', 'Task not found'));

    const result = await handleGetTask('gone');

    expect(result.isError).toBe(true);
  });
});

describe('handleGetTaskDetails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns task details', async () => {
    const details = { id: 't1', description: 'Full description here' };
    const { client } = makeClient({ get: details });

    const result = await handleGetTaskDetails('t1');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/planner/tasks/t1/details');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleGetTaskDetails('t1');

    expect(result.isError).toBe(true);
  });
});

describe('handleCreateTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a task with required fields only', async () => {
    const created = { id: 'new-t', title: 'New task' };
    const { client, chain } = makeClient({ post: created });

    const result = await handleCreateTask({ planId: 'plan-1', title: 'New task' });

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/planner/tasks');
    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({ planId: 'plan-1', title: 'New task' }),
    );
  });

  it('includes bucketId, dueDateTime, and assignments when provided', async () => {
    const { chain } = makeClient({ post: {} });

    await handleCreateTask({
      planId: 'plan-1',
      bucketId: 'bucket-1',
      title: 'Assigned task',
      dueDateTime: '2026-06-01T00:00:00Z',
      assigneeUserIds: ['user-1', 'user-2'],
    });

    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketId: 'bucket-1',
        dueDateTime: '2026-06-01T00:00:00Z',
        assignments: expect.objectContaining({
          'user-1': expect.objectContaining({ '@odata.type': '#microsoft.graph.plannerAssignment' }),
          'user-2': expect.objectContaining({ '@odata.type': '#microsoft.graph.plannerAssignment' }),
        }),
      }),
    );
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid plan'));

    const result = await handleCreateTask({ planId: 'bad', title: 'x' });

    expect(result.isError).toBe(true);
  });
});

describe('handleUpdateTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends If-Match header with the provided etag', async () => {
    const { chain } = makeClient({ patch: { id: 't1' } });

    await handleUpdateTask({ taskId: 't1', etag: 'W/"abc123"', title: 'Updated' });

    expect(chain.header).toHaveBeenCalledWith('If-Match', 'W/"abc123"');
    expect(chain.patch).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated' }));
  });

  it('only includes provided fields in the patch body', async () => {
    const { chain } = makeClient({ patch: {} });

    await handleUpdateTask({ taskId: 't1', etag: 'W/"x"', percentComplete: 100 });

    expect(chain.patch).toHaveBeenCalledWith({ percentComplete: 100 });
  });

  it('returns isError on 412 Precondition Failed (stale etag)', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(
      makeGraphError(412, 'PreconditionFailed', 'Resource has been modified'),
    );

    const result = await handleUpdateTask({ taskId: 't1', etag: 'W/"stale"', title: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('412');
  });
});
