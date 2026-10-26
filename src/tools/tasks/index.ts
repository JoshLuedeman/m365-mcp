import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListTasksSchema,
  GetTaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  CompleteTaskSchema,
  DeleteTaskSchema,
} from './schemas.js';
import {
  handleListTaskLists,
  handleListTasks,
  handleGetTask,
  handleCreateTask,
  handleUpdateTask,
  handleCompleteTask,
  handleDeleteTask,
} from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'list_task_lists',
    'List all Microsoft To Do task lists for the signed-in user',
    { mailbox: ListTasksSchema.mailbox },
    async ({ mailbox }) => handleListTaskLists(mailbox),
  );

  server.tool(
    'list_tasks',
    'List tasks in a specific To Do task list, with optional filter and limit',
    ListTasksSchema,
    async ({ listId, filter, top, mailbox }) => handleListTasks(listId, filter, top, mailbox),
  );

  server.tool(
    'get_task',
    'Get a single To Do task by list ID and task ID',
    GetTaskSchema,
    async ({ listId, taskId, mailbox }) => handleGetTask(listId, taskId, mailbox),
  );

  server.tool(
    'create_task',
    'Create a new task in a To Do task list',
    CreateTaskSchema,
    async (params) => handleCreateTask(params),
  );

  server.tool(
    'update_task',
    'Update an existing To Do task (title, body, due date, importance)',
    UpdateTaskSchema,
    async (params) => handleUpdateTask(params),
  );

  server.tool(
    'complete_task',
    'Mark a To Do task as completed',
    CompleteTaskSchema,
    async ({ listId, taskId, mailbox }) => handleCompleteTask(listId, taskId, mailbox),
  );

  server.tool(
    'delete_task',
    'Delete a To Do task permanently',
    DeleteTaskSchema,
    async ({ listId, taskId, mailbox }) => handleDeleteTask(listId, taskId, mailbox),
  );
}
