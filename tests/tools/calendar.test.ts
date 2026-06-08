import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/device-code-flow.js', () => ({
  acquireToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
}));

import { getGraphClient } from '../../src/graph/client.js';
import {
  handleSearchEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleFindAvailability,
} from '../../src/tools/calendar/handlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = {
    filter: vi.fn(),
    top: vi.fn(),
    select: vi.fn(),
    search: vi.fn(),
    get: vi.fn().mockResolvedValue(responses.get ?? {}),
    post: vi.fn().mockResolvedValue(responses.post ?? {}),
    patch: vi.fn().mockResolvedValue(responses.patch ?? {}),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  chain.filter.mockReturnValue(chain);
  chain.top.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.search.mockReturnValue(chain);
  return chain;
}

function makeClient(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = makeChain(responses);
  const client = { api: vi.fn().mockReturnValue(chain) };
  vi.mocked(getGraphClient).mockReturnValue(client as ReturnType<typeof getGraphClient>);
  return { client, chain };
}

function makeGraphError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), {
    statusCode,
    body: JSON.stringify({ error: { code, message } }),
  });
}

// ---------------------------------------------------------------------------
// handleSearchEvents
// ---------------------------------------------------------------------------

describe('handleSearchEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns events on success', async () => {
    const events = [{ id: 'e1', subject: 'Team standup' }];
    makeClient({ get: { value: events } });

    const result = await handleSearchEvents();

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(events);
  });

  it('applies search when query is provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchEvents('standup');

    expect(chain.search).toHaveBeenCalledWith('"standup"');
  });

  it('applies date range filters when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchEvents(undefined, '2026-06-01', '2026-06-30');

    expect(chain.filter).toHaveBeenCalledWith(
      expect.stringContaining("start/dateTime ge '2026-06-01T00:00:00Z'"),
    );
    expect(chain.filter).toHaveBeenCalledWith(
      expect.stringContaining("end/dateTime le '2026-06-30T23:59:59Z'"),
    );
  });

  it('applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchEvents(undefined, undefined, undefined, 5);

    expect(chain.top).toHaveBeenCalledWith(5);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleSearchEvents();

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleGetEvent
// ---------------------------------------------------------------------------

describe('handleGetEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the event', async () => {
    const event = { id: 'e1', subject: 'Board meeting' };
    makeClient({ get: event });

    const result = await handleGetEvent('e1');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(event);
  });

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ get: {} });

    await handleGetEvent('event-abc');

    expect(client.api).toHaveBeenCalledWith('/me/events/event-abc');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Event not found'));

    const result = await handleGetEvent('gone');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleCreateEvent
// ---------------------------------------------------------------------------

describe('handleCreateEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an event and returns it', async () => {
    const created = { id: 'new-event', subject: 'Team lunch' };
    const { chain } = makeClient({ post: created });

    const result = await handleCreateEvent({
      subject: 'Team lunch',
      start: '2026-06-15T12:00:00',
      end: '2026-06-15T13:00:00',
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(created);
    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Team lunch' }),
    );
  });

  it('defaults timeZone to UTC', async () => {
    const { chain } = makeClient({ post: {} });

    await handleCreateEvent({ subject: 'S', start: '2026-01-01T09:00:00', end: '2026-01-01T10:00:00' });

    const callArg = chain.post.mock.calls[0][0] as { start: { timeZone: string } };
    expect(callArg.start.timeZone).toBe('UTC');
  });

  it('sets attendees when provided', async () => {
    const { chain } = makeClient({ post: {} });

    await handleCreateEvent({
      subject: 'Meeting',
      start: '2026-01-01T09:00:00',
      end: '2026-01-01T10:00:00',
      attendees: ['a@example.com', 'b@example.com'],
    });

    const callArg = chain.post.mock.calls[0][0] as { attendees: Array<{ emailAddress: { address: string } }> };
    expect(callArg.attendees).toHaveLength(2);
    expect(callArg.attendees[0].emailAddress.address).toBe('a@example.com');
  });

  it('sets isOnlineMeeting when isTeamsMeeting is true', async () => {
    const { chain } = makeClient({ post: {} });

    await handleCreateEvent({
      subject: 'Teams call',
      start: '2026-01-01T09:00:00',
      end: '2026-01-01T10:00:00',
      isTeamsMeeting: true,
    });

    const callArg = chain.post.mock.calls[0][0] as { isOnlineMeeting: boolean };
    expect(callArg.isOnlineMeeting).toBe(true);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid time'));

    const result = await handleCreateEvent({ subject: 'S', start: 'bad', end: 'bad' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleUpdateEvent
// ---------------------------------------------------------------------------

describe('handleUpdateEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches only provided fields', async () => {
    const { chain } = makeClient({ patch: { id: 'e1', subject: 'Updated' } });

    const result = await handleUpdateEvent({ eventId: 'e1', subject: 'Updated' });

    expect(result.isError).toBeFalsy();
    expect(chain.patch).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Updated' }));
    expect(chain.patch).toHaveBeenCalledWith(
      expect.not.objectContaining({ location: expect.anything() }),
    );
  });

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ patch: {} });

    await handleUpdateEvent({ eventId: 'event-xyz' });

    expect(client.api).toHaveBeenCalledWith('/me/events/event-xyz');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Event not found'));

    const result = await handleUpdateEvent({ eventId: 'gone' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleFindAvailability
// ---------------------------------------------------------------------------

describe('handleFindAvailability', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns availability information', async () => {
    const schedules = [{ scheduleId: 'a@example.com', availabilityView: '0000' }];
    makeClient({ post: { value: schedules } });

    const result = await handleFindAvailability({
      emails: ['a@example.com'],
      startTime: '2026-06-01T09:00:00',
      endTime: '2026-06-01T17:00:00',
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(schedules);
  });

  it('posts to /me/calendar/getSchedule', async () => {
    const { client } = makeClient({ post: { value: [] } });

    await handleFindAvailability({
      emails: ['a@example.com'],
      startTime: '2026-01-01T09:00:00',
      endTime: '2026-01-01T17:00:00',
    });

    expect(client.api).toHaveBeenCalledWith('/me/calendar/getSchedule');
  });

  it('defaults timeZone to UTC and intervalMinutes to 30', async () => {
    const { chain } = makeClient({ post: { value: [] } });

    await handleFindAvailability({
      emails: ['a@example.com'],
      startTime: '2026-01-01T09:00:00',
      endTime: '2026-01-01T17:00:00',
    });

    const body = chain.post.mock.calls[0][0] as {
      startTime: { timeZone: string };
      availabilityViewInterval: number;
    };
    expect(body.startTime.timeZone).toBe('UTC');
    expect(body.availabilityViewInterval).toBe(30);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid schedule request'));

    const result = await handleFindAvailability({
      emails: ['bad'],
      startTime: '2026-01-01T09:00:00',
      endTime: '2026-01-01T17:00:00',
    });

    expect(result.isError).toBe(true);
  });
});
