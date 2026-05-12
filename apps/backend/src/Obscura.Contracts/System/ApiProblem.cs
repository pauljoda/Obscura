namespace Obscura.Contracts.System;

/// <summary>
/// Consistent API error shape used by v2 endpoints.
/// </summary>
/// <param name="Code">Stable machine-readable error code.</param>
/// <param name="Message">Human-readable explanation of the error.</param>
public sealed record ApiProblem(string Code, string Message);
