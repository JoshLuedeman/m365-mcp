import { z } from 'zod';

export const ListPlansSchema = {
  groupId: z.string().describe('The ID of the Microsoft 365 group that owns the plan(s)'),
};

export const ListBucketsSchema = {
  planId: z.string().describe('The ID of the Planner plan'),
};

export const ListTasksSchema = {
  planId: z.string().describe('The ID of the Planner plan'),
};

export const GetTaskSchema = {
  taskId: z.string().describe('The ID of the Planner task'),
};

export const GetTaskDetailsSchema = {
  taskId: z.string().describe('The ID of the Planner task'),
};

export const CreateTaskSchema = {
  planId: z.string().describe('The ID of the Planner plan to create the task in'),
  bucketId: z.string().optional().describe('The ID of the bucket to place the task in'),
  title: z.string().describe('Task title'),
  dueDateTime: z
    .string()
    .optional()
    .describe('Due date/time in ISO 8601 format (e.g. 2026-06-01T00:00:00Z)'),
  assigneeUserIds: z
    .array(z.string())
    .optional()
    .describe('User IDs to assign this task to'),
};

export const UpdateTaskSchema = {
  taskId: z.string().describe('The ID of the Planner task to update'),
  etag: z
    .string()
    .describe(
      "The task's current @odata.etag value (required by Graph for optimistic concurrency on PATCH — fetch via get_task first)",
    ),
  title: z.string().optional().describe('Updated task title'),
  dueDateTime: z.string().optional().describe('Updated due date/time in ISO 8601 format'),
  percentComplete: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('Updated completion percentage (0-100; 100 marks the task complete)'),
};
