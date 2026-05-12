namespace Obscura.Infrastructure.Processes;

public interface IProcessExecutor
{
    Task<ProcessExecutionResult> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        IReadOnlyDictionary<string, string>? environment,
        CancellationToken cancellationToken);
}
