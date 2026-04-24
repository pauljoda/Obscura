/**
 * Generic sentinel error classes for shared read/write helpers. Each host
 * maps them into its own HTTP response shape while keeping the shared
 * helper layer transport-agnostic.
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
