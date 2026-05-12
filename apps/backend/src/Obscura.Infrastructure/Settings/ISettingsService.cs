using Obscura.Contracts.Settings;

namespace Obscura.Infrastructure.Settings;

public interface ISettingsService
{
    Task<SettingsDto> GetAsync(CancellationToken cancellationToken);

    Task<SettingsDto> UpdateAsync(SettingsUpdateRequestDto request, CancellationToken cancellationToken);
}
