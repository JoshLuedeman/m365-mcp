import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListPlansSchema,
  ListBucketsSchema,
  ListTasksSchema,
  GetTaskSchema,
  GetTaskDetailsSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from './schemas.js';
import {
  handleListPlans,
  handleListBuckets,
  handleListTasks,
  handleGetTask,
  handleGetTaskDetails,
  handleCreateTask,
  handleUpdateTask,
} from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'list_plans',
    'List Planner plans owned by a Microsoft 365 group',
    ListPlansSchema,
    async ({ groupId }) => handleListPlans(groupId),
  );

  server.tool(
    'list_buckets',
    'List buckets (columns) within a Planner plan',
    ListBucketsSchema,
    async ({ planId }) => handleListBuckets(planId),
  );

  server.tool(
    'list_plan_tasks',
    'List tasks within a Planner plan',
    ListTasksSchema,
    async ({ planId }) => handleListTasks(planId),
  );

  server.tool(
    'get_plan_task',
    'Get a single Planner task by ID, including its current etag (required for update_plan_task)',
    GetTaskSchema,
    async ({ taskId }) => handleGetTask(taskId),
  );

  server.tool(
    'get_plan_task_details',
    'Get extended details for a Planner task (description, checklist, references)',
    GetTaskDetailsSchema,
    async ({ taskId }) => handleGetTaskDetails(taskId),
  );

  server.tool(
    'create_plan_task',
    'Create a new Planner task in a plan, optionally in a specific bucket and assigned to users',
    CreateTaskSchema,
    async (params) => handleCreateTask(params),
  );

  server.tool(
    'update_plan_task',
    "Update a Planner task's title, due date, or completion percentage. Requires the task's current etag (from get_plan_task) to prevent conflicting concurrent updates.",
    UpdateTaskSchema,
    async (params) => handleUpdateTask(params),
  );
}
