export interface Artist {
  id: string; // YouTube channel/browse ID
  name: string;
  thumbnail: string;
  subscribers?: string; // e.g. "1.2M subscribers"
  description?: string;
}
