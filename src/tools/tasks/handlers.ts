import type { TodoTask, TodoTaskList } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient, getApiBase } from '../../graph/client.js';
import { collectAllPages } from '../../utils/pagination.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

export async function handleListTaskLists(mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const lists = await collectAllPages<TodoTaskList>(client, `${base}/todo/lists`);
    return formatResponse(lists);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListTasks(
  listId: string,
  filter?: string,
  top?: number,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    let request = client.api(`${base}/todo/lists/${listId}/tasks`);
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

export async function handleGetTask(listId: string, taskId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const task = await client.api(`${base}/todo/lists/${listId}/tasks/${taskId}`).get() as TodoTask;
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
  mailbox?: string;
}

export async function handleCreateTask(params: CreateTaskParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

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
      .api(`${base}/todo/lists/${params.listId}/tasks`)
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
  mailbox?: string;
}

export async function handleUpdateTask(params: UpdateTaskParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const patch: Partial<TodoTask> = {};

    if (params.title !== undefined) patch.title = params.title;
    if (params.body !== undefined) patch.body = { content: params.body, contentType: 'text' };
    if (params.dueDate !== undefined) {
      patch.dueDateTime = { dateTime: `${params.dueDate}T00:00:00`, timeZone: 'UTC' };
    }
    if (params.importance !== undefined) patch.importance = params.importance;

    const updated = await client
      .api(`${base}/todo/lists/${params.listId}/tasks/${params.taskId}`)
      .patch(patch) as TodoTask;

    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleCompleteTask(listId: string, taskId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const updated = await client
      .api(`${base}/todo/lists/${listId}/tasks/${taskId}`)
      .patch({ status: 'completed' }) as TodoTask;
    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleDeleteTask(listId: string, taskId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    await client.api(`${base}/todo/lists/${listId}/tasks/${taskId}`).delete();
    return formatResponse({ deleted: true, taskId });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
