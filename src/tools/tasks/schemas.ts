import { z } from 'zod';

export const ListTasksSchema = {
  listId: z.string().describe('The ID of the To Do task list'),
  filter: z.string().optional().describe('OData $filter expression (e.g. "status eq \'notStarted\'")'),
  top: z.number().int().min(1).max(100).optional().describe('Maximum number of tasks to return (1-100)'),
};

export const GetTaskSchema = {
  listId: z.string().describe('The ID of the To Do task list'),
  taskId: z.string().describe('The ID of the task'),
};

export const CreateTaskSchema = {
  listId: z.string().describe('The ID of the To Do task list'),
  title: z.string().describe('Task title'),
  body: z.string().optional().describe('Task body / notes (plain text)'),
  dueDate: z.string().optional().describe('Due date in ISO 8601 format (e.g. 2026-06-01)'),
  importance: z
    .enum(['low', 'normal', 'high'])
    .optional()
    .describe('Task importance level'),
};

export const UpdateTaskSchema = {
  listId: z.string().describe('The ID of the To Do task list'),
  taskId: z.string().describe('The ID of the task'),
  title: z.string().optional().describe('Updated task title'),
  body: z.string().optional().describe('Updated task body / notes'),
  dueDate: z.string().optional().describe('Updated due date in ISO 8601 format'),
  importance: z.enum(['low', 'normal', 'high']).optional().describe('Updated importance level'),
};

export const CompleteTaskSchema = {
  listId: z.string().describe('The ID of the To Do task list'),
  taskId: z.string().describe('The ID of the task to mark complete'),
};

export const DeleteTaskSchema = {
  listId: z.string().describe('The ID of the To Do task list'),
  taskId: z.string().describe('The ID of the task to delete'),
};
