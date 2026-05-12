using Obscura.Contracts.Settings;

namespace Obscura.Infrastructure.Settings;

public interface ISettingsService
{
    Task<SettingsResponse> GetAsync(CancellationToken cancellationToken);

    Task<SettingsResponse> UpdateAsync(SettingsUpdateRequest request, CancellationToken cancellationToken);
}
