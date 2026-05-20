using Obscura.Infrastructure.Media.Processing;
using Obscura.Application.Jobs.Ports;

namespace Obscura.Infrastructure.Media.Adapters;

/// <summary>
/// Adapts the Infrastructure HashingService to the Application port interface.
/// </summary>
public sealed class MediaHashingAdapter(HashingService inner) : IMediaHashing {
    public async Task<FileHashData> ComputeHashesAsync(string filePath, CancellationToken cancellationToken) {
        var result = await inner.ComputeHashesAsync(filePath, cancellationToken);
        return new FileHashData(result.Md5, result.Oshash);
    }
}
