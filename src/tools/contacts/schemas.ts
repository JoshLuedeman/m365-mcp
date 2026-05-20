import { z } from 'zod';

const EmailAddressSchema = z.object({
  address: z.string().describe('Email address'),
  name: z.string().optional().describe('Display name for this email address'),
});

export const SearchContactsSchema = {
  query: z.string().describe('Search query (matches against name, email, company, etc.)'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of contacts to return (1-100)'),
};

export const GetContactSchema = {
  contactId: z.string().describe('The ID of the contact'),
};

export const CreateContactSchema = {
  givenName: z.string().describe('Contact first name'),
  surname: z.string().optional().describe('Contact last name'),
  emailAddresses: z
    .array(EmailAddressSchema)
    .optional()
    .describe('Email addresses for the contact'),
  businessPhones: z.array(z.string()).optional().describe('Business phone numbers'),
  jobTitle: z.string().optional().describe('Job title'),
  companyName: z.string().optional().describe('Company or organization name'),
};

export const UpdateContactSchema = {
  contactId: z.string().describe('The ID of the contact to update'),
  givenName: z.string().optional().describe('Updated first name'),
  surname: z.string().optional().describe('Updated last name'),
  emailAddresses: z
    .array(EmailAddressSchema)
    .optional()
    .describe('Updated email addresses'),
  businessPhones: z.array(z.string()).optional().describe('Updated business phone numbers'),
  jobTitle: z.string().optional().describe('Updated job title'),
  companyName: z.string().optional().describe('Updated company name'),
};
