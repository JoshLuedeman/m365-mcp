import type { Event } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient, getApiBase } from '../../graph/client.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

interface AttendeeEmailAddress {
  address: string;
  name?: string;
}

interface Attendee {
  emailAddress: AttendeeEmailAddress;
  type: 'required' | 'optional' | 'resource';
}

export async function handleSearchEvents(
  query?: string,
  startDate?: string,
  endDate?: string,
  top?: number,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    let request = client.api(`${base}/events`);

    if (query !== undefined) {
      request = request.search(`"${query}"`);
    }

    const filters: string[] = [];
    if (startDate !== undefined) {
      filters.push(`start/dateTime ge '${startDate}T00:00:00Z'`);
    }
    if (endDate !== undefined) {
      filters.push(`end/dateTime le '${endDate}T23:59:59Z'`);
    }
    if (filters.length > 0) {
      request = request.filter(filters.join(' and '));
    }

    if (top !== undefined) {
      request = request.top(top);
    }

    request = request.select('id,subject,start,end,location,attendees,bodyPreview,isOnlineMeeting,onlineMeetingUrl');

    const response = await request.get() as { value?: Event[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleGetEvent(eventId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const event = await client.api(`${base}/events/${eventId}`).get() as Event;
    return formatResponse(event);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface CreateEventParams {
  subject: string;
  start: string;
  end: string;
  timeZone?: string;
  attendees?: string[];
  body?: string;
  location?: string;
  isTeamsMeeting?: boolean;
  mailbox?: string;
}

export async function handleCreateEvent(params: CreateEventParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const tz = params.timeZone ?? 'UTC';

    const eventBody: Partial<Event> & { isOnlineMeeting?: boolean } = {
      subject: params.subject,
      start: { dateTime: params.start, timeZone: tz },
      end: { dateTime: params.end, timeZone: tz },
    };

    if (params.body !== undefined) {
      eventBody.body = { contentType: 'text', content: params.body };
    }

    if (params.location !== undefined) {
      eventBody.location = { displayName: params.location };
    }

    if (params.attendees !== undefined && params.attendees.length > 0) {
      eventBody.attendees = params.attendees.map((email): Attendee => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    if (params.isTeamsMeeting === true) {
      eventBody.isOnlineMeeting = true;
    }

    const created = await client.api(`${base}/events`).post(eventBody) as Event;
    return formatResponse(created);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface UpdateEventParams {
  eventId: string;
  subject?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  attendees?: string[];
  body?: string;
  location?: string;
  mailbox?: string;
}

export async function handleUpdateEvent(params: UpdateEventParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const patch: Partial<Event> = {};
    const tz = params.timeZone ?? 'UTC';

    if (params.subject !== undefined) patch.subject = params.subject;
    if (params.start !== undefined) patch.start = { dateTime: params.start, timeZone: tz };
    if (params.end !== undefined) patch.end = { dateTime: params.end, timeZone: tz };
    if (params.body !== undefined) patch.body = { contentType: 'text', content: params.body };
    if (params.location !== undefined) patch.location = { displayName: params.location };
    if (params.attendees !== undefined) {
      patch.attendees = params.attendees.map((email): Attendee => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    const updated = await client.api(`${base}/events/${params.eventId}`).patch(patch) as Event;
    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface ScheduleInformation {
  scheduleId: string;
  availabilityView?: string;
  scheduleItems?: unknown[];
  workingHours?: unknown;
  error?: unknown;
}

interface GetScheduleResponse {
  value?: ScheduleInformation[];
}

interface FindAvailabilityParams {
  emails: string[];
  startTime: string;
  endTime: string;
  timeZone?: string;
  intervalMinutes?: number;
  mailbox?: string;
}

export async function handleFindAvailability(params: FindAvailabilityParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const tz = params.timeZone ?? 'UTC';
    const interval = params.intervalMinutes ?? 30;

    const requestBody = {
      schedules: params.emails,
      startTime: { dateTime: params.startTime, timeZone: tz },
      endTime: { dateTime: params.endTime, timeZone: tz },
      availabilityViewInterval: interval,
    };

    const response = await client
      .api(`${base}/calendar/getSchedule`)
      .post(requestBody) as GetScheduleResponse;

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
