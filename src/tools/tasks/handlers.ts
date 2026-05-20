import type { TodoTask, TodoTaskList } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { acquireToken } from '../../auth/device-code-flow.js';
import { getGraphClient } from '../../graph/client.js';
import { collectAllPages } from '../../utils/pagination.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

export async function handleListTaskLists(): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const lists = await collectAllPages<TodoTaskList>(client, '/me/todo/lists');
    return formatResponse(lists);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListTasks(
  listId: string,
  filter?: string,
  top?: number,
): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);

    let request = client.api(`/me/todo/lists/${listId}/tasks`);
    if (filter !== undefined) {
      request = request.filter(filter);
    }
    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: TodoTask[]; '@odata.nextLink'?: string };
    const tasks: TodoTask[] = response.value ?? [];

    // Follow nextLink if top was not specified
    if (top === undefined && response['@odata.nextLink'] !== undefined) {
      const remaining = await collectAllPages<TodoTask>(
        client,
        response['@odata.nextLink'],
      );
      tasks.push(...remaining);
    }

    return formatResponse(tasks);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleGetTask(listId: string, taskId: string): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const task = await client.api(`/me/todo/lists/${listId}/tasks/${taskId}`).get() as TodoTask;
    return formatResponse(task);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface CreateTaskParams {
  listId: string;
  title: string;
  body?: string;
  dueDate?: string;
  importance?: 'low' | 'normal' | 'high';
}

export async function handleCreateTask(params: CreateTaskParams): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);

    const body: Partial<TodoTask> = {
      title: params.title,
    };

    if (params.body !== undefined) {
      body.body = { content: params.body, contentType: 'text' };
    }

    if (params.dueDate !== undefined) {
      body.dueDateTime = { dateTime: `${params.dueDate}T00:00:00`, timeZone: 'UTC' };
    }

    if (params.importance !== undefined) {
      body.importance = params.importance;
    }

    const created = await client
      .api(`/me/todo/lists/${params.listId}/tasks`)
      .post(body) as TodoTask;

    return formatResponse(created);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface UpdateTaskParams {
  listId: string;
  taskId: string;
  title?: string;
  body?: string;
  dueDate?: string;
  importance?: 'low' | 'normal' | 'high';
}

export async function handleUpdateTask(params: UpdateTaskParams): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);

    const patch: Partial<TodoTask> = {};

    if (params.title !== undefined) patch.title = params.title;
    if (params.body !== undefined) patch.body = { content: params.body, contentType: 'text' };
    if (params.dueDate !== undefined) {
      patch.dueDateTime = { dateTime: `${params.dueDate}T00:00:00`, timeZone: 'UTC' };
    }
    if (params.importance !== undefined) patch.importance = params.importance;

    const updated = await client
      .api(`/me/todo/lists/${params.listId}/tasks/${params.taskId}`)
      .patch(patch) as TodoTask;

    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleCompleteTask(listId: string, taskId: string): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const updated = await client
      .api(`/me/todo/lists/${listId}/tasks/${taskId}`)
      .patch({ status: 'completed' }) as TodoTask;
    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleDeleteTask(listId: string, taskId: string): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    await client.api(`/me/todo/lists/${listId}/tasks/${taskId}`).delete();
    return formatResponse({ deleted: true, taskId });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
