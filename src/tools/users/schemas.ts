import { z } from 'zod';

export const ListUsersSchema = {
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of users to return (1-100)'),
};

export const SearchUsersSchema = {
  query: z
    .string()
    .describe('Search query matched against display name, email, or user principal name'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of users to return (1-100)'),
};

export const GetUserSchema = {
  userId: z.string().describe('The ID or user principal name (email) of the user'),
};
