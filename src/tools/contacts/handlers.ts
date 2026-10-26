import type { Contact } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient, getApiBase } from '../../graph/client.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

interface ContactEmailAddress {
  address: string;
  name?: string;
}

export async function handleSearchContacts(
  query: string,
  top?: number,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    let request = client
      .api(`${base}/contacts`)
      .search(`"${query}"`)
      .select('id,displayName,givenName,surname,emailAddresses,businessPhones,jobTitle,companyName');

    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: Contact[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleGetContact(contactId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const contact = await client
      .api(`${base}/contacts/${contactId}`)
      .get() as Contact;
    return formatResponse(contact);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface CreateContactParams {
  givenName: string;
  surname?: string;
  emailAddresses?: ContactEmailAddress[];
  businessPhones?: string[];
  jobTitle?: string;
  companyName?: string;
  mailbox?: string;
}

export async function handleCreateContact(params: CreateContactParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const body: Partial<Contact> = {
      givenName: params.givenName,
    };

    if (params.surname !== undefined) body.surname = params.surname;
    if (params.emailAddresses !== undefined) body.emailAddresses = params.emailAddresses;
    if (params.businessPhones !== undefined) body.businessPhones = params.businessPhones;
    if (params.jobTitle !== undefined) body.jobTitle = params.jobTitle;
    if (params.companyName !== undefined) body.companyName = params.companyName;

    const created = await client.api(`${base}/contacts`).post(body) as Contact;
    return formatResponse(created);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface UpdateContactParams {
  contactId: string;
  givenName?: string;
  surname?: string;
  emailAddresses?: ContactEmailAddress[];
  businessPhones?: string[];
  jobTitle?: string;
  companyName?: string;
  mailbox?: string;
}

export async function handleUpdateContact(params: UpdateContactParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const patch: Partial<Contact> = {};

    if (params.givenName !== undefined) patch.givenName = params.givenName;
    if (params.surname !== undefined) patch.surname = params.surname;
    if (params.emailAddresses !== undefined) patch.emailAddresses = params.emailAddresses;
    if (params.businessPhones !== undefined) patch.businessPhones = params.businessPhones;
    if (params.jobTitle !== undefined) patch.jobTitle = params.jobTitle;
    if (params.companyName !== undefined) patch.companyName = params.companyName;

    const updated = await client
      .api(`${base}/contacts/${params.contactId}`)
      .patch(patch) as Contact;

    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
