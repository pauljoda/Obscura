namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of semantic file roles attached to entities.
/// </summary>
public enum EntityFileRole {
    /// <summary>Original playable or readable source file.</summary>
    Source,

    /// <summary>Small generated thumbnail image.</summary>
    Thumbnail,

    /// <summary>Primary poster or cover artwork.</summary>
    Poster,

    /// <summary>Wide background artwork.</summary>
    Backdrop,

    /// <summary>Brand or title-logo artwork.</summary>
    Logo,

    /// <summary>Short preview clip or representative media file.</summary>
    Preview,

    /// <summary>Sprite sheet used for timeline previews.</summary>
    Sprite,

    /// <summary>Trickplay asset used during seeking.</summary>
    Trickplay,

    /// <summary>Audio waveform image or data asset.</summary>
    Waveform,

    /// <summary>Book, gallery, or audio cover image.</summary>
    Cover,

    /// <summary>HLS manifest or segment asset.</summary>
    Hls
}

/// <summary>
/// Codec for entity file role codes.
/// </summary>
public sealed class EntityFileRoleCodec : EnumCodec<EntityFileRole> {
    public EntityFileRoleCodec()
        : base(new Dictionary<EntityFileRole, string> {
            [EntityFileRole.Source] = "source",
            [EntityFileRole.Thumbnail] = "thumbnail",
            [EntityFileRole.Poster] = "poster",
            [EntityFileRole.Backdrop] = "backdrop",
            [EntityFileRole.Logo] = "logo",
            [EntityFileRole.Preview] = "preview",
            [EntityFileRole.Sprite] = "sprite",
            [EntityFileRole.Trickplay] = "trickplay",
            [EntityFileRole.Waveform] = "waveform",
            [EntityFileRole.Cover] = "cover",
            [EntityFileRole.Hls] = "hls"
        }) {
    }
}
