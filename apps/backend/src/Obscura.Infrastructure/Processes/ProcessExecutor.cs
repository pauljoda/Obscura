using System.Diagnostics;

namespace Obscura.Infrastructure.Processes;

public sealed class ProcessExecutor : IProcessExecutor
{
    public async Task<ProcessExecutionResult> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        IReadOnlyDictionary<string, string>? environment,
        CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo(fileName)
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false
        };

        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        foreach (var (key, value) in environment ?? new Dictionary<string, string>())
        {
            startInfo.Environment[key] = value;
        }

        using var process = Process.Start(startInfo) ??
            throw new InvalidOperationException($"Failed to start '{fileName}'.");

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        return new ProcessExecutionResult(
            process.ExitCode,
            await stdoutTask,
            await stderrTask);
    }
}
