/**
 * Microsoft Graph API scopes required by this server.
 * offline_access is required for refresh token acquisition.
 */
export const GRAPH_SCOPES: string[] = [
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Tasks.ReadWrite',
  'Contacts.ReadWrite',
  'offline_access',
  'User.Read',
];
