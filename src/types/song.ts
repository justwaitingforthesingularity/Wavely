export interface ArtistRef {
  id: string;
  name: string;
}

export interface SourceContext {
  type: "playlist" | "album";
  id: string;
  title: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  artistRefs?: ArtistRef[]; // for linking to artist profiles
  thumbnail: string;
  duration: number; // in seconds
  url?: string; // audio stream URL (fetched on demand)
  sourceContext?: SourceContext; // where the song was played from
  musicVideoId?: string; // if set, the actual music video ID (different from audio ID)
}

export interface SearchResult {
  url: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl: string;
  duration: number;
  views: number;
  uploadedDate: string;
}
