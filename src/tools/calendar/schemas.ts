import { z } from 'zod';

export const SearchEventsSchema = {
  query: z.string().optional().describe('Search query string for event subject/content'),
  startDate: z
    .string()
    .optional()
    .describe('Filter events starting on or after this date (ISO 8601, e.g. 2026-06-01)'),
  endDate: z
    .string()
    .optional()
    .describe('Filter events ending on or before this date (ISO 8601, e.g. 2026-06-30)'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of events to return (1-100)'),
};

export const GetEventSchema = {
  eventId: z.string().describe('The ID of the calendar event'),
};

export const CreateEventSchema = {
  subject: z.string().describe('Event subject / title'),
  start: z
    .string()
    .describe('Event start time in ISO 8601 format (e.g. 2026-06-01T10:00:00)'),
  end: z.string().describe('Event end time in ISO 8601 format (e.g. 2026-06-01T11:00:00)'),
  timeZone: z
    .string()
    .optional()
    .default('UTC')
    .describe('IANA time zone for start/end (default: UTC)'),
  attendees: z
    .array(z.string())
    .optional()
    .describe('List of attendee email addresses'),
  body: z.string().optional().describe('Event body / description (HTML or plain text)'),
  location: z.string().optional().describe('Event location'),
  isTeamsMeeting: z
    .boolean()
    .optional()
    .describe('If true, create a Teams online meeting link'),
};

export const UpdateEventSchema = {
  eventId: z.string().describe('The ID of the calendar event to update'),
  subject: z.string().optional().describe('Updated event subject'),
  start: z.string().optional().describe('Updated start time in ISO 8601 format'),
  end: z.string().optional().describe('Updated end time in ISO 8601 format'),
  timeZone: z.string().optional().describe('IANA time zone for updated start/end'),
  attendees: z.array(z.string()).optional().describe('Updated list of attendee email addresses'),
  body: z.string().optional().describe('Updated event body'),
  location: z.string().optional().describe('Updated event location'),
};

export const FindAvailabilitySchema = {
  emails: z.array(z.string()).describe('List of email addresses to check availability for'),
  startTime: z
    .string()
    .describe('Start of the availability window in ISO 8601 format'),
  endTime: z
    .string()
    .describe('End of the availability window in ISO 8601 format'),
  timeZone: z
    .string()
    .optional()
    .default('UTC')
    .describe('IANA time zone for the window (default: UTC)'),
  intervalMinutes: z
    .number()
    .int()
    .min(5)
    .max(1440)
    .optional()
    .default(30)
    .describe('Schedule slot interval in minutes (default: 30)'),
};
