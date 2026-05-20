import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  CompleteTaskSchema,
  ListTasksSchema,
  GetTaskSchema,
  DeleteTaskSchema,
} from '../../src/tools/tasks/schemas.js';

// The schemas export plain shape objects (not z.object instances),
// so we wrap each in z.object() to use safeParse.
const createTaskSchema = z.object(CreateTaskSchema);
const updateTaskSchema = z.object(UpdateTaskSchema);
const completeTaskSchema = z.object(CompleteTaskSchema);
const listTasksSchema = z.object(ListTasksSchema);
const getTaskSchema = z.object(GetTaskSchema);
const deleteTaskSchema = z.object(DeleteTaskSchema);

describe('CreateTaskSchema', () => {
  it('accepts a valid input with required fields only', () => {
    const result = createTaskSchema.safeParse({ listId: 'abc', title: 'Test' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid input with all optional fields', () => {
    const result = createTaskSchema.safeParse({
      listId: 'abc',
      title: 'Test',
      body: 'Some notes',
      dueDate: '2026-06-01',
      importance: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('rejects input missing listId', () => {
    const result = createTaskSchema.safeParse({ title: 'No list id' });
    expect(result.success).toBe(false);
  });

  it('rejects input missing title', () => {
    const result = createTaskSchema.safeParse({ listId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid importance value', () => {
    const result = createTaskSchema.safeParse({ listId: 'abc', title: 'T', importance: 'critical' });
    expect(result.success).toBe(false);
  });
});

describe('UpdateTaskSchema', () => {
  it('accepts a valid input with all required fields', () => {
    const result = updateTaskSchema.safeParse({ listId: 'a', taskId: 'b', title: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid input with no optional fields (only required)', () => {
    const result = updateTaskSchema.safeParse({ listId: 'a', taskId: 'b' });
    expect(result.success).toBe(true);
  });

  it('rejects input missing listId', () => {
    const result = updateTaskSchema.safeParse({ taskId: 'b', title: 'Updated' });
    expect(result.success).toBe(false);
  });

  it('rejects input missing taskId', () => {
    const result = updateTaskSchema.safeParse({ listId: 'a', title: 'Updated' });
    expect(result.success).toBe(false);
  });
});

describe('CompleteTaskSchema', () => {
  it('accepts valid input', () => {
    const result = completeTaskSchema.safeParse({ listId: 'a', taskId: 'b' });
    expect(result.success).toBe(true);
  });

  it('rejects input missing listId', () => {
    const result = completeTaskSchema.safeParse({ taskId: 'b' });
    expect(result.success).toBe(false);
  });

  it('rejects input missing taskId', () => {
    const result = completeTaskSchema.safeParse({ listId: 'a' });
    expect(result.success).toBe(false);
  });
});

describe('ListTasksSchema', () => {
  it('accepts input with only the required listId', () => {
    const result = listTasksSchema.safeParse({ listId: 'x' });
    expect(result.success).toBe(true);
  });

  it('accepts input with optional filter and top', () => {
    const result = listTasksSchema.safeParse({ listId: 'x', filter: "status eq 'notStarted'", top: 10 });
    expect(result.success).toBe(true);
  });

  it('rejects top outside the 1-100 range', () => {
    const result = listTasksSchema.safeParse({ listId: 'x', top: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects top greater than 100', () => {
    const result = listTasksSchema.safeParse({ listId: 'x', top: 101 });
    expect(result.success).toBe(false);
  });
});

describe('GetTaskSchema', () => {
  it('accepts valid input', () => {
    const result = getTaskSchema.safeParse({ listId: 'l', taskId: 't' });
    expect(result.success).toBe(true);
  });

  it('rejects missing taskId', () => {
    const result = getTaskSchema.safeParse({ listId: 'l' });
    expect(result.success).toBe(false);
  });
});

describe('DeleteTaskSchema', () => {
  it('accepts valid input', () => {
    const result = deleteTaskSchema.safeParse({ listId: 'l', taskId: 't' });
    expect(result.success).toBe(true);
  });

  it('rejects missing listId', () => {
    const result = deleteTaskSchema.safeParse({ taskId: 't' });
    expect(result.success).toBe(false);
  });
});
