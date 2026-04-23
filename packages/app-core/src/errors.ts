/**
 * Generic sentinel error classes shared by the Fastify API and the
 * SvelteKit server. Each shared write/read helper throws one of these
 * with a human-readable message; each host maps to its own HTTP
 * response (AppError for Fastify, json-with-status for SvelteKit).
 *
 * Using a single classification keeps the host-side mapping tables
 * short. Use the existing per-entity classes (TagNotFoundError, etc.)
 * where they already exist; new entities should reach for these.
 */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class InternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InternalError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnprocessableError extends Error {
  detail?: string;

  constructor(message: string, options?: { detail?: string }) {
    super(message);
    this.name = "UnprocessableError";
    this.detail = options?.detail;
  }
}
