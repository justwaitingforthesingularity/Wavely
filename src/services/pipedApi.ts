// Music API service — uses server-side YouTube.js via Next.js API routes

export interface ArtistIdRef {
  id: string;
  name: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  artist: string;
  artistIds?: ArtistIdRef[];
  album: string;
  thumbnail: string;
  duration: number;
  durationText: string;
}

export interface ArtistSearchResult {
  id: string;
  name: string;
  thumbnail: string;
  subscribers: string;
}

export interface PlaylistSearchResult {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  songCount: string;
}

export interface AlbumSearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  year: string;
  type: string;
}

export interface VideoSearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  views: string;
  songId: string; // The original song ID for audio playback (video ID may differ)
}

export interface SearchResponse {
  items: SearchResultItem[];
  artists: ArtistSearchResult[];
  albums: AlbumSearchResult[];
  playlists: PlaylistSearchResult[];
  videos: VideoSearchResult[];
}

export async function searchSongs(query: string): Promise<SearchResponse> {
  const response = await fetch(
    `/api/search?q=${encodeURIComponent(query)}`
  );
  if (!response.ok) throw new Error("Search failed");
  const data = await response.json();
  return {
    items: data.items || [],
    artists: data.artists || [],
    albums: data.albums || [],
    playlists: data.playlists || [],
    videos: data.videos || [],
  };
}

export interface AlbumResult {
  id: string;
  title: string;
  year: string;
  thumbnail: string;
  type: string;
}

export interface ArtistDetails {
  artist: {
    id: string;
    name: string;
    thumbnail: string;
    subscribers: string;
    description: string;
  };
  topSongs: {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
  }[];
  albums: AlbumResult[];
  videos: {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
  }[];
  relatedArtists: {
    id: string;
    name: string;
    thumbnail: string;
    subscribers: string;
  }[];
}

export async function getArtistDetails(artistId: string): Promise<ArtistDetails> {
  const response = await fetch(
    `/api/artist?id=${encodeURIComponent(artistId)}`
  );
  if (!response.ok) throw new Error("Artist fetch failed");
  return response.json();
}

export interface PlaylistDetails {
  playlist: {
    id: string;
    title: string;
    author: string;
    thumbnail: string;
    description: string;
  };
  songs: {
    id: string;
    title: string;
    artist: string;
    artistIds?: ArtistIdRef[];
    thumbnail: string;
    duration: number;
  }[];
}

export async function getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
  const response = await fetch(
    `/api/playlist?id=${encodeURIComponent(playlistId)}`
  );
  if (!response.ok) throw new Error("Playlist fetch failed");
  return response.json();
}

export interface AlbumDetails {
  album: {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    year: string;
    description: string;
  };
  songs: {
    id: string;
    title: string;
    artist: string;
    artistIds?: ArtistIdRef[];
    thumbnail: string;
    duration: number;
  }[];
}

export async function getAlbumDetails(albumId: string): Promise<AlbumDetails> {
  const response = await fetch(
    `/api/album?id=${encodeURIComponent(albumId)}`
  );
  if (!response.ok) throw new Error("Album fetch failed");
  return response.json();
}

export interface StreamInfo {
  url: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  mimeType: string;
}

export async function getStreamUrl(videoId: string): Promise<StreamInfo> {
  const response = await fetch(
    `/api/stream?id=${encodeURIComponent(videoId)}`
  );
  if (!response.ok) throw new Error("Stream fetch failed");
  return response.json();
}
