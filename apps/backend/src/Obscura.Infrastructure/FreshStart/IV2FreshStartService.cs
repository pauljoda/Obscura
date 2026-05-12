namespace Obscura.Infrastructure.FreshStart;

public interface IV2FreshStartService
{
    Task<V2FreshStartResult> PrepareAsync(CancellationToken cancellationToken);
}
