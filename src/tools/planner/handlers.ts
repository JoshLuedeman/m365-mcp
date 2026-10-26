import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient } from '../../graph/client.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

// NOTE: Planner tools do NOT route through getApiBase()/the mailbox guard.
// Planner's container model is plan -> group, not mailbox-based at all —
// confirmed directly against Microsoft's own Planner API docs. Every Planner
// Application permission (Tasks.Read.All / Tasks.ReadWrite.All) is tenant-
// wide-all-plans-or-nothing with no platform-level scoping mechanism, and no
// equivalent of the mailbox guard exists for Planner today. This means ANY of
// the 3 mailbox-scoped processes can read/write ANY plan in the tenant,
// regardless of which mailbox that process is otherwise restricted to. This
// is a known, accepted gap (per Josh's explicit decision to keep Planner in
// scope anyway, accepting tenant-wide access with no platform restriction)
// — not an oversight. A real per-process restriction would require a
// separate M365_ALLOWED_GROUP_IDS-style allowlist, which does not exist here.

interface PlannerPlan {
  id?: string;
  title?: string;
  owner?: string;
  container?: unknown;
}

interface PlannerBucket {
  id?: string;
  name?: string;
  planId?: string;
}

interface PlannerTask {
  id?: string;
  title?: string;
  planId?: string;
  bucketId?: string;
  percentComplete?: number;
  dueDateTime?: string;
  assignments?: unknown;
  '@odata.etag'?: string;
}

interface PlannerTaskDetails {
  id?: string;
  description?: string;
  checklist?: unknown;
  references?: unknown;
}

export async function handleListPlans(groupId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const response = await client
      .api(`/groups/${groupId}/planner/plans`)
      .get() as { value?: PlannerPlan[] };

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListBuckets(planId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const response = await client
      .api(`/planner/plans/${planId}/buckets`)
      .get() as { value?: PlannerBucket[] };

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListTasks(planId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const response = await client
      .api(`/planner/plans/${planId}/tasks`)
      .get() as { value?: PlannerTask[] };

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

/**
 * Returns the task along with its @odata.etag, which callers MUST pass back
 * as the `etag` param to update_task — Graph requires an If-Match header
 * matching the task's current etag for any PATCH, to prevent lost updates
 * from concurrent modification. This is genuinely new concurrency handling
 * not present in any other category in this codebase (Mail/Calendar/Tasks/
 * Contacts have no equivalent optimistic-concurrency requirement).
 */
export async function handleGetTask(taskId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const task = await client.api(`/planner/tasks/${taskId}`).get() as PlannerTask;
    return formatResponse(task);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleGetTaskDetails(taskId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const details = await client
      .api(`/planner/tasks/${taskId}/details`)
      .get() as PlannerTaskDetails;

    return formatResponse(details);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface CreateTaskParams {
  planId: string;
  bucketId?: string;
  title: string;
  dueDateTime?: string;
  assigneeUserIds?: string[];
}

export async function handleCreateTask(params: CreateTaskParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const body: Record<string, unknown> = {
      planId: params.planId,
      title: params.title,
    };

    if (params.bucketId !== undefined) body.bucketId = params.bucketId;
    if (params.dueDateTime !== undefined) body.dueDateTime = params.dueDateTime;
    if (params.assigneeUserIds !== undefined && params.assigneeUserIds.length > 0) {
      body.assignments = Object.fromEntries(
        params.assigneeUserIds.map((id) => [
          id,
          { '@odata.type': '#microsoft.graph.plannerAssignment', orderHint: ' !' },
        ]),
      );
    }

    const created = await client.api('/planner/tasks').post(body) as PlannerTask;
    return formatResponse(created);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface UpdateTaskParams {
  taskId: string;
  etag: string;
  title?: string;
  dueDateTime?: string;
  percentComplete?: number;
}

/**
 * Updates a Planner task. Requires the caller to supply the task's current
 * etag (obtained from get_task) so we can set the If-Match header Graph
 * mandates for Planner PATCH requests. If the etag is stale (task was
 * modified since the caller last fetched it), Graph returns 412
 * Precondition Failed — callers should re-fetch via get_task and retry,
 * not assume the update silently failed for some other reason.
 */
export async function handleUpdateTask(params: UpdateTaskParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const patch: Record<string, unknown> = {};
    if (params.title !== undefined) patch.title = params.title;
    if (params.dueDateTime !== undefined) patch.dueDateTime = params.dueDateTime;
    if (params.percentComplete !== undefined) patch.percentComplete = params.percentComplete;

    const updated = await client
      .api(`/planner/tasks/${params.taskId}`)
      .header('If-Match', params.etag)
      .patch(patch) as PlannerTask;

    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
