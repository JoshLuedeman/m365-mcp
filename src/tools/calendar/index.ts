import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SearchEventsSchema,
  GetEventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  FindAvailabilitySchema,
} from './schemas.js';
import {
  handleSearchEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleFindAvailability,
} from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'search_events',
    'Search calendar events by query, date range, or both',
    SearchEventsSchema,
    async ({ query, startDate, endDate, top }) =>
      handleSearchEvents(query, startDate, endDate, top),
  );

  server.tool(
    'get_event',
    'Get a single calendar event by ID',
    GetEventSchema,
    async ({ eventId }) => handleGetEvent(eventId),
  );

  server.tool(
    'create_event',
    'Create a new calendar event, optionally with attendees and a Teams meeting link',
    CreateEventSchema,
    async (params) => handleCreateEvent(params),
  );

  server.tool(
    'update_event',
    'Update an existing calendar event (subject, times, attendees, body, location)',
    UpdateEventSchema,
    async (params) => handleUpdateEvent(params),
  );

  server.tool(
    'find_availability',
    'Check free/busy availability for a list of people over a time window',
    FindAvailabilitySchema,
    async (params) => handleFindAvailability(params),
  );
}
