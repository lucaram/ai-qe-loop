import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

// The pinned contract from Stage 1 is the source of truth, never the app.
const contract = JSON.parse(readFileSync('context/api/openapi.json', 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addSchema(contract, 'openapi');

export function assertMatchesContract(method: string, apiPath: string, status: number, body: unknown): void {
  const responses = contract.paths?.[apiPath]?.[method.toLowerCase()]?.responses;
  if (!responses) throw new Error(`${method} ${apiPath} is not in the API contract.`);

  const response = responses[String(status)];
  if (!response) throw new Error(`${method} ${apiPath} returned ${status}, which the API contract does not document.`);

  const schema = response.content?.['application/json']?.schema;
  if (!schema) return;

  const validate = schema.$ref ? ajv.getSchema(`openapi${schema.$ref}`) : ajv.compile(schema);
  if (!validate) throw new Error(`Cannot resolve schema ${schema.$ref}.`);
  if (!validate(body)) {
    throw new Error(`${method} ${apiPath} ${status} response does not match the API contract: ${ajv.errorsText(validate.errors)}`);
  }
}
